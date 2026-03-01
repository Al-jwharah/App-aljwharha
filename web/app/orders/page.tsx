'use client';

import { useState, useEffect } from 'react';

export default function OrdersPage() {
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'https://api.aljwharah.ai';

    useEffect(() => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('aljwharah_token') : null;
        if (!token) { setError('يرجى تسجيل الدخول'); setLoading(false); return; }

        fetch(`${apiBase}/orders`, { headers: { Authorization: `Bearer ${token}` } })
            .then((r) => r.json())
            .then((data) => { setOrders(data.data || []); setLoading(false); })
            .catch(() => { setError('تعذر تحميل الطلبات'); setLoading(false); });
    }, []);

    const statusMap: Record<string, { label: string; color: string }> = {
        PENDING: { label: 'في الانتظار', color: 'var(--color-accent-strong)' },
        RESERVED: { label: 'محجوز', color: 'var(--color-accent-strong)' },
        PAID: { label: 'مدفوع', color: 'var(--color-success)' },
        CANCELLED: { label: 'ملغي', color: 'var(--color-danger)' },
        REFUNDED: { label: 'مسترد', color: 'var(--color-text-muted)' },
    };

    return (
        <main className="legal-page">
            <div className="legal-container">
                <h1>طلباتي</h1>

                {loading && <p>جارٍ التحميل...</p>}
                {error && <p style={{ color: 'var(--color-danger)' }}>{error}</p>}

                {!loading && !error && orders.length === 0 && (
                    <div style={{ padding: '40px', background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                        <p>لا توجد طلبات بعد</p>
                    </div>
                )}

                {!loading && !error && orders.length > 0 && (
                    <div className="dashboard-list">
                        {orders.map((order: any) => {
                            const st = statusMap[order.status] || { label: order.status, color: '#999' };
                            return (
                                <a key={order.id} href={`/orders/${order.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                                    <div className="dashboard-item">
                                        <div className="dashboard-item-info">
                                            <strong>طلب #{order.id.substring(0, 8)}</strong>
                                            <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                                                {new Date(order.created_at).toLocaleDateString('ar-SA')} · {order.items?.length || 0} أصول
                                            </span>
                                        </div>
                                        <div className="dashboard-item-meta">
                                            <span style={{ fontFamily: 'var(--font-latin)', fontWeight: 600 }}>
                                                {Number(order.total).toLocaleString()} {order.currency || 'SAR'}
                                            </span>
                                            <span className="status-badge" style={{ background: st.color, color: '#fff' }}>
                                                {st.label}
                                            </span>
                                        </div>
                                    </div>
                                </a>
                            );
                        })}
                    </div>
                )}
            </div>
        </main>
    );
}
