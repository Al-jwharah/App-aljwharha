'use client';

import { useEffect, useState } from 'react';
import { apiFetch, parseApiError } from '../../lib/api';
import { getAccessToken } from '../../lib/auth';
import { UIBadge, UIButton, UICard, UIEmptyState, useToast } from '../../components/ui-kit';

type SubscriptionInfo = {
    subscription: {
        id: string;
        plan_code: string;
        status: string;
        current_period_start: string;
        current_period_end: string;
    } | null;
    usage: {
        listings: number;
        auctions: number;
    };
};

export default function BillingPage() {
    const { push } = useToast();
    const [data, setData] = useState<SubscriptionInfo | null>(null);
    const [loading, setLoading] = useState(true);

    const load = async () => {
        const token = getAccessToken();
        if (!token) {
            setLoading(false);
            return;
        }

        try {
            const res = await apiFetch<SubscriptionInfo>('/subscriptions/me', {}, token);
            setData(res);
        } catch (err) {
            push(parseApiError(err));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    if (loading) {
        return <main className="page-shell"><UICard>جارٍ التحميل...</UICard></main>;
    }

    if (!getAccessToken()) {
        return (
            <main className="page-shell">
                <UIEmptyState title="تسجيل الدخول مطلوب" description="يرجى تسجيل الدخول لعرض حالة الفوترة." />
            </main>
        );
    }

    return (
        <main className="page-shell">
            <section className="page-section">
                <h1 className="page-title">الفوترة والحساب</h1>
                <p className="page-subtitle">متابعة حالة الاشتراك والفترة الحالية واستهلاك حدود التشغيل.</p>
            </section>

            {!data?.subscription ? (
                <UIEmptyState title="لا يوجد اشتراك نشط" description="يمكنك تفعيل باقة من صفحة الباقات." />
            ) : (
                <div className="page-grid-2">
                    <UICard>
                        <h2 style={{ marginBottom: 10 }}>الاشتراك الحالي</h2>
                        <p style={{ marginBottom: 8 }}><strong>الخطة:</strong> {data.subscription.plan_code}</p>
                        <p style={{ marginBottom: 8 }}><strong>الحالة:</strong> <UIBadge tone={data.subscription.status === 'ACTIVE' ? 'success' : 'warning'}>{data.subscription.status}</UIBadge></p>
                        <p style={{ marginBottom: 8 }}><strong>البداية:</strong> {new Date(data.subscription.current_period_start).toLocaleDateString('ar-SA')}</p>
                        <p style={{ marginBottom: 8 }}><strong>النهاية:</strong> {new Date(data.subscription.current_period_end).toLocaleDateString('ar-SA')}</p>
                    </UICard>

                    <UICard>
                        <h2 style={{ marginBottom: 10 }}>الاستهلاك الحالي</h2>
                        <p style={{ marginBottom: 8 }}><strong>الإعلانات:</strong> {data.usage.listings}</p>
                        <p style={{ marginBottom: 8 }}><strong>المزادات النشطة:</strong> {data.usage.auctions}</p>
                        <a href="/pricing"><UIButton type="button" style={{ marginTop: 12 }}>تغيير الباقة</UIButton></a>
                    </UICard>
                </div>
            )}
        </main>
    );
}
