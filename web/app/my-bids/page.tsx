'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiFetch, parseApiError } from '../../lib/api';
import { getAccessToken } from '../../lib/auth';
import { UIButton, UICard, UIEmptyState, UITable, useToast } from '../../components/ui-kit';

type BidItem = {
    id: number;
    auction_id: string;
    amount: string;
    created_at: string;
    auction_status: string;
    ends_at: string;
    title: string;
    city?: string;
    winner_user_id?: string;
    order_id?: string;
};

export default function MyBidsPage() {
    const { push } = useToast();
    const [items, setItems] = useState<BidItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = getAccessToken();
        if (!token) {
            setLoading(false);
            push('يرجى تسجيل الدخول لعرض المزايدات');
            return;
        }

        apiFetch<{ items: BidItem[] }>('/auctions/my-bids?page=1&pageSize=100', {}, token)
            .then((res) => setItems(res.items || []))
            .catch((err) => push(parseApiError(err)))
            .finally(() => setLoading(false));
    }, [push]);

    return (
        <main className="page-shell">
            <section className="page-section">
                <h1 className="page-title">مزايداتي</h1>
                <p className="page-subtitle">متابعة حالة كل مزايدة والانتقال للدفع فور تعيينك فائزًا.</p>
            </section>

            {loading ? (
                <UICard>جارٍ التحميل...</UICard>
            ) : items.length === 0 ? (
                <UIEmptyState title="لا توجد مزايدات" description="لم تقم بأي مزايدة حتى الآن." />
            ) : (
                <UITable>
                    <thead>
                        <tr>
                            <th>المزاد</th>
                            <th>مزايدتك</th>
                            <th>الحالة</th>
                            <th>الوقت</th>
                            <th>إجراء</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item) => (
                            <tr key={item.id}>
                                <td>
                                    <div style={{ display: 'grid', gap: 4 }}>
                                        <strong>{item.title}</strong>
                                        <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>{item.city || '—'}</span>
                                    </div>
                                </td>
                                <td>{Number(item.amount || 0).toLocaleString('en-US')} SAR</td>
                                <td>{item.auction_status}</td>
                                <td>{new Date(item.created_at).toLocaleString('ar-SA')}</td>
                                <td>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <Link href={`/auctions/${item.auction_id}`}>
                                            <UIButton variant="secondary" type="button">عرض</UIButton>
                                        </Link>
                                        {item.order_id ? (
                                            <Link href={`/orders/${item.order_id}`}>
                                                <UIButton type="button">الدفع</UIButton>
                                            </Link>
                                        ) : null}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </UITable>
            )}
        </main>
    );
}
