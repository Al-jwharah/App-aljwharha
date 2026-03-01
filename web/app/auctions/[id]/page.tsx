'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiFetch, parseApiError } from '../../../lib/api';
import { getAccessToken } from '../../../lib/auth';
import { UIBadge, UIButton, UICard, UIEmptyState, UIInput, UISkeleton, useToast } from '../../../components/ui-kit';

type AuctionDetail = {
    id: string;
    title: string;
    description?: string;
    city?: string;
    status: string;
    current_price: string;
    starting_price: string;
    bid_increment: string;
    ends_at: string;
    bid_count: number;
    my_max_bid?: number | null;
};

export default function AuctionDetailPage() {
    const params = useParams<{ id: string }>();
    const auctionId = String(params.id);
    const { push } = useToast();

    const [item, setItem] = useState<AuctionDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [bidAmount, setBidAmount] = useState('');
    const [placing, setPlacing] = useState(false);

    const load = async () => {
        try {
            const token = getAccessToken();
            const res = await apiFetch<AuctionDetail>(`/auctions/${auctionId}`, {}, token);
            setItem(res);
        } catch (err) {
            push(parseApiError(err));
            setItem(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
        const timer = setInterval(load, 8000);
        return () => clearInterval(timer);
    }, [auctionId]);

    const minBid = useMemo(() => {
        if (!item) return 0;
        const current = Number(item.current_price || item.starting_price || 0);
        const increment = Number(item.bid_increment || 0);
        if (item.bid_count > 0) return current + increment;
        return Number(item.starting_price || 0);
    }, [item]);

    if (loading) {
        return (
            <main className="page-shell">
                <UICard>
                    <UISkeleton height={24} width="40%" />
                    <div style={{ height: 10 }} />
                    <UISkeleton height={16} width="75%" />
                </UICard>
            </main>
        );
    }

    if (!item) {
        return (
            <main className="page-shell">
                <UIEmptyState title="المزاد غير متاح" description="تعذر تحميل بيانات المزاد المطلوب." />
            </main>
        );
    }

    const endsAt = new Date(item.ends_at);
    const now = new Date();
    const remMs = Math.max(0, endsAt.getTime() - now.getTime());
    const h = Math.floor(remMs / 3600000);
    const m = Math.floor((remMs % 3600000) / 60000);
    const s = Math.floor((remMs % 60000) / 1000);

    return (
        <main className="page-shell">
            <section className="page-grid-2">
                <UICard>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <h1 style={{ fontSize: '1.4rem' }}>{item.title}</h1>
                        <UIBadge tone={item.status === 'LIVE' ? 'success' : 'info'}>{item.status}</UIBadge>
                    </div>
                    <p style={{ color: 'var(--color-text-muted)', marginBottom: 10 }}>{item.city || '—'}</p>
                    <p style={{ marginBottom: 12 }}>{item.description || 'لا يوجد وصف إضافي.'}</p>

                    <div style={{ display: 'grid', gap: 8 }}>
                        <p><strong>السعر الحالي:</strong> {Number(item.current_price || 0).toLocaleString('en-US')} SAR</p>
                        <p><strong>أقل مزايدة تالية:</strong> {minBid.toLocaleString('en-US')} SAR</p>
                        <p><strong>ينتهي خلال:</strong> {h}س {m}د {s}ث</p>
                        <p><strong>عدد المزايدات:</strong> {item.bid_count || 0}</p>
                        {item.my_max_bid ? <p><strong>أعلى مزايدة لك:</strong> {Number(item.my_max_bid).toLocaleString('en-US')} SAR</p> : null}
                    </div>
                </UICard>

                <UICard>
                    <h2 style={{ marginBottom: 10 }}>ضع مزايدتك</h2>
                    <p style={{ color: 'var(--color-text-muted)', marginBottom: 10 }}>
                        Anti-sniping مفعل: أي مزايدة في الثواني الأخيرة تمدد وقت المزاد تلقائياً.
                    </p>
                    <UIInput
                        type="number"
                        min={minBid || 0}
                        step="1"
                        value={bidAmount}
                        onChange={(e) => setBidAmount(e.target.value)}
                        placeholder={`الحد الأدنى ${minBid}`}
                    />
                    <div style={{ height: 10 }} />
                    <UIButton
                        type="button"
                        disabled={placing || item.status !== 'LIVE'}
                        onClick={async () => {
                            const amount = Number(bidAmount);
                            if (!Number.isFinite(amount) || amount < minBid) {
                                push(`الحد الأدنى للمزايدة هو ${minBid}`);
                                return;
                            }
                            const token = getAccessToken();
                            if (!token) {
                                push('يرجى تسجيل الدخول للمزايدة');
                                return;
                            }

                            setPlacing(true);
                            try {
                                await apiFetch(`/auctions/${auctionId}/bid`, {
                                    method: 'POST',
                                    body: JSON.stringify({ amount }),
                                }, token);
                                setBidAmount('');
                                push('تم تسجيل مزايدتك بنجاح');
                                await load();
                            } catch (err) {
                                push(parseApiError(err));
                            } finally {
                                setPlacing(false);
                            }
                        }}
                        style={{ width: '100%' }}
                    >
                        {placing ? 'جارٍ الإرسال...' : 'تأكيد المزايدة'}
                    </UIButton>
                </UICard>
            </section>
        </main>
    );
}
