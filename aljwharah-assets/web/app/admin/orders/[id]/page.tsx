'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';

type OrderDetail = {
    id: string;
    user_id: string;
    user_email?: string;
    status: string;
    ui_status: string;
    total: string;
    total_amount?: string;
    subtotal_amount?: string;
    platform_fee_amount?: string;
    invoice_no?: string;
    currency: string;
    created_at: string;
    reserved_until?: string;
    payment?: {
        tap_charge_id?: string;
        status?: string;
        amount?: string;
        currency?: string;
        updated_at?: string;
    };
    items: Array<{ id: string; listing_id: string; title?: string; type?: string; price: string; currency: string; reserved_until?: string }>;
};

const timeline = ['RESERVED', 'PENDING_PAYMENT', 'PAID'];

export default function AdminOrderDetailPage() {
    const params = useParams();
    const orderId = params.id as string;
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'https://api.aljwharah.ai';

    const [order, setOrder] = useState<OrderDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [actionReason, setActionReason] = useState('');
    const [actionBusy, setActionBusy] = useState(false);
    const [actionMsg, setActionMsg] = useState('');

    const token = useMemo(
        () => (typeof window !== 'undefined' ? localStorage.getItem('aljwharah_token') : null),
        [],
    );

    useEffect(() => {
        loadOrder();
    }, [orderId]);

    async function loadOrder() {
        if (!token) {
            setError('يرجى تسجيل الدخول كمدير');
            setLoading(false);
            return;
        }

        try {
            const res = await fetch(`${apiBase}/admin/orders/${orderId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error('تعذر تحميل الطلب');
            const data = await res.json();
            setOrder(data);
            setError('');
        } catch (err: any) {
            setError(err.message || 'تعذر تحميل الطلب');
        } finally {
            setLoading(false);
        }
    }

    function copy(value?: string) {
        if (!value) return;
        navigator.clipboard.writeText(value).catch(() => null);
    }

    async function runAction(path: 'reconcile' | 'cancel' | 'mark-paid' | 'mark-refunded') {
        if (!token) return;
        if (path !== 'reconcile' && !actionReason.trim()) {
            setActionMsg('السبب مطلوب لتنفيذ هذا الإجراء');
            return;
        }

        setActionBusy(true);
        setActionMsg('');

        try {
            const method = path === 'reconcile' ? 'POST' : 'PATCH';
            const res = await fetch(`${apiBase}/admin/orders/${orderId}/${path}`, {
                method,
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: path === 'reconcile' ? undefined : JSON.stringify({ reason: actionReason.trim() }),
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                const msg = typeof data?.message === 'string' ? data.message : 'فشل تنفيذ الإجراء';
                throw new Error(msg);
            }

            setActionMsg('تم تنفيذ الإجراء بنجاح');
            await loadOrder();
        } catch (err: any) {
            setActionMsg(err.message || 'فشل تنفيذ الإجراء');
        } finally {
            setActionBusy(false);
        }
    }

    const currentStep = order?.ui_status === 'PAID' ? 2 : order?.ui_status === 'PENDING_PAYMENT' ? 1 : 0;

    return (
        <section>
            <Link href="/admin/orders" style={{ textDecoration: 'none', color: 'var(--color-accent-strong)' }}>← رجوع للطلبات</Link>
            <h2 style={{ marginTop: '8px', marginBottom: '14px' }}>تفاصيل الطلب</h2>

            {loading ? <p>جارٍ التحميل...</p> : null}
            {error ? <p style={{ color: 'var(--color-danger)' }}>{error}</p> : null}

            {order ? (
                <>
                    <div style={{ background: 'var(--color-surface)', borderRadius: '10px', padding: '14px', marginBottom: '14px' }}>
                        <p><strong>Order ID:</strong> {order.id} <button style={miniBtn} onClick={() => copy(order.id)}>Copy</button></p>
                        {order.invoice_no ? <p><strong>Invoice:</strong> {order.invoice_no}</p> : null}
                        <p><strong>User:</strong> {order.user_email || order.user_id}</p>
                        <p><strong>Status:</strong> {order.ui_status || order.status}</p>
                        <p><strong>Subtotal:</strong> {Number(order.subtotal_amount || 0).toLocaleString('en-US')} {order.currency}</p>
                        <p><strong>Platform Fee:</strong> {Number(order.platform_fee_amount || 0).toLocaleString('en-US')} {order.currency}</p>
                        <p><strong>Total:</strong> {Number(order.total_amount || order.total).toLocaleString('en-US')} {order.currency}</p>
                        <p><strong>Reserved Until:</strong> {order.reserved_until ? new Date(order.reserved_until).toLocaleString('ar-SA') : '-'}</p>
                    </div>

                    <div style={{ background: 'var(--color-surface)', borderRadius: '10px', padding: '14px', marginBottom: '14px' }}>
                        <h3 style={{ marginBottom: '8px' }}>Timeline</h3>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {timeline.map((step, idx) => (
                                <span
                                    key={step}
                                    style={{
                                        borderRadius: '999px',
                                        padding: '6px 10px',
                                        border: '1px solid var(--color-border)',
                                        background: idx <= currentStep ? 'var(--color-accent-strong)' : '#fff',
                                        color: idx <= currentStep ? '#fff' : 'var(--color-text-primary)',
                                        fontSize: '0.84rem',
                                    }}
                                >
                                    {step}
                                </span>
                            ))}
                            {(order.ui_status === 'FAILED' || order.ui_status === 'EXPIRED') ? (
                                <span style={{ borderRadius: '999px', padding: '6px 10px', background: 'var(--color-danger)', color: '#fff', fontSize: '0.84rem' }}>
                                    {order.ui_status}
                                </span>
                            ) : null}
                        </div>
                    </div>

                    <div style={{ background: 'var(--color-surface)', borderRadius: '10px', padding: '14px', marginBottom: '14px' }}>
                        <h3 style={{ marginBottom: '8px' }}>Payment Summary</h3>
                        <p>
                            <strong>Charge ID:</strong> {order.payment?.tap_charge_id || '-'}{' '}
                            {order.payment?.tap_charge_id ? <button style={miniBtn} onClick={() => copy(order.payment?.tap_charge_id)}>Copy</button> : null}
                        </p>
                        <p><strong>Status:</strong> {order.payment?.status || '-'}</p>
                        <p><strong>Amount:</strong> {order.payment?.amount ? Number(order.payment.amount).toLocaleString('en-US') : '-'} {order.payment?.currency || ''}</p>
                        <p><strong>Updated:</strong> {order.payment?.updated_at ? new Date(order.payment.updated_at).toLocaleString('ar-SA') : '-'}</p>
                    </div>

                    <div style={{ background: 'var(--color-surface)', borderRadius: '10px', padding: '14px', marginBottom: '14px' }}>
                        <h3 style={{ marginBottom: '8px' }}>Admin Actions</h3>
                        <textarea
                            rows={3}
                            placeholder="سبب الإجراء (مطلوب للإلغاء/التأكيد اليدوي)"
                            value={actionReason}
                            onChange={(e) => setActionReason(e.target.value)}
                            style={{ width: '100%', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '10px', marginBottom: '10px' }}
                        />
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <button type="button" style={actionBtn} disabled={actionBusy} onClick={() => runAction('reconcile')}>Reconcile</button>
                            <button type="button" style={{ ...actionBtn, background: '#b45309', color: '#fff' }} disabled={actionBusy} onClick={() => runAction('cancel')}>Cancel</button>
                            <button type="button" style={{ ...actionBtn, background: '#047857', color: '#fff' }} disabled={actionBusy} onClick={() => runAction('mark-paid')}>Mark Paid</button>
                            <button type="button" style={{ ...actionBtn, background: '#7c3aed', color: '#fff' }} disabled={actionBusy} onClick={() => runAction('mark-refunded')}>Mark Refunded</button>
                        </div>
                        {actionMsg ? <p style={{ marginTop: '10px', color: actionMsg.includes('نجاح') ? 'var(--color-success)' : 'var(--color-danger)' }}>{actionMsg}</p> : null}
                    </div>

                    <div style={{ background: 'var(--color-surface)', borderRadius: '10px', padding: '14px' }}>
                        <h3 style={{ marginBottom: '8px' }}>Order Items</h3>
                        <div className="dashboard-list">
                            {order.items.map((item) => (
                                <div key={item.id} className="dashboard-item">
                                    <div className="dashboard-item-info">
                                        <strong>{item.title || item.listing_id}</strong>
                                        <span style={{ fontSize: '0.84rem', color: 'var(--color-text-muted)' }}>{item.type || '-'}</span>
                                    </div>
                                    <span>{Number(item.price).toLocaleString('en-US')} {item.currency}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            ) : null}
        </section>
    );
}

const miniBtn: CSSProperties = {
    border: '1px solid var(--color-border)',
    background: '#fff',
    borderRadius: '8px',
    padding: '2px 8px',
    fontSize: '0.78rem',
    marginInlineStart: '6px',
};

const actionBtn: CSSProperties = {
    border: '1px solid var(--color-border)',
    background: '#fff',
    borderRadius: '8px',
    padding: '8px 12px',
    fontWeight: 600,
};