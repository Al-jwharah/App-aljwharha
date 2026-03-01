'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiFetch, parseApiError } from '../../lib/api';
import { UIBadge, UIButton, UICard, UIEmptyState, UIInput, UISelect, UISkeleton, useToast } from '../../components/ui-kit';

type AuctionItem = {
    id: string;
    title: string;
    city?: string;
    status: string;
    current_price: string;
    starting_price: string;
    ends_at: string;
    bid_count?: number;
};

export default function AuctionsPage() {
    const { push } = useToast();
    const [items, setItems] = useState<AuctionItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState('LIVE');
    const [q, setQ] = useState('');

    useEffect(() => {
        let active = true;
        setLoading(true);

        const params = new URLSearchParams();
        params.set('page', '1');
        params.set('pageSize', '24');
        if (status) params.set('status', status);
        if (q.trim()) params.set('q', q.trim());

        apiFetch<{ items: AuctionItem[] }>(`/auctions?${params.toString()}`)
            .then((res) => {
                if (!active) return;
                setItems(res.items || []);
            })
            .catch((err) => {
                if (!active) return;
                push(parseApiError(err));
            })
            .finally(() => {
                if (active) setLoading(false);
            });

        return () => {
            active = false;
        };
    }, [push, q, status]);

    return (
        <main className="page-shell">
            <section className="page-section">
                <h1 className="page-title">المزادات المباشرة</h1>
                <p className="page-subtitle">مزادات حقيقية مع آلية anti-sniping وتعيين فائز تلقائي.</p>
            </section>

            <UICard className="page-section">
                <div className="page-grid-3" style={{ alignItems: 'end' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: 6 }}>الحالة</label>
                        <UISelect value={status} onChange={(e) => setStatus(e.target.value)}>
                            <option value="LIVE">مباشر</option>
                            <option value="ENDED">منتهي</option>
                            <option value="DRAFT">مسودات</option>
                            <option value="CANCELLED">ملغي</option>
                            <option value="">الكل</option>
                        </UISelect>
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: 6 }}>بحث</label>
                        <UIInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="اسم الأصل أو المدينة" />
                    </div>
                    <div>
                        <Link href="/my-bids" style={{ width: '100%' }}>
                            <UIButton type="button" style={{ width: '100%' }}>مزايداتي</UIButton>
                        </Link>
                    </div>
                </div>
            </UICard>

            {loading ? (
                <div className="page-grid-3">
                    {Array.from({ length: 6 }).map((_, idx) => (
                        <UICard key={idx}>
                            <UISkeleton height={20} width="60%" />
                            <div style={{ height: 10 }} />
                            <UISkeleton height={14} width="40%" />
                        </UICard>
                    ))}
                </div>
            ) : items.length === 0 ? (
                <UIEmptyState title="لا توجد مزادات" description="لا توجد مزادات مطابقة للفلاتر الآن." />
            ) : (
                <div className="page-grid-3">
                    {items.map((auction) => {
                        const endsAt = new Date(auction.ends_at);
                        const now = new Date();
                        const remainingMs = endsAt.getTime() - now.getTime();
                        const hours = Math.max(0, Math.floor(remainingMs / 3600000));
                        const mins = Math.max(0, Math.floor((remainingMs % 3600000) / 60000));

                        return (
                            <UICard key={auction.id}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                    <UIBadge tone={auction.status === 'LIVE' ? 'success' : 'info'}>{auction.status}</UIBadge>
                                    <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{auction.bid_count || 0} مزايدة</span>
                                </div>
                                <h3 style={{ marginBottom: 8 }}>{auction.title}</h3>
                                <p style={{ color: 'var(--color-text-muted)', marginBottom: 6 }}>{auction.city || '—'}</p>
                                <p style={{ fontFamily: 'var(--font-latin)', fontWeight: 700, marginBottom: 8 }}>
                                    {Number(auction.current_price || auction.starting_price || 0).toLocaleString('en-US')} SAR
                                </p>
                                <p style={{ color: 'var(--color-text-muted)', marginBottom: 10 }}>
                                    ينتهي خلال: {hours}س {mins}د
                                </p>
                                <Link href={`/auctions/${auction.id}`}>
                                    <UIButton type="button" style={{ width: '100%' }}>تفاصيل المزاد</UIButton>
                                </Link>
                            </UICard>
                        );
                    })}
                </div>
            )}
        </main>
    );
}
