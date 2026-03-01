'use client';

import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';

type ListingStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

type ListingRow = {
    id: string;
    title: string;
    owner_email?: string;
    owner_name?: string;
    owner_id?: string;
    type?: string;
    status: ListingStatus;
    created_at: string;
    reject_reason?: string | null;
};

const statusTabs: { key: ListingStatus; label: string }[] = [
    { key: 'PENDING', label: 'قيد المراجعة' },
    { key: 'APPROVED', label: 'معتمدة' },
    { key: 'REJECTED', label: 'مرفوضة' },
];

export default function AdminListingsPage() {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'https://api.aljwharah.ai';

    const [status, setStatus] = useState<ListingStatus>('PENDING');
    const [q, setQ] = useState('');
    const [page, setPage] = useState(1);
    const [pageSize] = useState(10);
    const [listings, setListings] = useState<ListingRow[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [toast, setToast] = useState('');

    const [approveTarget, setApproveTarget] = useState<ListingRow | null>(null);
    const [rejectTarget, setRejectTarget] = useState<ListingRow | null>(null);
    const [rejectReason, setRejectReason] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const pageCount = Math.max(1, Math.ceil(total / pageSize));

    const token = useMemo(
        () => (typeof window !== 'undefined' ? localStorage.getItem('aljwharah_token') : null),
        [],
    );

    useEffect(() => {
        setPage(1);
    }, [status]);

    useEffect(() => {
        const timer = setTimeout(() => {
            loadListings();
        }, 250);
        return () => clearTimeout(timer);
    }, [status, q, page]);

    async function loadListings() {
        if (!token) {
            setError('يرجى تسجيل الدخول كمدير');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const params = new URLSearchParams({
                status,
                page: String(page),
                pageSize: String(pageSize),
            });
            if (q.trim()) params.set('q', q.trim());

            const res = await fetch(`${apiBase}/admin/listings?${params.toString()}`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (!res.ok) {
                if (res.status === 403) throw new Error('صلاحيات غير كافية');
                throw new Error('تعذر تحميل الإعلانات');
            }

            const data = await res.json();
            setListings(data.items || []);
            setTotal(data.total || 0);
        } catch (err: any) {
            setError(err.message || 'تعذر تحميل الإعلانات');
        } finally {
            setLoading(false);
        }
    }

    async function approveListing() {
        if (!approveTarget || !token) return;
        setSubmitting(true);
        try {
            const res = await fetch(`${apiBase}/admin/listings/${approveTarget.id}/approve`, {
                method: 'PATCH',
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error();
            setToast('تم اعتماد الإعلان بنجاح');
            setApproveTarget(null);
            await loadListings();
        } catch {
            setToast('تعذر اعتماد الإعلان');
        } finally {
            setSubmitting(false);
            autoClearToast();
        }
    }

    async function rejectListing() {
        if (!rejectTarget || !token) return;
        if (!rejectReason.trim()) {
            setToast('سبب الرفض مطلوب');
            autoClearToast();
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetch(`${apiBase}/admin/listings/${rejectTarget.id}/reject`, {
                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ reason: rejectReason.trim() }),
            });
            if (!res.ok) throw new Error();
            setToast('تم رفض الإعلان');
            setRejectTarget(null);
            setRejectReason('');
            await loadListings();
        } catch {
            setToast('تعذر رفض الإعلان');
        } finally {
            setSubmitting(false);
            autoClearToast();
        }
    }

    function autoClearToast() {
        setTimeout(() => setToast(''), 2400);
    }

    return (
        <section>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                {statusTabs.map((tab) => (
                    <button
                        key={tab.key}
                        type="button"
                        onClick={() => setStatus(tab.key)}
                        style={{
                            border: '1px solid var(--color-border)',
                            background: status === tab.key ? 'var(--color-accent-strong)' : 'var(--color-surface)',
                            color: status === tab.key ? '#fff' : 'var(--color-text-primary)',
                            borderRadius: '10px',
                            padding: '9px 13px',
                            fontWeight: 600,
                            cursor: 'pointer',
                        }}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <div style={{ display: 'grid', gap: '10px', gridTemplateColumns: '1fr 180px', marginBottom: '14px' }}>
                <input
                    value={q}
                    onChange={(e) => {
                        setQ(e.target.value);
                        setPage(1);
                    }}
                    placeholder="بحث بالعنوان/البريد/المعرف"
                    style={{
                        borderRadius: '10px',
                        border: '1px solid var(--color-border)',
                        background: '#fff',
                        padding: '10px 12px',
                    }}
                />
                <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as ListingStatus)}
                    style={{
                        borderRadius: '10px',
                        border: '1px solid var(--color-border)',
                        padding: '10px 12px',
                        background: '#fff',
                    }}
                >
                    <option value="PENDING">قيد المراجعة</option>
                    <option value="APPROVED">معتمدة</option>
                    <option value="REJECTED">مرفوضة</option>
                </select>
            </div>

            {toast ? (
                <div style={{ marginBottom: '14px', padding: '10px 12px', borderRadius: '10px', background: 'var(--color-surface)' }}>
                    {toast}
                </div>
            ) : null}

            {loading ? <p>جارٍ التحميل...</p> : null}
            {error ? <p style={{ color: 'var(--color-danger)' }}>{error}</p> : null}

            {!loading && !error && listings.length === 0 ? (
                <div style={{ padding: '28px', background: 'var(--color-surface)', borderRadius: '10px', textAlign: 'center' }}>
                    لا توجد نتائج
                </div>
            ) : null}

            {!loading && !error && listings.length > 0 ? (
                <div className="dashboard-list" style={{ marginBottom: '14px' }}>
                    {listings.map((listing) => (
                        <div key={listing.id} className="dashboard-item" style={{ alignItems: 'start' }}>
                            <div className="dashboard-item-info">
                                <strong>{listing.title}</strong>
                                <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                                    {listing.owner_name || listing.owner_email || 'بدون مالك'} · {listing.type || '-'}
                                </span>
                                <span style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
                                    {new Date(listing.created_at).toLocaleString('ar-SA')}
                                </span>
                                {listing.status === 'REJECTED' && listing.reject_reason ? (
                                    <span style={{ fontSize: '0.83rem', color: 'var(--color-danger)' }}>
                                        سبب الرفض: {listing.reject_reason}
                                    </span>
                                ) : null}
                            </div>

                            {listing.status === 'PENDING' ? (
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button
                                        type="button"
                                        className="btn-submit"
                                        style={{ padding: '8px 14px', fontSize: '0.85rem' }}
                                        onClick={() => setApproveTarget(listing)}
                                    >
                                        اعتماد
                                    </button>
                                    <button
                                        type="button"
                                        className="btn-submit"
                                        style={{ padding: '8px 14px', fontSize: '0.85rem', background: 'var(--color-danger)' }}
                                        onClick={() => setRejectTarget(listing)}
                                    >
                                        رفض
                                    </button>
                                </div>
                            ) : null}
                        </div>
                    ))}
                </div>
            ) : null}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>
                    إجمالي النتائج: {total}
                </span>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button
                        type="button"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page <= 1}
                        style={{ border: '1px solid var(--color-border)', background: '#fff', borderRadius: '8px', padding: '6px 10px' }}
                    >
                        السابق
                    </button>
                    <span style={{ minWidth: '72px', textAlign: 'center' }}>
                        {page} / {pageCount}
                    </span>
                    <button
                        type="button"
                        onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                        disabled={page >= pageCount}
                        style={{ border: '1px solid var(--color-border)', background: '#fff', borderRadius: '8px', padding: '6px 10px' }}
                    >
                        التالي
                    </button>
                </div>
            </div>

            {approveTarget ? (
                <div style={overlayStyle}>
                    <div style={modalStyle}>
                        <h3 style={{ marginBottom: '12px' }}>تأكيد اعتماد الإعلان</h3>
                        <p style={{ marginBottom: '16px' }}>{approveTarget.title}</p>
                        <div style={{ display: 'flex', justifyContent: 'end', gap: '8px' }}>
                            <button type="button" onClick={() => setApproveTarget(null)} style={ghostBtn}>إلغاء</button>
                            <button type="button" onClick={approveListing} disabled={submitting} style={primaryBtn}>
                                {submitting ? 'جارٍ التنفيذ...' : 'تأكيد الاعتماد'}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            {rejectTarget ? (
                <div style={overlayStyle}>
                    <div style={modalStyle}>
                        <h3 style={{ marginBottom: '12px' }}>رفض الإعلان</h3>
                        <p style={{ marginBottom: '10px' }}>{rejectTarget.title}</p>
                        <textarea
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="اكتب سبب الرفض"
                            rows={4}
                            style={{ width: '100%', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '10px', marginBottom: '14px' }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'end', gap: '8px' }}>
                            <button
                                type="button"
                                onClick={() => {
                                    setRejectTarget(null);
                                    setRejectReason('');
                                }}
                                style={ghostBtn}
                            >
                                إلغاء
                            </button>
                            <button type="button" onClick={rejectListing} disabled={submitting} style={dangerBtn}>
                                {submitting ? 'جارٍ التنفيذ...' : 'تأكيد الرفض'}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </section>
    );
}

const overlayStyle: CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.35)',
    display: 'grid',
    placeItems: 'center',
    zIndex: 40,
    padding: '16px',
};

const modalStyle: CSSProperties = {
    width: '100%',
    maxWidth: '520px',
    background: '#fff',
    borderRadius: '12px',
    padding: '18px',
};

const primaryBtn: CSSProperties = {
    border: 'none',
    borderRadius: '8px',
    background: 'var(--color-accent-strong)',
    color: '#fff',
    padding: '8px 12px',
};

const dangerBtn: CSSProperties = {
    ...primaryBtn,
    background: 'var(--color-danger)',
};

const ghostBtn: CSSProperties = {
    border: '1px solid var(--color-border)',
    borderRadius: '8px',
    background: '#fff',
    color: 'var(--color-text-primary)',
    padding: '8px 12px',
};