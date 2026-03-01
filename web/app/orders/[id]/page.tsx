'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

export default function OrderDetailPage() {
    const params = useParams();
    const orderId = params.id as string;
    const [order, setOrder] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [paying, setPaying] = useState(false);

    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'https://api.aljwharah.ai';

    useEffect(() => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('aljwharah_token') : null;
        if (!token) { setError('يرجى تسجيل الدخول'); setLoading(false); return; }

        fetch(`${apiBase}/orders/${orderId}`, { headers: { Authorization: `Bearer ${token}` } })
            .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
            .then((data) => { setOrder(data); setLoading(false); })
            .catch(() => { setError('تعذر تحميل الطلب'); setLoading(false); });
    }, [orderId]);

    async function handlePay() {
        const token = typeof window !== 'undefined' ? localStorage.getItem('aljwharah_token') : null;
        setPaying(true);
        try {
            const res = await fetch(`${apiBase}/payments/create`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId }),
            });
            const data = await res.json();
            if (data.transactionUrl) {
                window.location.href = data.transactionUrl;
            } else {
                setError('تعذر إنشاء رابط الدفع');
                setPaying(false);
            }
        } catch {
            setError('حدث خطأ أثناء الدفع');
            setPaying(false);
        }
    }

    const statusMap: Record<string, { label: string; color: string }> = {
        PENDING: { label: 'في الانتظار', color: 'var(--color-accent-strong)' },
        RESERVED: { label: 'محجوز — بانتظار الدفع', color: 'var(--color-accent-strong)' },
        PAID: { label: 'مدفوع ✅', color: 'var(--color-success)' },
        CANCELLED: { label: 'ملغي', color: 'var(--color-danger)' },
        REFUNDED: { label: 'مسترد', color: 'var(--color-text-muted)' },
    };

    return (
        <main className="legal-page">
            <div className="legal-container">
                <h1>تفاصيل الطلب</h1>

                {loading && <p>جارٍ التحميل...</p>}
                {error && <p style={{ color: 'var(--color-danger)' }}>{error}</p>}

                {!loading && order && (
                    <>
                        <div style={{ padding: '20px', background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', marginBottom: '24px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                <span style={{ fontWeight: 600 }}>رقم الطلب</span>
                                <span style={{ fontFamily: 'var(--font-latin)', fontSize: '0.88rem' }}>{order.id}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                <span style={{ fontWeight: 600 }}>الحالة</span>
                                <span className="status-badge" style={{ background: (statusMap[order.status] || { color: '#999' }).color, color: '#fff' }}>
                                    {(statusMap[order.status] || { label: order.status }).label}
                                </span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                <span style={{ fontWeight: 600 }}>الإجمالي</span>
                                <span style={{ fontFamily: 'var(--font-latin)', fontWeight: 700, fontSize: '1.2rem' }}>
                                    {Number(order.total).toLocaleString()} {order.currency || 'SAR'}
                                </span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontWeight: 600 }}>التاريخ</span>
                                <span>{new Date(order.created_at).toLocaleDateString('ar-SA')}</span>
                            </div>
                        </div>

                        <h2 style={{ marginBottom: '16px' }}>الأصول في الطلب</h2>
                        <div className="dashboard-list" style={{ marginBottom: '24px' }}>
                            {(order.items || []).map((item: any, i: number) => (
                                <div key={i} className="dashboard-item">
                                    <div className="dashboard-item-info">
                                        <strong>{item.title || 'أصل'}</strong>
                                        <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>{item.type}</span>
                                    </div>
                                    <span style={{ fontFamily: 'var(--font-latin)', fontWeight: 600 }}>
                                        {Number(item.price).toLocaleString()} {item.currency || 'SAR'}
                                    </span>
                                </div>
                            ))}
                        </div>

                        {order.status === 'RESERVED' && (
                            <button className="btn-submit" style={{ width: '100%' }} onClick={handlePay} disabled={paying}>
                                {paying ? 'جارٍ التحويل للدفع...' : 'ادفع الآن'}
                            </button>
                        )}

                        {order.status === 'PAID' && (
                            <div style={{ padding: '24px', background: '#e8f5e9', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                                <p style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--color-success)' }}>تم الدفع بنجاح 🎉</p>
                            </div>
                        )}
                    </>
                )}
            </div>
        </main>
    );
}
