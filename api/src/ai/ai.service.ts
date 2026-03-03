import { Injectable, Inject, BadRequestException, ForbiddenException, NotFoundException, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { DATABASE_POOL } from '../database/database.module';
import { AuditService } from '../audit/audit.service';

type AiRole = 'BUYER' | 'SELLER' | 'ADMIN';
type AgentMode = 'llm' | 'fallback';
type AgentProvider = 'openai' | 'internal';
type AgentResult<T> = {
    mode: AgentMode;
    provider: AgentProvider;
    model: string;
    data: T | null;
    error?: string;
};
type AgentMeta = {
    mode: AgentMode;
    provider: AgentProvider;
    model: string;
    llmEnabled: boolean;
    fallbackReason?: string;
};

@Injectable()
export class AiService {
    private readonly logger = new Logger(AiService.name);
    private readonly llmApiKey: string;
    private readonly llmModel: string;
    private readonly llmResponsesUrl: string;
    private readonly llmTimeoutMs: number;
    constructor(
        @Inject(DATABASE_POOL) private readonly pool: any,
        private readonly auditService: AuditService,
        private readonly configService: ConfigService,
    ) {
        this.llmApiKey = (this.configService.get<string>('OPENAI_API_KEY') || '').trim();
        this.llmModel = (this.configService.get<string>('OPENAI_MODEL') || 'gpt-5').trim();
        this.llmResponsesUrl = (this.configService.get<string>('OPENAI_RESPONSES_URL') || 'https://api.openai.com/v1/responses').trim();
        const timeoutCandidate = Number(this.configService.get<string>('OPENAI_TIMEOUT_MS') || 15000);
        this.llmTimeoutMs = Number.isFinite(timeoutCandidate) && timeoutCandidate > 0 ? timeoutCandidate : 15000;
    }

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

        const fallbackNarrative = locale.startsWith('ar')
            ? `تم تحليل الاستعلام وإرجاع ${rows.length} نتيجة مع مطابقة للنوع/المدينة/السقف السعري عند توفرها.`
            : `The query was analyzed and returned ${rows.length} results with optional type/city/price constraints.`;
        const fallbackNextActions = locale.startsWith('ar')
            ? ['تضييق البحث بالمدينة أو نوع الأصل.', 'استخدم سقفًا سعريًا أدق.', 'راجع الإعلانات الأحدث أولًا.']
            : ['Narrow by city or asset type.', 'Use a tighter budget cap.', 'Review most recent listings first.'];
        const fallbackRiskNotes = locale.startsWith('ar')
            ? ['تحقق من المستندات القانونية قبل الدفع.', 'قارن السعر بعينات مشابهة قبل التفاوض.']
            : ['Verify legal documents before payment.', 'Benchmark price against similar assets before negotiation.'];

        const agentEnhancement = await this.generateAgentJson<{
            narrative?: string;
            nextActions?: string[];
            riskNotes?: string[];
        }>({
            feature: 'search',
            systemPrompt: locale.startsWith('ar')
                ? 'أنت وكيل بحث احترافي لمنصة تداول أصول صناعية. أرجع JSON فقط بمفاتيح narrative وnextActions وriskNotes.'
                : 'You are a professional search agent for an industrial asset marketplace. Return JSON only with narrative, nextActions, and riskNotes.',
            userPayload: {
                query: clean,
                inferredFilters: inferred,
                topSuggestions: suggestions,
                resultsCount: rows.length,
            },
            maxTokens: 600,
        });

        const agentMeta = this.toAgentMeta(agentEnhancement);
        const agentNarrative = (agentEnhancement.data?.narrative || fallbackNarrative).trim();
        const agentNextActions = this.pickList(agentEnhancement.data?.nextActions, fallbackNextActions, 5);
        const agentRiskNotes = this.pickList(agentEnhancement.data?.riskNotes, fallbackRiskNotes, 4);

        const role = await this.resolveAiRole(userId);

        await this.logAiRequest({
            userId: userId || null,
            role,
            feature: 'search',
            prompt: clean,
            responseSummary: `results=${rows.length};mode=${agentMeta.mode}`,
            meta: { inferred, agentMode: agentMeta.mode, llmModel: agentMeta.model },
        });

        return {
            query: clean,
            inferredFilters: inferred,
            resultsCount: rows.length,
            suggestions,
            results: rows,
            agent: {
                ...agentMeta,
                narrative: agentNarrative,
                nextActions: agentNextActions,
                riskNotes: agentRiskNotes,
            },
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

        const deterministicKeywords = this.extractKeywords(`${source.title} ${source.description}`);
        const deterministicTitlePieces = [source.title.trim(), ...deterministicKeywords.slice(0, 3)].filter(Boolean);
        const deterministicTitle = this.limitWords(this.uniqueJoin(deterministicTitlePieces, ' - '), 14);

        const enhancedDescriptionParts = [
            source.description.trim(),
            source.city ? `الموقع: ${source.city}.` : '',
            source.category ? `الفئة: ${source.category}.` : '',
            deterministicKeywords.length ? `الكلمات الدالة: ${deterministicKeywords.slice(0, 5).join('، ')}.` : '',
            'يرجى إرفاق وثائق الملكية والبيانات التشغيلية الكاملة لرفع موثوقية الطلب.',
        ].filter(Boolean);

        const deterministicDescription = enhancedDescriptionParts.join(' ');

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

        const enhancement = await this.generateAgentJson<{
            title?: string;
            description?: string;
            keywords?: string[];
        }>({
            feature: 'listing-improve',
            systemPrompt: 'أنت وكيل كتابة إعلانية احترافي لمنصة B2B صناعية. أعد JSON فقط بمفاتيح title وdescription وkeywords. العنوان لا يزيد عن 14 كلمة والوصف مهني مباشر.',
            userPayload: {
                source,
                deterministicTitle,
                deterministicDescription,
                priceGuidance: guidance,
            },
            maxTokens: 700,
        });

        const agentMeta = this.toAgentMeta(enhancement);
        const llmTitle = typeof enhancement.data?.title === 'string' ? enhancement.data.title : '';
        const llmDescription = typeof enhancement.data?.description === 'string' ? enhancement.data.description : '';

        const mergedKeywords = [
            ...this.pickList(enhancement.data?.keywords, [], 10),
            ...deterministicKeywords,
        ];
        const keywords = [...new Set(mergedKeywords.map((item) => item.trim()).filter(Boolean))].slice(0, 10);

        const improvedTitle = this.limitWords((llmTitle || deterministicTitle).replace(/\s+/g, ' ').trim(), 14);
        const improvedDescription = (llmDescription || deterministicDescription).replace(/\s+/g, ' ').trim();

        await this.logAiRequest({
            userId,
            role: 'SELLER',
            feature: 'listing-improve',
            prompt: `${source.title}\n${source.description}`,
            responseSummary: `title=${improvedTitle.substring(0, 60)};mode=${agentMeta.mode}`,
            meta: { listingId: input.listingId || null, keywords, agentMode: agentMeta.mode, llmModel: agentMeta.model },
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
            agent: agentMeta,
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
        const fallbackTone = this.detectSupportTone(userMessage);
        const fallbackUrgency = this.detectUrgency(userMessage, ticket.priority);
        const fallbackDraft = locale.startsWith('ar')
            ? this.buildArabicSupportDraft(ticket.subject, userMessage, fallbackTone, fallbackUrgency)
            : this.buildEnglishSupportDraft(ticket.subject, userMessage, fallbackTone, fallbackUrgency);
        const fallbackSuggestions = [
            locale.startsWith('ar') ? 'تحقق من حالة الدفع المرتبطة بالطلب إن وُجد.' : 'Check the related payment status if applicable.',
            locale.startsWith('ar') ? 'أضف توقيتًا متوقعًا للرد القادم.' : 'Add an expected next update time.',
            locale.startsWith('ar') ? 'اطلب مستندات داعمة إذا كانت الحالة نزاع ملكية.' : 'Request supporting documents for ownership disputes.',
        ];

        const enhancement = await this.generateAgentJson<{
            draft?: string;
            tone?: string;
            urgency?: string;
            suggestions?: string[];
        }>({
            feature: 'support-draft',
            systemPrompt: locale.startsWith('ar')
                ? 'أنت وكيل دعم احترافي. أعد JSON فقط بمفاتيح draft وtone وurgency وsuggestions. tone واحدة من: escalated,friendly,neutral. urgency واحدة من: CRITICAL,HIGH,MEDIUM,LOW.'
                : 'You are a professional support agent. Return JSON only with draft, tone, urgency, suggestions. tone in escalated/friendly/neutral and urgency in CRITICAL/HIGH/MEDIUM/LOW.',
            userPayload: {
                ticket: {
                    id: ticket.id,
                    subject: ticket.subject,
                    category: ticket.category,
                    priority: ticket.priority,
                    status: ticket.status,
                    recentMessages: ticket.recent_messages,
                },
                userMessage,
                fallbackTone,
                fallbackUrgency,
            },
            maxTokens: 700,
        });

        const agentMeta = this.toAgentMeta(enhancement);
        const tone = this.sanitizeTone(enhancement.data?.tone || fallbackTone);
        const urgency = this.sanitizeUrgency(enhancement.data?.urgency || fallbackUrgency);
        const draft = typeof enhancement.data?.draft === 'string' && enhancement.data.draft.trim()
            ? enhancement.data.draft.trim()
            : fallbackDraft;
        const suggestions = this.pickList(enhancement.data?.suggestions, fallbackSuggestions, 5);

        await this.logAiRequest({
            userId: actorUserId,
            role: 'ADMIN',
            feature: 'support-draft',
            prompt: `${ticket.subject}\n${userMessage}`,
            responseSummary: `urgency=${urgency};mode=${agentMeta.mode}`,
            meta: { ticketId, urgency, tone, agentMode: agentMeta.mode, llmModel: agentMeta.model },
        });

        return {
            ticketId,
            urgency,
            tone,
            draft,
            suggestions,
            agent: agentMeta,
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

        const fallbackRecommendations: string[] = [];
        if (summary.stuckOrders > 0) fallbackRecommendations.push('تشغيل reconcile للمدفوعات ومراجعة reservations المنتهية.');
        if (summary.failedPayments24h > 5) fallbackRecommendations.push('مراجعة فشل الدفع مع Tap وتحليل الأسباب المتكررة.');
        if (summary.suspiciousBidPatterns > 0) fallbackRecommendations.push('مراجعة حسابات المزايدة ذات النشاط غير الطبيعي وتطبيق فحص إضافي.');
        if (summary.highPriorityTickets > 0) fallbackRecommendations.push('تخصيص وكلاء دعم إضافيين لتذاكر الأولوية العالية.');
        if (fallbackRecommendations.length === 0) fallbackRecommendations.push('مؤشرات التشغيل مستقرة خلال الفترة الحالية.');

        const enhancement = await this.generateAgentJson<{
            narrative?: string;
            recommendations?: string[];
            priorities?: string[];
        }>({
            feature: 'admin-insights',
            systemPrompt: 'أنت وكيل عمليات احترافي لمنصة تداول B2B. أعد JSON فقط بمفاتيح narrative وrecommendations وpriorities.',
            userPayload: {
                summary,
                fallbackRecommendations,
            },
            maxTokens: 700,
        });

        const agentMeta = this.toAgentMeta(enhancement);
        const recommendations = this.pickList(enhancement.data?.recommendations, fallbackRecommendations, 6);
        const priorities = this.pickList(
            enhancement.data?.priorities,
            [
                'سلامة دورة الطلب والدفع',
                'خفض فشل المدفوعات',
                'ضبط نزاهة المزادات',
                'رفع سرعة الاستجابة للدعم',
            ],
            5,
        );

        const narrative = typeof enhancement.data?.narrative === 'string' && enhancement.data.narrative.trim()
            ? enhancement.data.narrative.trim()
            : 'ملخص تشغيلي يومي مبني على مؤشرات حية للأوامر، المدفوعات، المزادات، والدعم.';

        await this.logAiRequest({
            userId: actorUserId,
            role: 'ADMIN',
            feature: 'admin-insights',
            prompt: 'daily ops snapshot',
            responseSummary: JSON.stringify({ ...summary, mode: agentMeta.mode }),
            meta: { ...summary, agentMode: agentMeta.mode, llmModel: agentMeta.model },
        });

        return {
            summary,
            recommendations,
            priorities,
            narrative,
            generatedAt: new Date().toISOString(),
            agent: agentMeta,
        };
    }
    async agentReport(actorUserId: string) {
        const [
            usageRows,
            featureRows,
            roleRows,
            stuckOrders,
            failedPayments,
            suspiciousBids,
            pendingTickets,
        ] = await Promise.all([
            this.pool.query(
                `SELECT
                    COUNT(*)::int AS total,
                    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours')::int AS last_24h
                 FROM ai_requests
                 WHERE created_at >= NOW() - INTERVAL '30 days'`,
            ),
            this.pool.query(
                `SELECT feature, COUNT(*)::int AS count
                 FROM ai_requests
                 WHERE created_at >= NOW() - INTERVAL '30 days'
                 GROUP BY feature
                 ORDER BY count DESC, feature ASC
                 LIMIT 10`,
            ),
            this.pool.query(
                `SELECT role, COUNT(*)::int AS count
                 FROM ai_requests
                 WHERE created_at >= NOW() - INTERVAL '30 days'
                 GROUP BY role
                 ORDER BY count DESC, role ASC`,
            ),
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

        const usage = {
            total30d: usageRows.rows[0]?.total ?? 0,
            last24h: usageRows.rows[0]?.last_24h ?? 0,
        };

        const topFeatures = featureRows.rows.map((row: any) => ({
            feature: row.feature,
            count: Number(row.count) || 0,
        }));

        const usageByRole = roleRows.rows.map((row: any) => ({
            role: row.role,
            count: Number(row.count) || 0,
        }));

        const platformIndicators = {
            stuckOrders: stuckOrders.rows[0]?.count ?? 0,
            failedPayments24h: failedPayments.rows[0]?.count ?? 0,
            suspiciousBidPatterns: suspiciousBids.rows[0]?.count ?? 0,
            highPriorityTickets: pendingTickets.rows[0]?.count ?? 0,
        };

        const fallbackReport = {
            executiveSummary: 'تم تفعيل الوكيل الذكي على عمليات البحث، تحسين الإعلانات، وصياغة الدعم مع تتبع تدقيقي كامل.',
            strongestAdvantages: [
                'تشغيل موحد عبر السوق والدعم والإدارة ضمن API واحدة.',
                'تحسين تلقائي للمخرجات مع fallback آمن عند غياب مفاتيح LLM.',
                'سجل تدقيق AI Requests + Audit Log لكل عملية حساسة.',
                'قابلية تشغيل نموذج أقوى عبر متغير OPENAI_MODEL دون تغيير الكود.',
            ],
            completionChecklist: [
                'تفعيل تكامل نموذج LLM اختياري (OpenAI).',
                'دعم fallback داخلي لضمان الاستمرارية.',
                'توليد تقرير تنفيذي للوكيل مع مؤشرات تشغيل.',
                'تسجيل كل استدعاء AI لأغراض الحوكمة والتتبع.',
            ],
            nextMilestones: [
                'ضبط OPENAI_API_KEY في بيئة الإنتاج.',
                'اختبار A/B بين نموذجين عبر OPENAI_MODEL.',
                'إضافة قواعد تقييم جودة الاستجابات (quality scoring).',
            ],
        };

        const enhancement = await this.generateAgentJson<{
            executiveSummary?: string;
            strongestAdvantages?: string[];
            completionChecklist?: string[];
            nextMilestones?: string[];
        }>({
            feature: 'agent-report',
            systemPrompt: 'أنت مستشار تنفيذي للذكاء الاصطناعي في منصة تجارة B2B. أعد JSON فقط بمفاتيح executiveSummary وstrongestAdvantages وcompletionChecklist وnextMilestones.',
            userPayload: {
                usage,
                topFeatures,
                usageByRole,
                platformIndicators,
                fallbackReport,
            },
            maxTokens: 900,
        });

        const agentMeta = this.toAgentMeta(enhancement);

        const report = {
            executiveSummary: typeof enhancement.data?.executiveSummary === 'string' && enhancement.data.executiveSummary.trim()
                ? enhancement.data.executiveSummary.trim()
                : fallbackReport.executiveSummary,
            strongestAdvantages: this.pickList(enhancement.data?.strongestAdvantages, fallbackReport.strongestAdvantages, 6),
            completionChecklist: this.pickList(enhancement.data?.completionChecklist, fallbackReport.completionChecklist, 8),
            nextMilestones: this.pickList(enhancement.data?.nextMilestones, fallbackReport.nextMilestones, 6),
        };

        await this.logAiRequest({
            userId: actorUserId,
            role: 'ADMIN',
            feature: 'agent-report',
            prompt: 'ai agent execution report',
            responseSummary: `total30d=${usage.total30d};mode=${agentMeta.mode}`,
            meta: { usage, topFeatures, platformIndicators, agentMode: agentMeta.mode, llmModel: agentMeta.model },
        });

        return {
            generatedAt: new Date().toISOString(),
            usageWindowDays: 30,
            usage,
            topFeatures,
            usageByRole,
            platformIndicators,
            report,
            agent: agentMeta,
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

    private sanitizeTone(input: string) {
        const normalized = (input || '').toLowerCase();
        if (normalized === 'escalated' || normalized === 'friendly' || normalized === 'neutral') {
            return normalized;
        }
        return 'neutral';
    }

    private sanitizeUrgency(input: string) {
        const normalized = (input || '').toUpperCase();
        if (normalized === 'CRITICAL' || normalized === 'HIGH' || normalized === 'MEDIUM' || normalized === 'LOW') {
            return normalized;
        }
        return 'LOW';
    }

    private async resolveAiRole(userId?: string | null): Promise<AiRole> {
        if (!userId) return 'BUYER';

        try {
            const { rows } = await this.pool.query('SELECT role FROM users WHERE id = $1 LIMIT 1', [userId]);
            const rawRole = rows[0]?.role as string | undefined;
            return this.normalizeRole(rawRole);
        } catch (error: any) {
            this.logger.warn(`Failed to resolve AI role for user ${userId}: ${error?.message || 'unknown error'}`);
            return 'BUYER';
        }
    }

    private normalizeRole(rawRole?: string | null): AiRole {
        const role = (rawRole || '').toUpperCase();
        if (role === 'SELLER') return 'SELLER';
        if (role === 'ADMIN' || role === 'SUPERADMIN' || role === 'AGENT' || role === 'OWNER') return 'ADMIN';
        return 'BUYER';
    }

    private isLlmEnabled() {
        return this.llmApiKey.length > 0;
    }

    private toAgentMeta<T>(result: AgentResult<T>): AgentMeta {
        return {
            mode: result.mode,
            provider: result.provider,
            model: result.model,
            llmEnabled: this.isLlmEnabled(),
            fallbackReason: result.error,
        };
    }

    private pickList(value: unknown, fallback: string[], maxItems: number) {
        if (!Array.isArray(value)) return fallback.slice(0, maxItems);
        const cleaned = value
            .map((item) => (typeof item === 'string' ? item.trim() : ''))
            .filter((item) => item.length > 0);

        if (cleaned.length === 0) return fallback.slice(0, maxItems);
        return [...new Set(cleaned)].slice(0, maxItems);
    }

    private async generateAgentJson<T>(input: {
        feature: string;
        systemPrompt: string;
        userPayload: unknown;
        maxTokens?: number;
    }): Promise<AgentResult<T>> {
        if (!this.isLlmEnabled()) {
            return {
                mode: 'fallback',
                provider: 'internal',
                model: 'deterministic',
                data: null,
                error: 'OPENAI_API_KEY is not configured',
            };
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.llmTimeoutMs);

        try {
            const response = await fetch(this.llmResponsesUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${this.llmApiKey}`,
                },
                body: JSON.stringify({
                    model: this.llmModel,
                    input: [
                        {
                            role: 'system',
                            content: `${input.systemPrompt}\nاعرض JSON فقط بدون أي نص إضافي.`,
                        },
                        {
                            role: 'user',
                            content: JSON.stringify(input.userPayload),
                        },
                    ],
                    max_output_tokens: input.maxTokens || 900,
                }),
                signal: controller.signal,
            });

            if (!response.ok) {
                const text = await response.text();
                return {
                    mode: 'fallback',
                    provider: 'internal',
                    model: this.llmModel,
                    data: null,
                    error: `LLM request failed (${response.status}): ${text.substring(0, 500)}`,
                };
            }

            const payload = await response.json();
            const rawText = this.extractResponseText(payload);
            const parsed = this.parseJsonFromText<T>(rawText);

            if (!parsed) {
                return {
                    mode: 'fallback',
                    provider: 'internal',
                    model: this.llmModel,
                    data: null,
                    error: 'LLM response is not valid JSON',
                };
            }

            return {
                mode: 'llm',
                provider: 'openai',
                model: this.llmModel,
                data: parsed,
            };
        } catch (error: any) {
            return {
                mode: 'fallback',
                provider: 'internal',
                model: this.llmModel,
                data: null,
                error: error?.name === 'AbortError' ? 'LLM request timed out' : (error?.message || 'LLM request failed'),
            };
        } finally {
            clearTimeout(timeout);
        }
    }

    private extractResponseText(payload: any): string {
        if (typeof payload?.output_text === 'string' && payload.output_text.trim()) {
            return payload.output_text;
        }

        if (Array.isArray(payload?.output)) {
            const chunks: string[] = [];

            for (const item of payload.output) {
                if (!Array.isArray(item?.content)) continue;
                for (const content of item.content) {
                    if (typeof content?.text === 'string') {
                        chunks.push(content.text);
                    } else if (typeof content?.output_text === 'string') {
                        chunks.push(content.output_text);
                    }
                }
            }

            if (chunks.length > 0) return chunks.join('\n');
        }

        if (typeof payload?.content === 'string') return payload.content;
        return '';
    }

    private parseJsonFromText<T>(text: string): T | null {
        const raw = text.trim();
        if (!raw) return null;

        try {
            return JSON.parse(raw) as T;
        } catch {
            // continue with extraction strategies
        }

        const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
        if (fenced?.[1]) {
            try {
                return JSON.parse(fenced[1].trim()) as T;
            } catch {
                // continue
            }
        }

        const firstObjectStart = raw.indexOf('{');
        const lastObjectEnd = raw.lastIndexOf('}');
        if (firstObjectStart >= 0 && lastObjectEnd > firstObjectStart) {
            const maybeObject = raw.slice(firstObjectStart, lastObjectEnd + 1);
            try {
                return JSON.parse(maybeObject) as T;
            } catch {
                // continue
            }
        }

        const firstArrayStart = raw.indexOf('[');
        const lastArrayEnd = raw.lastIndexOf(']');
        if (firstArrayStart >= 0 && lastArrayEnd > firstArrayStart) {
            const maybeArray = raw.slice(firstArrayStart, lastArrayEnd + 1);
            try {
                return JSON.parse(maybeArray) as T;
            } catch {
                // ignore
            }
        }

        return null;
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







