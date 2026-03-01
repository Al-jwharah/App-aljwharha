'use client';

import { useEffect, useState } from 'react';
import { apiFetch, parseApiError } from '../../lib/api';
import { getAccessToken } from '../../lib/auth';
import { UIBadge, UIButton, UICard, UIEmptyState, UISkeleton, useToast } from '../../components/ui-kit';

type Plan = {
    code: string;
    title_ar: string;
    title_en: string;
    price_amount: string;
    currency: string;
    period: string;
    commission_bps_override?: number | null;
    listing_limit: number;
    auction_limit: number;
    ad_credit_amount: string;
    support_sla: string;
};

export default function PricingPage() {
    const { push } = useToast();
    const [plans, setPlans] = useState<Plan[]>([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<string | null>(null);

    useEffect(() => {
        apiFetch<{ items: Plan[] }>('/plans')
            .then((res) => setPlans(res.items || []))
            .catch((err) => push(parseApiError(err)))
            .finally(() => setLoading(false));
    }, [push]);

    const startSubscription = async (planCode: string) => {
        const token = getAccessToken();
        if (!token) {
            push('يرجى تسجيل الدخول لاختيار الباقة');
            return;
        }

        setSelected(planCode);
        try {
            const created = await apiFetch<{ subscription: { id: string }; requiresPayment: boolean }>(
                '/subscriptions',
                {
                    method: 'POST',
                    body: JSON.stringify({ planCode }),
                },
                token,
            );

            if (created.requiresPayment) {
                const payment = await apiFetch<{ transactionUrl?: string }>(
                    `/subscriptions/${created.subscription.id}/pay`,
                    { method: 'POST' },
                    token,
                );

                if (payment.transactionUrl) {
                    window.location.href = payment.transactionUrl;
                    return;
                }
            }

            push('تم تفعيل الباقة بنجاح');
        } catch (err) {
            push(parseApiError(err));
        } finally {
            setSelected(null);
        }
    };

    return (
        <main className="page-shell">
            <section className="page-section">
                <h1 className="page-title">الباقات والاشتراكات</h1>
                <p className="page-subtitle">اختَر الباقة المناسبة وفعّلها فوراً عبر Tap مع فرض حدود التشغيل تلقائيًا.</p>
            </section>

            {loading ? (
                <div className="page-grid-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <UICard key={i}><UISkeleton height={24} width="50%" /></UICard>
                    ))}
                </div>
            ) : plans.length === 0 ? (
                <UIEmptyState title="لا توجد باقات" description="تعذر تحميل الباقات حالياً." />
            ) : (
                <div className="page-grid-3">
                    {plans.map((plan) => (
                        <UICard key={plan.code}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                <h2>{plan.title_ar}</h2>
                                <UIBadge tone={plan.code === 'ENTERPRISE' ? 'warning' : 'info'}>{plan.code}</UIBadge>
                            </div>
                            <p style={{ color: 'var(--color-text-muted)', marginBottom: 10 }}>
                                عمولة {plan.commission_bps_override ? `${Number(plan.commission_bps_override) / 100}%` : 'افتراضية'}
                            </p>
                            <p style={{ fontFamily: 'var(--font-latin)', fontWeight: 800, fontSize: '1.3rem', marginBottom: 10 }}>
                                {Number(plan.price_amount || 0).toLocaleString('en-US')} {plan.currency} / {plan.period === 'MONTHLY' ? 'شهري' : 'سنوي'}
                            </p>
                            <ul style={{ marginBottom: 14, color: 'var(--color-text-muted)', lineHeight: 1.9 }}>
                                <li>حد الإعلانات: {plan.listing_limit}</li>
                                <li>حد المزادات النشطة: {plan.auction_limit}</li>
                                <li>رصيد إعلانات: {Number(plan.ad_credit_amount || 0).toLocaleString('en-US')} {plan.currency}</li>
                                <li>SLA الدعم: {plan.support_sla}</li>
                            </ul>
                            <UIButton
                                type="button"
                                style={{ width: '100%' }}
                                disabled={selected === plan.code}
                                onClick={() => startSubscription(plan.code)}
                            >
                                {selected === plan.code ? 'جارٍ المعالجة...' : 'اشترك الآن'}
                            </UIButton>
                        </UICard>
                    ))}
                </div>
            )}
        </main>
    );
}
