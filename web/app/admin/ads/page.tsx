'use client';

import { useEffect, useState } from 'react';
import { apiFetch, parseApiError } from '../../../lib/api';
import { getAccessToken } from '../../../lib/auth';
import { UIButton, UICard, UIInput, UISelect, UITable, useToast } from '../../../components/ui-kit';

type Campaign = {
    id: string;
    listing_id: string;
    product_code: string;
    status: string;
    seller_email?: string;
    tap_charge_id?: string;
    created_at: string;
};

type Product = {
    code: string;
    price_amount: string;
    currency: string;
    duration_days: number;
};

export default function AdminAdsPage() {
    const { push } = useToast();
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [status, setStatus] = useState('');
    const [q, setQ] = useState('');
    const [loading, setLoading] = useState(true);

    const load = async () => {
        const token = getAccessToken();
        if (!token) {
            setLoading(false);
            return;
        }

        const params = new URLSearchParams();
        if (status) params.set('status', status);
        if (q.trim()) params.set('q', q.trim());

        try {
            const [campaignRes, productRes] = await Promise.all([
                apiFetch<{ items: Campaign[] }>(`/admin/ads/campaigns?${params.toString()}`, {}, token),
                apiFetch<{ items: Product[] }>('/admin/ads/products', {}, token),
            ]);
            setCampaigns(campaignRes.items || []);
            setProducts(productRes.items || []);
        } catch (err) {
            push(parseApiError(err));
        } finally {
            setLoading(false);
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
                            <option value="PENDING_PAYMENT">بانتظار الدفع</option>
                            <option value="ACTIVE">نشط</option>
                            <option value="EXPIRED">منتهي</option>
                            <option value="CANCELLED">ملغي</option>
                        </UISelect>
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: 6 }}>بحث</label>
                        <UIInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="campaign id / charge id / listing" />
                    </div>
                    <div>
                        <UIButton type="button" onClick={load} style={{ width: '100%' }}>تحديث</UIButton>
                    </div>
                </div>
            </UICard>

            <UICard>
                <h2 style={{ marginBottom: 8 }}>منتجات الإعلانات</h2>
                {products.map((product) => (
                    <div key={product.code} style={{ border: '1px solid var(--color-border)', borderRadius: 10, padding: 10, marginBottom: 8 }}>
                        <strong>{product.code}</strong>
                        <p style={{ color: 'var(--color-text-muted)' }}>
                            {Number(product.price_amount || 0).toLocaleString('en-US')} {product.currency} · {product.duration_days} يوم
                        </p>
                    </div>
                ))}
            </UICard>

            <UICard>
                <h2 style={{ marginBottom: 8 }}>الحملات</h2>
                {loading ? <p>جارٍ التحميل...</p> : (
                    <UITable>
                        <thead>
                            <tr>
                                <th>الحملة</th>
                                <th>المنتج</th>
                                <th>الحالة</th>
                                <th>البائع</th>
                                <th>Tap</th>
                                <th>التاريخ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {campaigns.map((c) => (
                                <tr key={c.id}>
                                    <td>{c.id.slice(0, 8)}...</td>
                                    <td>{c.product_code}</td>
                                    <td>{c.status}</td>
                                    <td>{c.seller_email || c.listing_id}</td>
                                    <td>{c.tap_charge_id || '—'}</td>
                                    <td>{new Date(c.created_at).toLocaleString('ar-SA')}</td>
                                </tr>
                            ))}
                        </tbody>
                    </UITable>
                )}
            </UICard>
        </div>
    );
}
