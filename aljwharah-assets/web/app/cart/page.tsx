'use client';

import { useState, useEffect } from 'react';

export default function CartPage() {
    const [cart, setCart] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [checkingOut, setCheckingOut] = useState(false);

    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'https://api.aljwharah.ai';

    function getToken() {
        return typeof window !== 'undefined' ? localStorage.getItem('aljwharah_token') : null;
    }

    useEffect(() => {
        loadCart();
    }, []);

    function loadCart() {
        const token = getToken();
        if (!token) { setError('يرجى تسجيل الدخول'); setLoading(false); return; }

        fetch(`${apiBase}/cart`, { headers: { Authorization: `Bearer ${token}` } })
            .then((r) => r.json())
            .then((data) => { setCart(data); setLoading(false); })
            .catch(() => { setError('تعذر تحميل السلة'); setLoading(false); });
    }

    async function removeItem(listingId: string) {
        const token = getToken();
        await fetch(`${apiBase}/cart/items/${listingId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
        });
        loadCart();
    }

    async function handleCheckout() {
        const token = getToken();
        setCheckingOut(true);
        try {
            const res = await fetch(`${apiBase}/checkout`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'خطأ');
            window.location.href = `/orders/${data.id}`;
        } catch (err: any) {
            setError(err.message);
            setCheckingOut(false);
        }
    }

    return (
        <main className="legal-page">
            <div className="legal-container">
                <h1>سلة المشتريات</h1>

                {loading && <p>جارٍ التحميل...</p>}
                {error && <p style={{ color: 'var(--color-danger)' }}>{error}</p>}

                {!loading && cart && cart.items.length === 0 && (
                    <div style={{ padding: '40px', background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                        <p style={{ fontSize: '1.1rem', marginBottom: '16px' }}>السلة فارغة</p>
                        <a href="/trademarks" className="btn-submit" style={{ display: 'inline-block' }}>تصفّح الأصول</a>
                    </div>
                )}

                {!loading && cart && cart.items.length > 0 && (
                    <>
                        <div className="dashboard-list" style={{ marginBottom: '24px' }}>
                            {cart.items.map((item: any) => (
                                <div key={item.listingId} className="dashboard-item">
                                    <div className="dashboard-item-info">
                                        <strong>{item.title}</strong>
                                        <span style={{ fontSize: '0.85rem', color: item.available ? 'var(--color-success)' : 'var(--color-danger)' }}>
                                            {item.available ? 'متاح' : 'غير متاح'}
                                        </span>
                                    </div>
                                    <div className="dashboard-item-meta">
                                        <span style={{ fontFamily: 'var(--font-latin)', fontWeight: 600 }}>
                                            {Number(item.price).toLocaleString()} {item.currency}
                                        </span>
                                        <button
                                            onClick={() => removeItem(item.listingId)}
                                            style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', fontSize: '0.9rem' }}
                                        >
                                            إزالة
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div style={{ padding: '24px', background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <span style={{ fontWeight: 600 }}>الإجمالي: </span>
                                <span style={{ fontFamily: 'var(--font-latin)', fontWeight: 700, fontSize: '1.2rem' }}>
                                    {Number(cart.total).toLocaleString()} SAR
                                </span>
                            </div>
                            <button className="btn-submit" onClick={handleCheckout} disabled={checkingOut}>
                                {checkingOut ? 'جارٍ الإتمام...' : 'إتمام الشراء'}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </main>
    );
}
