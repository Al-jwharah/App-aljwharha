'use client';

import { useState, useEffect } from 'react';

export default function DashboardPage() {
    const [listings, setListings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('aljwharah_token') : null;
        if (!token) {
            setError('يرجى تسجيل الدخول أولاً');
            setLoading(false);
            return;
        }

        const apiBase = process.env.NEXT_PUBLIC_API_URL || 'https://api.aljwharah.ai';
        fetch(`${apiBase}/listings/my`, {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then((r) => r.json())
            .then((data) => {
                setListings(data.data || []);
                setLoading(false);
            })
            .catch(() => {
                setError('تعذر تحميل الإعلانات');
                setLoading(false);
            });
    }, []);

    const statusMap: Record<string, { label: string; color: string }> = {
        DRAFT: { label: 'قيد المراجعة', color: 'var(--color-accent-strong)' },
        APPROVED: { label: 'منشور', color: 'var(--color-success)' },
        REJECTED: { label: 'مرفوض', color: 'var(--color-danger)' },
    };

    return (
        <main className="legal-page">
            <div className="legal-container">
                <h1>لوحة التحكم</h1>
                <p style={{ color: 'var(--color-text-muted)', marginBottom: '32px' }}>
                    إعلاناتي والحالة
                </p>

                {loading && <p>جارٍ التحميل...</p>}
                {error && (
                    <div style={{ padding: '24px', background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                        <p>{error}</p>
                        <a href="/contact" className="btn-submit" style={{ display: 'inline-block', marginTop: '16px' }}>
                            تسجيل الدخول
                        </a>
                    </div>
                )}

                {!loading && !error && listings.length === 0 && (
                    <div style={{ padding: '40px', background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                        <p style={{ fontSize: '1.1rem', marginBottom: '16px' }}>لا توجد إعلانات بعد</p>
                        <a href="/seller-guide" className="btn-submit" style={{ display: 'inline-block' }}>
                            دليل البائع
                        </a>
                    </div>
                )}

                {!loading && !error && listings.length > 0 && (
                    <div className="dashboard-list">
                        {listings.map((listing: any) => {
                            const st = statusMap[listing.status] || { label: listing.status, color: '#999' };
                            return (
                                <div key={listing.id} className="dashboard-item">
                                    <div className="dashboard-item-info">
                                        <strong>{listing.title}</strong>
                                        <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                                            {listing.type === 'TRADEMARK' ? 'علامة تجارية' : listing.type === 'FACTORY' ? 'مصنع' : 'محل'}
                                        </span>
                                    </div>
                                    <div className="dashboard-item-meta">
                                        {listing.price && (
                                            <span style={{ fontFamily: 'var(--font-latin)', fontWeight: 600 }}>
                                                {Number(listing.price).toLocaleString()} {listing.currency || 'SAR'}
                                            </span>
                                        )}
                                        <span
                                            className="status-badge"
                                            style={{ background: st.color, color: '#fff' }}
                                        >
                                            {st.label}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </main>
    );
}
