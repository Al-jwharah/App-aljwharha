'use client';

import { useEffect, useMemo, useState } from 'react';

export default function AdminRevenuePage() {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'https://api.aljwharah.ai';

    const [summary, setSummary] = useState<any>(null);
    const [range, setRange] = useState('30');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const token = useMemo(
        () => (typeof window !== 'undefined' ? localStorage.getItem('aljwharah_token') : null),
        [],
    );

    const load = async (days: string) => {
        if (!token) {
            setError('يرجى تسجيل الدخول كمدير');
            return;
        }

        setLoading(true);
        setError('');

        const to = new Date().toISOString();
        const from = new Date(Date.now() - Number(days) * 86400000).toISOString();

        try {
            const res = await fetch(`${apiBase}/admin/revenue/summary?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error('تعذر تحميل تقرير الإيرادات');
            setSummary(await res.json());
        } catch (err: any) {
            setError(err.message || 'تعذر تحميل تقرير الإيرادات');
            setSummary(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void load(range);
    }, []);

    const cards = summary ? [
        { label: 'إجمالي الطلبات', value: summary.orders_count },
        { label: 'الطلبات المدفوعة', value: summary.paid_orders_count },
        { label: 'إجمالي المبيعات (Gross)', value: `${Number(summary.gross_total_sum).toFixed(2)} ر.س` },
        { label: 'رسوم المنصة (Paid)', value: `${Number(summary.paid_platform_fee_sum).toFixed(2)} ر.س` },
        { label: 'صافي رسوم المنصة', value: `${Number(summary.net_platform_fee_sum).toFixed(2)} ر.س` },
        { label: 'طلبات مسترجعة', value: summary.refunded_orders_count },
    ] : [];

    return (
        <div>
            <h2 style={{ marginBottom: '16px' }}>تقرير الإيرادات</h2>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                {['7', '30', '90'].map((d) => (
                    <button
                        key={d}
                        onClick={() => {
                            setRange(d);
                            void load(d);
                        }}
                        style={{
                            padding: '8px 16px',
                            borderRadius: '8px',
                            border: '1px solid var(--color-border)',
                            background: range === d ? 'var(--color-accent-strong)' : 'var(--color-surface)',
                            color: range === d ? '#fff' : 'var(--color-text-primary)',
                            cursor: 'pointer',
                            fontWeight: 600,
                        }}
                    >
                        {d === '7' ? 'آخر 7 أيام' : d === '30' ? 'آخر 30 يوم' : 'آخر 90 يوم'}
                    </button>
                ))}
            </div>

            {loading ? <p>جاري التحميل...</p> : null}
            {error ? <p style={{ color: 'var(--color-danger)' }}>{error}</p> : null}

            {summary ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px' }}>
                    {cards.map((c, i) => (
                        <div
                            key={i}
                            style={{
                                background: 'var(--color-surface)',
                                borderRadius: '12px',
                                padding: '16px',
                                border: '1px solid var(--color-border)',
                                textAlign: 'center',
                            }}
                        >
                            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginBottom: '4px' }}>{c.label}</p>
                            <p style={{ fontSize: '1.2rem', fontWeight: 700 }}>{c.value}</p>
                        </div>
                    ))}
                </div>
            ) : null}
        </div>
    );
}