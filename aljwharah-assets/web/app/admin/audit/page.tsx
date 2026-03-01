'use client';

import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';

type AuditRow = {
    id: number;
    created_at: string;
    action: string;
    entity_type: string;
    entity_id: string;
    actor_user_id?: string;
    meta: Record<string, any>;
};

export default function AdminAuditPage() {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'https://api.aljwharah.ai';

    const [rows, setRows] = useState<AuditRow[]>([]);
    const [q, setQ] = useState('');
    const [action, setAction] = useState('');
    const [entityType, setEntityType] = useState('');
    const [page, setPage] = useState(1);
    const [pageSize] = useState(15);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [expandedId, setExpandedId] = useState<number | null>(null);

    const token = useMemo(
        () => (typeof window !== 'undefined' ? localStorage.getItem('aljwharah_token') : null),
        [],
    );

    const pageCount = Math.max(1, Math.ceil(total / pageSize));

    useEffect(() => {
        const timer = setTimeout(() => {
            loadAudit();
        }, 250);
        return () => clearTimeout(timer);
    }, [q, action, entityType, page]);

    async function loadAudit() {
        if (!token) {
            setError('يرجى تسجيل الدخول كمدير');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
            if (q.trim()) params.set('q', q.trim());
            if (action.trim()) params.set('action', action.trim());
            if (entityType.trim()) params.set('entityType', entityType.trim());

            const res = await fetch(`${apiBase}/admin/audit?${params.toString()}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error('تعذر تحميل سجل التدقيق');

            const data = await res.json();
            setRows(data.items || []);
            setTotal(data.total || 0);
        } catch (err: any) {
            setError(err.message || 'تعذر تحميل سجل التدقيق');
        } finally {
            setLoading(false);
        }
    }

    return (
        <section>
            <h2 style={{ marginBottom: '12px' }}>سجل التدقيق</h2>

            <div style={{ display: 'grid', gap: '10px', gridTemplateColumns: '1fr 180px 180px', marginBottom: '14px' }}>
                <input
                    value={q}
                    onChange={(e) => {
                        setQ(e.target.value);
                        setPage(1);
                    }}
                    placeholder="بحث عام"
                    style={{ border: '1px solid var(--color-border)', borderRadius: '10px', padding: '10px 12px' }}
                />
                <input
                    value={action}
                    onChange={(e) => {
                        setAction(e.target.value);
                        setPage(1);
                    }}
                    placeholder="action"
                    style={{ border: '1px solid var(--color-border)', borderRadius: '10px', padding: '10px 12px' }}
                />
                <input
                    value={entityType}
                    onChange={(e) => {
                        setEntityType(e.target.value);
                        setPage(1);
                    }}
                    placeholder="entity_type"
                    style={{ border: '1px solid var(--color-border)', borderRadius: '10px', padding: '10px 12px' }}
                />
            </div>

            {loading ? <p>جارٍ التحميل...</p> : null}
            {error ? <p style={{ color: 'var(--color-danger)' }}>{error}</p> : null}

            {!loading && !error && rows.length > 0 ? (
                <div className="dashboard-list" style={{ marginBottom: '14px' }}>
                    {rows.map((row) => (
                        <div key={row.id} style={{ border: '1px solid var(--color-border)', borderRadius: '10px', padding: '12px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr 160px 120px', gap: '10px', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.84rem' }}>{new Date(row.created_at).toLocaleString('ar-SA')}</span>
                                <span>{row.action}</span>
                                <span>{row.entity_type}</span>
                                <button type="button" style={toggleBtn} onClick={() => setExpandedId(expandedId === row.id ? null : row.id)}>
                                    {expandedId === row.id ? 'إخفاء' : 'تفاصيل'}
                                </button>
                            </div>
                            <div style={{ marginTop: '8px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>entity: {row.entity_id}</span>
                                <span style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>actor: {row.actor_user_id || '-'}</span>
                                <span style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>requestId: {(row.meta && row.meta.requestId) || '-'}</span>
                            </div>
                            {expandedId === row.id ? (
                                <pre style={{ marginTop: '10px', background: '#0b1520', color: '#d8e2ef', borderRadius: '8px', padding: '10px', overflowX: 'auto' }}>
                                    {JSON.stringify(row.meta || {}, null, 2)}
                                </pre>
                            ) : null}
                        </div>
                    ))}
                </div>
            ) : null}

            {!loading && !error && rows.length === 0 ? (
                <div style={{ padding: '20px', borderRadius: '10px', background: 'var(--color-surface)' }}>لا توجد نتائج</div>
            ) : null}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} style={toggleBtn}>السابق</button>
                <span>{page} / {pageCount} · الإجمالي {total}</span>
                <button type="button" disabled={page >= pageCount} onClick={() => setPage((p) => Math.min(pageCount, p + 1))} style={toggleBtn}>التالي</button>
            </div>
        </section>
    );
}

const toggleBtn: CSSProperties = {
    border: '1px solid var(--color-border)',
    borderRadius: '8px',
    background: '#fff',
    padding: '6px 10px',
};