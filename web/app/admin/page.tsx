'use client';

import { useState, useEffect } from 'react';

export default function AdminPage() {
    const [listings, setListings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [actionMsg, setActionMsg] = useState('');

    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'https://api.aljwharah.ai';

    useEffect(() => {
        loadPending();
    }, []);

    function getToken() {
        return typeof window !== 'undefined' ? localStorage.getItem('aljwharah_token') : null;
    }

    function loadPending() {
        const token = getToken();
        if (!token) {
            setError('يرجى تسجيل الدخول كمدير');
            setLoading(false);
            return;
        }

        fetch(`${apiBase}/admin/listings/pending`, {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then((r) => {
                if (r.status === 403) throw new Error('forbidden');
                return r.json();
            })
            .then((data) => {
                setListings(data.data || []);
                setLoading(false);
            })
            .catch((err) => {
                setError(err.message === 'forbidden' ? 'صلاحيات غير كافية' : 'تعذر التحميل');
                setLoading(false);
            });
    }

    async function handleAction(id: string, action: 'approve' | 'reject') {
        const token = getToken();
        setActionMsg('');
        try {
            const res = await fetch(`${apiBase}/admin/listings/${id}/${action}`, {
                method: 'PATCH',
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error();
            setActionMsg(action === 'approve' ? 'تم اعتماد الإعلان ✅' : 'تم رفض الإعلان ❌');
            setListings((prev) => prev.filter((l) => l.id !== id));
        } catch {
            setActionMsg('حدث خطأ');
        }
    }

    return (
        <main className="legal-page">
            <div className="legal-container">
                <h1>إدارة الإعلانات</h1>
                <p style={{ color: 'var(--color-text-muted)', marginBottom: '32px' }}>
                    الإعلانات المعلّقة في انتظار المراجعة
                </p>

                {actionMsg && (
                    <div style={{ padding: '12px 16px', background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', marginBottom: '16px', textAlign: 'center' }}>
                        {actionMsg}
                    </div>
                )}

                {loading && <p>جارٍ التحميل...</p>}
                {error && <p style={{ color: 'var(--color-danger)' }}>{error}</p>}

                {!loading && !error && listings.length === 0 && (
                    <div style={{ padding: '40px', background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                        <p>لا توجد إعلانات معلّقة 🎉</p>
                    </div>
                )}

                {!loading && !error && listings.length > 0 && (
                    <div className="dashboard-list">
                        {listings.map((listing: any) => (
                            <div key={listing.id} className="dashboard-item">
                                <div className="dashboard-item-info">
                                    <strong>{listing.title}</strong>
                                    <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                                        {listing.owner_email || 'مجهول'} · {listing.type}
                                    </span>
                                </div>
                                <div className="dashboard-item-meta" style={{ gap: '8px' }}>
                                    <button
                                        className="btn-submit"
                                        style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                                        onClick={() => handleAction(listing.id, 'approve')}
                                    >
                                        اعتماد
                                    </button>
                                    <button
                                        className="btn-submit"
                                        style={{ padding: '8px 16px', fontSize: '0.85rem', background: 'var(--color-danger)' }}
                                        onClick={() => handleAction(listing.id, 'reject')}
                                    >
                                        رفض
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </main>
    );
}
