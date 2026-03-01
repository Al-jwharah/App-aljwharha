'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiFetch, parseApiError } from '../../../lib/api';
import { getAccessToken } from '../../../lib/auth';
import { UIButton, UICard, UIInput, UISelect, UITable, useToast } from '../../../components/ui-kit';

type Auction = {
    id: string;
    title: string;
    status: string;
    seller_id: string;
    current_price: string;
    bid_count: number;
    ends_at: string;
    order_id?: string;
};

export default function AdminAuctionsPage() {
    const { push } = useToast();
    const [items, setItems] = useState<Auction[]>([]);
    const [status, setStatus] = useState('');
    const [q, setQ] = useState('');

    const load = async () => {
        const token = getAccessToken();
        if (!token) return;

        const params = new URLSearchParams();
        params.set('page', '1');
        params.set('pageSize', '100');
        if (status) params.set('status', status);
        if (q.trim()) params.set('q', q.trim());

        try {
            const res = await apiFetch<{ items: Auction[] }>(`/auctions?${params.toString()}`, {}, token);
            setItems(res.items || []);
        } catch (err) {
            push(parseApiError(err));
        }
    };

    useEffect(() => {
        load();
    }, [status, q]);

    return (
        <div style={{ display: 'grid', gap: 16 }}>
            <UICard>
                <div className="page-grid-3" style={{ alignItems: 'end' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: 6 }}>الحالة</label>
                        <UISelect value={status} onChange={(e) => setStatus(e.target.value)}>
                            <option value="">الكل</option>
                            <option value="LIVE">LIVE</option>
                            <option value="ENDED">ENDED</option>
                            <option value="DRAFT">DRAFT</option>
                            <option value="CANCELLED">CANCELLED</option>
                        </UISelect>
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: 6 }}>بحث</label>
                        <UIInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="auction id / title" />
                    </div>
                    <div>
                        <UIButton type="button" onClick={load} style={{ width: '100%' }}>تحديث</UIButton>
                    </div>
                </div>
            </UICard>

            <UICard>
                <UITable>
                    <thead>
                        <tr>
                            <th>المزاد</th>
                            <th>الحالة</th>
                            <th>أعلى سعر</th>
                            <th>المزايدات</th>
                            <th>النهاية</th>
                            <th>الإجراء</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((a) => (
                            <tr key={a.id}>
                                <td>{a.title || `${a.id.slice(0, 8)}...`}</td>
                                <td>{a.status}</td>
                                <td>{Number(a.current_price || 0).toLocaleString('en-US')} SAR</td>
                                <td>{a.bid_count || 0}</td>
                                <td>{new Date(a.ends_at).toLocaleString('ar-SA')}</td>
                                <td>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <Link href={`/auctions/${a.id}`}>
                                            <UIButton type="button" variant="secondary">فتح</UIButton>
                                        </Link>
                                        {a.order_id ? (
                                            <Link href={`/admin/orders/${a.order_id}`}>
                                                <UIButton type="button">طلب الفائز</UIButton>
                                            </Link>
                                        ) : null}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </UITable>
            </UICard>
        </div>
    );
}
