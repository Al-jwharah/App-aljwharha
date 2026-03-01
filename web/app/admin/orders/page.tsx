'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';

type AdminOrder = {
    id: string;
    user_id: string;
    user_email?: string;
    status: string;
    ui_status: string;
    total: string;
    currency: string;
    created_at: string;
    tap_charge_id?: string;
    payment_status?: string;
    payment_updated_at?: string;
};

const statusOptions = [
    { value: '', label: 'كل الحالات' },
    { value: 'PENDING', label: 'PENDING' },
    { value: 'RESERVED', label: 'RESERVED' },
    { value: 'PAID', label: 'PAID' },
    { value: 'CANCELLED', label: 'CANCELLED' },
    { value: 'REFUNDED', label: 'REFUNDED' },
];

export default function AdminOrdersPage() {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'https://api.aljwharah.ai';

    const [orders, setOrders] = useState<AdminOrder[]>([]);
    const [status, setStatus] = useState('');
    const [q, setQ] = useState('');
    const [page, setPage] = useState(1);
    const [pageSize] = useState(10);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const token = useMemo(
        () => (typeof window !== 'undefined' ? localStorage.getItem('aljwharah_token') : null),
        [],
    );

    const pageCount = Math.max(1, Math.ceil(total / pageSize));

    useEffect(() => {
        const timer = setTimeout(() => {
            loadOrders();
        }, 250);
        return () => clearTimeout(timer);
    }, [status, q, page]);

    async function loadOrders() {
        if (!token) {
            setError('يرجى تسجيل الدخول كمدير');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const params = new URLSearchParams({
                page: String(page),
                pageSize: String(pageSize),
            });
            if (status) params.set('status', status);
            if (q.trim()) params.set('q', q.trim());

            const res = await fetch(`${apiBase}/admin/orders?${params.toString()}`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (!res.ok) throw new Error('تعذر تحميل الطلبات');
            const data = await res.json();

            setOrders(data.items || []);
            setTotal(data.total || 0);
        } catch (err: any) {
            setError(err.message || 'تعذر تحميل الطلبات');
        } finally {
            setLoading(false);
        }
    }

    function copyValue(value?: string) {
        if (!value) return;
        navigator.clipboard.writeText(value).catch(() => null);
    }

    return (
        <section>
            <h2 style={{ marginBottom: '12px' }}>إدارة الطلبات والمدفوعات</h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: '10px', marginBottom: '14px' }}>
                <input
                    value={q}
                    onChange={(e) => {
                        setQ(e.target.value);
                        setPage(1);
                    }}
                    placeholder="بحث بـ orderId / userId / chargeId"
                    style={{ border: '1px solid var(--color-border)', borderRadius: '10px', padding: '10px 12px' }}
                />
                <select
                    value={status}
                    onChange={(e) => {
                        setStatus(e.target.value);
                        setPage(1);
                    }}
                    style={{ border: '1px solid var(--color-border)', borderRadius: '10px', padding: '10px 12px' }}
                >
                    {statusOptions.map((opt) => (
                        <option key={opt.value || 'all'} value={opt.value}>{opt.label}</option>
                    ))}
                </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', gap: '8px', flexWrap: 'wrap' }}>
                <a
                    href="https://dashboard.tap.company"
                    target="_blank"
                    rel="noreferrer"
                    style={{ textDecoration: 'none', color: 'var(--color-accent-strong)', fontWeight: 600 }}
                >
                    فتح لوحة Tap
                </a>
                <span style={{ color: 'var(--color-text-muted)' }}>نتائج: {total}</span>
            </div>

            {loading ? <p>جارٍ التحميل...</p> : null}
            {error ? <p style={{ color: 'var(--color-danger)' }}>{error}</p> : null}

            {!loading && !error && orders.length > 0 ? (
                <div className="dashboard-list" style={{ marginBottom: '14px' }}>
                    {orders.map((order) => (
                        <div className="dashboard-item" key={order.id}>
                            <div className="dashboard-item-info">
                                <strong>{order.id}</strong>
                                <span style={{ fontSize: '0.84rem', color: 'var(--color-text-muted)' }}>
                                    المستخدم: {order.user_email || order.user_id}
                                </span>
                                <span style={{ fontSize: '0.84rem', color: 'var(--color-text-muted)' }}>
                                    payment: {order.payment_status || '-'} · charge: {order.tap_charge_id || '-'}
                                </span>
                            </div>
                            <div className="dashboard-item-meta" style={{ alignItems: 'end', gap: '8px' }}>
                                <span style={{ fontWeight: 700 }}>
                                    {Number(order.total).toLocaleString('en-US')} {order.currency}
                                </span>
                                <span className="status-badge">{order.ui_status || order.status}</span>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                    <button type="button" onClick={() => copyValue(order.id)} style={miniBtn}>Copy Order</button>
                                    <button type="button" onClick={() => copyValue(order.tap_charge_id)} style={miniBtn}>Copy Charge</button>
                                    <Link href={`/admin/orders/${order.id}`} style={miniLink}>التفاصيل</Link>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : null}

            {!loading && !error && orders.length === 0 ? (
                <div style={{ padding: '20px', borderRadius: '10px', background: 'var(--color-surface)' }}>لا توجد نتائج</div>
            ) : null}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    style={miniBtn}
                >
                    السابق
                </button>
                <span>{page} / {pageCount}</span>
                <button
                    type="button"
                    disabled={page >= pageCount}
                    onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                    style={miniBtn}
                >
                    التالي
                </button>
            </div>
        </section>
    );
}

const miniBtn: CSSProperties = {
    border: '1px solid var(--color-border)',
    background: '#fff',
    borderRadius: '8px',
    padding: '6px 9px',
    fontSize: '0.82rem',
};

const miniLink: CSSProperties = {
    ...miniBtn,
    textDecoration: 'none',
    color: 'var(--color-text-primary)',
};