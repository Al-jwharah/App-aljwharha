'use client';

import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';

type PayoutRequest = {
    id: string;
    seller_id: string;
    seller_email?: string;
    amount: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    created_at: string;
    reason?: string;
};

export default function AdminPayoutsPage() {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'https://api.aljwharah.ai';

    const [rows, setRows] = useState<PayoutRequest[]>([]);
    const [status, setStatus] = useState('');
    const [q, setQ] = useState('');
    const [page, setPage] = useState(1);
    const [pageSize] = useState(12);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [busyId, setBusyId] = useState('');
    const [reason, setReason] = useState('');

    const token = useMemo(
        () => (typeof window !== 'undefined' ? localStorage.getItem('aljwharah_token') : null),
        [],
    );

    const pageCount = Math.max(1, Math.ceil(total / pageSize));

    useEffect(() => {
        const timer = setTimeout(loadRows, 220);
        return () => clearTimeout(timer);
    }, [status, q, page]);

    async function loadRows() {
        if (!token) {
            setError('يرجى تسجيل الدخول كمدير');
            return;
        }

        setLoading(true);
        setError('');
        try {
            const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
            if (status) params.set('status', status);
            if (q.trim()) params.set('q', q.trim());

            const res = await fetch(`${apiBase}/admin/payout-requests?${params.toString()}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error('تعذر تحميل طلبات السحب');
            const data = await res.json();
            setRows(data.items || []);
            setTotal(data.total || 0);
        } catch (err: any) {
            setError(err.message || 'تعذر تحميل طلبات السحب');
        } finally {
            setLoading(false);
        }
    }

    async function approve(id: string) {
        if (!token) return;
        setBusyId(id);
        try {
            const res = await fetch(`${apiBase}/admin/payout-requests/${id}/approve`, {
                method: 'PATCH',
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error();
            await loadRows();
        } catch {
            setError('تعذر اعتماد الطلب');
        } finally {
            setBusyId('');
        }
    }

    async function reject(id: string) {
        if (!token) return;
        if (!reason.trim()) {
            setError('سبب الرفض مطلوب');
            return;
        }

        setBusyId(id);
        try {
            const res = await fetch(`${apiBase}/admin/payout-requests/${id}/reject`, {
                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ reason: reason.trim() }),
            });
            if (!res.ok) throw new Error();
            setReason('');
            await loadRows();
        } catch {
            setError('تعذر رفض الطلب');
        } finally {
            setBusyId('');
        }
    }

    return (
        <section>
            <h2 style={{ marginBottom: '12px' }}>طلبات السحب</h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px', gap: '10px', marginBottom: '10px' }}>
                <input
                    value={q}
                    onChange={(e) => {
                        setQ(e.target.value);
                        setPage(1);
                    }}
                    placeholder="بحث بالبائع/المعرف"
                    style={{ border: '1px solid var(--color-border)', borderRadius: '8px', padding: '9px 11px' }}
                />
                <select
                    value={status}
                    onChange={(e) => {
                        setStatus(e.target.value);
                        setPage(1);
                    }}
                    style={{ border: '1px solid var(--color-border)', borderRadius: '8px', padding: '9px 11px' }}
                >
                    <option value="">كل الحالات</option>
                    <option value="PENDING">PENDING</option>
                    <option value="APPROVED">APPROVED</option>
                    <option value="REJECTED">REJECTED</option>
                </select>
            </div>

            <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                placeholder="سبب الرفض (مطلوب عند الرفض)"
                style={{ width: '100%', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '10px', marginBottom: '10px' }}
            />

            {loading ? <p>جارٍ التحميل...</p> : null}
            {error ? <p style={{ color: 'var(--color-danger)' }}>{error}</p> : null}

            {!loading && !error && rows.length > 0 ? (
                <div className="dashboard-list" style={{ marginBottom: '14px' }}>
                    {rows.map((row) => (
                        <div key={row.id} className="dashboard-item">
                            <div className="dashboard-item-info">
                                <strong>{row.id}</strong>
                                <span style={{ fontSize: '0.84rem', color: 'var(--color-text-muted)' }}>
                                    {row.seller_email || row.seller_id}
                                </span>
                                <span style={{ fontSize: '0.84rem', color: 'var(--color-text-muted)' }}>
                                    {new Date(row.created_at).toLocaleString('ar-SA')}
                                </span>
                            </div>
                            <div className="dashboard-item-meta" style={{ gap: '8px' }}>
                                <span style={{ fontWeight: 700 }}>{Number(row.amount).toLocaleString('en-US')} SAR</span>
                                <span className="status-badge">{row.status}</span>
                                {row.status === 'PENDING' ? (
                                    <div style={{ display: 'flex', gap: '6px' }}>
                                        <button type="button" style={btn} disabled={busyId === row.id} onClick={() => approve(row.id)}>اعتماد</button>
                                        <button type="button" style={{ ...btn, background: 'var(--color-danger)', color: '#fff' }} disabled={busyId === row.id} onClick={() => reject(row.id)}>رفض</button>
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    ))}
                </div>
            ) : null}

            {!loading && !error && rows.length === 0 ? (
                <div style={{ padding: '20px', borderRadius: '10px', background: 'var(--color-surface)' }}>لا توجد نتائج</div>
            ) : null}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button type="button" style={btn} disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>السابق</button>
                <span>{page} / {pageCount} · الإجمالي {total}</span>
                <button type="button" style={btn} disabled={page >= pageCount} onClick={() => setPage((p) => Math.min(pageCount, p + 1))}>التالي</button>
            </div>
        </section>
    );
}

const btn: CSSProperties = {
    border: '1px solid var(--color-border)',
    borderRadius: '8px',
    background: '#fff',
    padding: '7px 10px',
};