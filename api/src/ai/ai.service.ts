import { Injectable, Inject, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { DATABASE_POOL } from '../database/database.module';
import { AuditService } from '../audit/audit.service';

type AiRole = 'BUYER' | 'SELLER' | 'ADMIN';

@Injectable()
export class AiService {
    constructor(
        @Inject(DATABASE_POOL) private readonly pool: any,
        private readonly auditService: AuditService,
    ) { }

    async search(query: string, userId?: string | null, locale = 'ar') {
        const clean = query.trim();
        if (!clean) throw new BadRequestException('نص البحث مطلوب');

        const inferred = this.inferFilters(clean);
        const params: any[] = [`%${clean}%`];
        const where: string[] = [
            `l.status = 'APPROVED'`,
            `(l.is_sold = false OR l.is_sold IS NULL)`,
            `(l.title ILIKE $1 OR COALESCE(l.description, '') ILIKE $1 OR COALESCE(l.city, '') ILIKE $1)`,
        ];

        if (inferred.type) {
            params.push(inferred.type);
            where.push(`l.type = $${params.length}`);
        }

        if (inferred.city) {
            params.push(`%${inferred.city}%`);
            where.push(`COALESCE(l.city, '') ILIKE $${params.length}`);
        }

        if (inferred.maxPrice !== null) {
            params.push(inferred.maxPrice);
            where.push(`COALESCE(l.price, 0) <= $${params.length}`);
        }

        const { rows } = await this.pool.query(
            `SELECT l.id, l.title, l.description, l.type, l.price, l.currency, l.city, l.created_at,
                    c.name_ar AS category_name_ar, c.name_en AS category_name_en
             FROM listings l
             LEFT JOIN categories c ON c.id = l.category_id
             WHERE ${where.join(' AND ')}
             ORDER BY l.created_at DESC
             LIMIT 20`,
            params,
        );

        const suggestions = rows.slice(0, 6).map((row: any) => ({
            listingId: row.id,
            title: row.title,
            reason: locale === 'ar'
                ? `مطابق للكلمات المفتاحية${inferred.type ? ` ونوع ${inferred.type}` : ''}${inferred.city ? ` في ${inferred.city}` : ''}`
                : `Matches keywords${inferred.type ? ` and type ${inferred.type}` : ''}${inferred.city ? ` in ${inferred.city}` : ''}`,
            price: row.price,
            currency: row.currency,
            city: row.city,
            type: row.type,
        }));

        await this.logAiRequest({
            userId: userId || null,
            role: this.roleFromUserId(userId),
            feature: 'search',
            prompt: clean,
            responseSummary: `results=${rows.length}`,
            meta: { inferred },
        });

        return {
            query: clean,
            inferredFilters: inferred,
            resultsCount: rows.length,
            suggestions,
            results: rows,
        };
    }

    async improveListing(
        userId: string,
        input: {
            listingId?: string;
            title?: string;
            description?: string;
            category?: string;
            city?: string;
        },
    ) {
        let source: any = {
            title: input.title || '',
            description: input.description || '',
            category: input.category || '',
            city: input.city || '',
            type: null,
        };

        if (input.listingId) {
            const { rows } = await this.pool.query(
                `SELECT l.*, c.name_ar AS category_name_ar
                 FROM listings l
                 LEFT JOIN categories c ON c.id = l.category_id
                 WHERE l.id = $1`,
                [input.listingId],
            );
            if (rows.length === 0) throw new NotFoundException('الإعلان غير موجود');
            if (rows[0].owner_id !== userId) {
                throw new ForbiddenException('لا يمكنك تحسين إعلان لا تملكه');
            }
            source = {
                title: rows[0].title || '',
                description: rows[0].description || '',
                category: rows[0].category_name_ar || '',
                city: rows[0].city || '',
                type: rows[0].type,
            };
        }

        if (!source.title && !source.description) {
            throw new BadRequestException('يلزم عنوان أو وصف على الأقل');
        }

        const keywords = this.extractKeywords(`${source.title} ${source.description}`);
        const titlePieces = [source.title.trim(), ...keywords.slice(0, 3)].filter(Boolean);
        const improvedTitle = this.limitWords(this.uniqueJoin(titlePieces, ' - '), 14);

        const enhancedDescriptionParts = [
            source.description.trim(),
            source.city ? `الموقع: ${source.city}.` : '',
            source.category ? `الفئة: ${source.category}.` : '',
            keywords.length ? `الكلمات الدالة: ${keywords.slice(0, 5).join('، ')}.` : '',
            'يرجى إرفاق وثائق الملكية والبيانات التشغيلية الكاملة لرفع موثوقية الطلب.',
        ].filter(Boolean);

        const improvedDescription = enhancedDescriptionParts.join(' ');

        const comparable = await this.priceComparable(source.type, source.category);
        const guidance = comparable
            ? {
                suggestedPrice: comparable.suggested,
                min: comparable.min,
                max: comparable.max,
                sampleSize: comparable.count,
                note: 'التسعير المقترح مبني على بيانات داخلية مشابهة',
            }
            : {
                suggestedPrice: null,
                min: null,
                max: null,
                sampleSize: 0,
                note: 'لا توجد بيانات كافية للتسعير المقارن حالياً',
            };

        await this.logAiRequest({
            userId,
            role: 'SELLER',
            feature: 'listing-improve',
            prompt: `${source.title}\n${source.description}`,
            responseSummary: `title=${improvedTitle.substring(0, 60)}`,
            meta: { listingId: input.listingId || null, keywords },
        });

        return {
            original: source,
            suggestion: {
                title: improvedTitle,
                description: improvedDescription,
                keywords,
                priceGuidance: guidance,
            },
            applyPayload: {
                title: improvedTitle,
                description: improvedDescription,
                suggestedPrice: guidance.suggestedPrice,
            },
        };
    }

    async supportDraft(actorUserId: string, ticketId: string, userMessage: string, locale = 'ar') {
        const { rows } = await this.pool.query(
            `SELECT t.id, t.subject, t.category, t.priority, t.status,
                    COALESCE(
                      (
                        SELECT json_agg(json_build_object(
                          'sender_type', m.sender_type,
                          'message', m.message,
                          'created_at', m.created_at
                        ) ORDER BY m.created_at DESC)
                        FROM support_messages m
                        WHERE m.ticket_id = t.id
                        LIMIT 5
                      ),
                      '[]'::json
                    ) AS recent_messages
             FROM support_tickets t
             WHERE t.id = $1`,
            [ticketId],
        );

        if (rows.length === 0) throw new NotFoundException('التذكرة غير موجودة');

        const ticket = rows[0];
        const tone = this.detectSupportTone(userMessage);
        const urgency = this.detectUrgency(userMessage, ticket.priority);

        const draft = locale.startsWith('ar')
            ? this.buildArabicSupportDraft(ticket.subject, userMessage, tone, urgency)
            : this.buildEnglishSupportDraft(ticket.subject, userMessage, tone, urgency);

        await this.logAiRequest({
            userId: actorUserId,
            role: 'ADMIN',
            feature: 'support-draft',
            prompt: `${ticket.subject}\n${userMessage}`,
            responseSummary: `urgency=${urgency}`,
            meta: { ticketId, urgency, tone },
        });

        return {
            ticketId,
            urgency,
            tone,
            draft,
            suggestions: [
                locale.startsWith('ar') ? 'تحقق من حالة الدفع المرتبطة بالطلب إن وُجد.' : 'Check the related payment status if applicable.',
                locale.startsWith('ar') ? 'أضف توقيتًا متوقعًا للرد القادم.' : 'Add an expected next update time.',
                locale.startsWith('ar') ? 'اطلب مستندات داعمة إذا كانت الحالة نزاع ملكية.' : 'Request supporting documents for ownership disputes.',
            ],
        };
    }

    async adminInsights(actorUserId: string) {
        const [stuckOrders, failedPayments, suspiciousBids, pendingTickets] = await Promise.all([
            this.pool.query(
                `SELECT COUNT(*)::int AS count
                 FROM orders
                 WHERE status IN ('RESERVED', 'PENDING_PAYMENT')
                   AND created_at < NOW() - INTERVAL '20 minutes'`,
            ),
            this.pool.query(
                `SELECT COUNT(*)::int AS count
                 FROM payments
                 WHERE status = 'FAILED'
                   AND updated_at >= NOW() - INTERVAL '24 hours'`,
            ),
            this.pool.query(
                `SELECT COUNT(*)::int AS count
                 FROM (
                   SELECT auction_id, user_id, COUNT(*) AS c
                   FROM bids
                   WHERE created_at >= NOW() - INTERVAL '1 hour'
                   GROUP BY auction_id, user_id
                   HAVING COUNT(*) >= 10
                 ) x`,
            ),
            this.pool.query(
                `SELECT COUNT(*)::int AS count
                 FROM support_tickets
                 WHERE status IN ('OPEN', 'PENDING')
                   AND priority IN ('HIGH', 'CRITICAL')`,
            ),
        ]);

        const summary = {
            stuckOrders: stuckOrders.rows[0]?.count ?? 0,
            failedPayments24h: failedPayments.rows[0]?.count ?? 0,
            suspiciousBidPatterns: suspiciousBids.rows[0]?.count ?? 0,
            highPriorityTickets: pendingTickets.rows[0]?.count ?? 0,
        };

        const recommendations: string[] = [];
        if (summary.stuckOrders > 0) recommendations.push('تشغيل reconcile للمدفوعات ومراجعة reservations المنتهية.');
        if (summary.failedPayments24h > 5) recommendations.push('مراجعة فشل الدفع مع Tap وتحليل الأسباب المتكررة.');
        if (summary.suspiciousBidPatterns > 0) recommendations.push('مراجعة حسابات المزايدة ذات النشاط غير الطبيعي وتطبيق فحص إضافي.');
        if (summary.highPriorityTickets > 0) recommendations.push('تخصيص وكلاء دعم إضافيين لتذاكر الأولوية العالية.');
        if (recommendations.length === 0) recommendations.push('مؤشرات التشغيل مستقرة خلال الفترة الحالية.');

        await this.logAiRequest({
            userId: actorUserId,
            role: 'ADMIN',
            feature: 'admin-insights',
            prompt: 'daily ops snapshot',
            responseSummary: JSON.stringify(summary),
            meta: summary,
        });

        return {
            summary,
            recommendations,
            generatedAt: new Date().toISOString(),
        };
    }

    private inferFilters(query: string) {
        const q = query.toLowerCase();

        let type: string | null = null;
        if (q.includes('مصنع') || q.includes('factory')) type = 'FACTORY';
        if (q.includes('متجر') || q.includes('محل') || q.includes('store')) type = 'STORE';
        if (q.includes('علامة') || q.includes('brand') || q.includes('trademark')) type = 'TRADEMARK';

        const cityMatch = query.match(/(الرياض|جدة|الدمام|مكة|الخبر|riyadh|jeddah|dammam|khobar)/i);
        const city = cityMatch ? cityMatch[1] : null;

        const numberMatch = query.match(/(\d{3,8})/);
        const maxPrice = numberMatch ? Number(numberMatch[1]) : null;

        return { type, city, maxPrice };
    }

    private extractKeywords(text: string) {
        const stop = new Set([
            'في', 'من', 'على', 'الى', 'إلى', 'the', 'and', 'for', 'with', 'this', 'that', 'عن', 'مع', 'منصة', 'عرض',
        ]);
        const words = text
            .replace(/[^\p{L}\p{N}\s]/gu, ' ')
            .split(/\s+/)
            .map((w) => w.trim())
            .filter((w) => w.length >= 3 && !stop.has(w.toLowerCase()));

        const freq = new Map<string, number>();
        for (const w of words) freq.set(w, (freq.get(w) || 0) + 1);

        return [...freq.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([word]) => word);
    }

    private limitWords(text: string, maxWords: number) {
        return text.split(/\s+/).slice(0, maxWords).join(' ');
    }

    private uniqueJoin(parts: string[], sep: string) {
        const dedup: string[] = [];
        for (const p of parts) {
            const clean = p.trim();
            if (!clean) continue;
            if (!dedup.includes(clean)) dedup.push(clean);
        }
        return dedup.join(sep);
    }

    private async priceComparable(type: string | null, category: string | null) {
        const conditions: string[] = [`status = 'APPROVED'`, `price IS NOT NULL`];
        const params: any[] = [];

        if (type) {
            params.push(type);
            conditions.push(`type = $${params.length}`);
        }

        if (category) {
            params.push(`%${category}%`);
            const idx = params.length;
            conditions.push(`(
                EXISTS (
                    SELECT 1 FROM categories c WHERE c.id = listings.category_id AND (c.name_ar ILIKE $${idx} OR c.name_en ILIKE $${idx})
                )
            )`);
        }

        const { rows } = await this.pool.query(
            `SELECT MIN(price)::numeric AS min_price,
                    MAX(price)::numeric AS max_price,
                    AVG(price)::numeric AS avg_price,
                    COUNT(*)::int AS count
             FROM listings
             WHERE ${conditions.join(' AND ')}`,
            params,
        );

        const row = rows[0];
        const count = Number(row?.count || 0);
        if (count < 3) return null;

        return {
            min: Number(row.min_price),
            max: Number(row.max_price),
            suggested: Math.round(Number(row.avg_price) * 100) / 100,
            count,
        };
    }

    private detectSupportTone(message: string) {
        const lower = message.toLowerCase();
        if (lower.includes('غاضب') || lower.includes('urgent') || lower.includes('immediately')) return 'escalated';
        if (lower.includes('شكرا') || lower.includes('thanks')) return 'friendly';
        return 'neutral';
    }

    private detectUrgency(message: string, priority: string) {
        const lower = message.toLowerCase();
        if (priority === 'CRITICAL' || lower.includes('fraud') || lower.includes('احتيال')) return 'CRITICAL';
        if (priority === 'HIGH' || lower.includes('failed') || lower.includes('فشل')) return 'HIGH';
        if (priority === 'MEDIUM') return 'MEDIUM';
        return 'LOW';
    }

    private buildArabicSupportDraft(subject: string, userMessage: string, tone: string, urgency: string) {
        const opener = tone === 'escalated'
            ? 'نقدّر استعجالك ونتعامل مع الحالة بأولوية عالية.'
            : 'شكرًا لتواصلك معنا.';
        return `${opener} بخصوص "${subject}", تم استلام رسالتك: "${userMessage}". سنقوم بمراجعة الحالة والتحقق من السجلات المرتبطة وتحديثك خلال أقرب وقت. مستوى الأولوية الحالي: ${urgency}.`;
    }

    private buildEnglishSupportDraft(subject: string, userMessage: string, tone: string, urgency: string) {
        const opener = tone === 'escalated'
            ? 'We understand the urgency and are prioritizing this case.'
            : 'Thank you for contacting support.';
        return `${opener} Regarding "${subject}", we received your note: "${userMessage}". We will review the related records and update you shortly. Current priority: ${urgency}.`;
    }

    private roleFromUserId(userId?: string | null): AiRole {
        if (!userId) return 'BUYER';
        return 'BUYER';
    }

    private async logAiRequest(input: {
        userId: string | null;
        role: AiRole;
        feature: string;
        prompt: string;
        responseSummary: string;
        meta?: Record<string, unknown>;
    }) {
        const hash = createHash('sha256').update(input.prompt).digest('hex');

        await this.pool.query(
            `INSERT INTO ai_requests (user_id, role, feature, prompt_hash, response_summary, meta)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
                input.userId,
                input.role,
                input.feature,
                hash,
                input.responseSummary.substring(0, 2000),
                JSON.stringify(input.meta || {}),
            ],
        );

        await this.auditService.log({
            actorUserId: input.userId || undefined,
            action: `ai.${input.feature}`,
            entityType: 'ai_request',
            entityId: hash,
            meta: { role: input.role },
        });
    }
}
