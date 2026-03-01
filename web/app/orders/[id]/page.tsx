'use client';

import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { apiFetch, parseApiError } from '../../../lib/api';
import { getAccessToken } from '../../../lib/auth';
import { UIBadge, UIButton, UICard, UIEmptyState, UITable, useToast } from '../../../components/ui-kit';

type OrderItem = {
    listingId: string;
    title?: string;
    type?: string;
    price: string;
    currency?: string;
};

type OrderDetail = {
    id: string;
    status: string;
    ui_status?: string;
    total?: string;
    total_amount?: string;
    subtotal_amount?: string;
    platform_fee_amount?: string;
    invoice_no?: string;
    currency?: string;
    created_at: string;
    reserved_until?: string;
    items: OrderItem[];
};

type OrderEvent = {
    id: number;
    type: string;
    message: string;
    actor_role?: string;
    created_at: string;
};

const statusMap: Record<string, { label: string; tone: 'info' | 'success' | 'warning' | 'danger'; message: (until?: string) => string }> = {
    RESERVED: {
        label: 'محجوز مؤقتًا',
        tone: 'warning',
        message: (until) => `تم حجز الطلب مؤقتًا حتى ${formatUntil(until)}`,
    },
    PENDING_PAYMENT: {
        label: 'بانتظار الدفع',
        tone: 'warning',
        message: (until) => `تم حجز الطلب مؤقتًا حتى ${formatUntil(until)}`,
    },
    PAID: {
        label: 'مدفوع',
        tone: 'success',
        message: () => 'تم الدفع بنجاح',
    },
    FULFILLED: {
        label: 'مكتمل',
        tone: 'success',
        message: () => 'تم تنفيذ الطلب وتسليمه من البائع',
    },
    FAILED: {
        label: 'فشل الدفع',
        tone: 'danger',
        message: () => 'فشل الدفع وتم إلغاء الحجز',
    },
    CANCELLED: {
        label: 'ملغي',
        tone: 'danger',
        message: () => 'فشل الدفع وتم إلغاء الحجز',
    },
    EXPIRED: {
        label: 'انتهت المهلة',
        tone: 'danger',
        message: () => 'انتهت مهلة الحجز',
    },
};

function formatUntil(value?: string) {
    if (!value) return '-';
    return new Date(value).toLocaleString('ar-SA');
}

function formatCountdown(msLeft: number) {
    const totalSec = Math.max(0, Math.floor(msLeft / 1000));
    const h = Math.floor(totalSec / 3600).toString().padStart(2, '0');
    const m = Math.floor((totalSec % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(totalSec % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
}

export default function OrderDetailPage() {
    const params = useParams();
    const orderId = String(params.id);
    const { push } = useToast();

    const [order, setOrder] = useState<OrderDetail | null>(null);
    const [events, setEvents] = useState<OrderEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [paying, setPaying] = useState(false);
    const [now, setNow] = useState(Date.now());

    const token = useMemo(() => {
        if (typeof window === 'undefined') return null;
        return getAccessToken() || localStorage.getItem('aljwharah_token');
    }, []);

    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);

    const load = async () => {
        if (!token) {
            setLoading(false);
            return;
        }

        try {
            const [orderData, eventsData] = await Promise.all([
                apiFetch<OrderDetail>(`/orders/${orderId}`, {}, token),
                apiFetch<{ items: OrderEvent[] }>(`/orders/${orderId}/events`, {}, token),
            ]);
            setOrder(orderData);
            setEvents(eventsData.items || []);
        } catch (err) {
            push(parseApiError(err));
            setOrder(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, [orderId, token]);

    async function handleRetryPayment() {
        if (!token || !order) return;
        setPaying(true);

        try {
            await apiFetch(`/orders/${orderId}/retry-payment`, { method: 'POST' }, token);
            const payData = await apiFetch<{ transactionUrl?: string }>(
                '/payments/create',
                {
                    method: 'POST',
                    body: JSON.stringify({ orderId }),
                },
                token,
            );

            if (payData.transactionUrl) {
                window.location.href = payData.transactionUrl;
                return;
            }

            push('تم تجهيز محاولة الدفع، حدّث الصفحة للتحقق من الحالة.');
        } catch (err) {
            push(parseApiError(err));
        } finally {
            setPaying(false);
        }
    }

    if (loading) {
        return <main className="page-shell"><UICard>جارٍ التحميل...</UICard></main>;
    }

    if (!token) {
        return <main className="page-shell"><UIEmptyState title="تسجيل الدخول مطلوب" description="يرجى تسجيل الدخول لعرض الطلب." /></main>;
    }

    if (!order) {
        return <main className="page-shell"><UIEmptyState title="الطلب غير متاح" description="تعذر تحميل بيانات الطلب." /></main>;
    }

    const statusCode = order.ui_status || order.status || '';
    const status = statusMap[statusCode] || {
        label: statusCode,
        tone: 'info' as const,
        message: () => '',
    };

    const reservationMsLeft = order.reserved_until ? new Date(order.reserved_until).getTime() - now : 0;
    const canRetryPayment = Boolean(
        order &&
        statusCode === 'PENDING_PAYMENT' &&
        order.reserved_until &&
        reservationMsLeft > 0,
    );

    const subtotal = Number(order.subtotal_amount || 0);
    const platformFee = Number(order.platform_fee_amount || 0);
    const total = Number(order.total_amount ?? order.total ?? 0);

    return (
        <main className="page-shell">
            <section className="page-section">
                <h1 className="page-title">تفاصيل الطلب</h1>
                <p className="page-subtitle">رقم الطلب: {order.id}</p>
            </section>

            <section className="page-grid-2">
                <UICard>
                    <div style={{ display: 'grid', gap: 8 }}>
                        <p><strong>رقم الفاتورة:</strong> {order.invoice_no || '-'}</p>
                        <p><strong>الحالة:</strong> <UIBadge tone={status.tone}>{status.label}</UIBadge></p>
                        <p>{status.message(order.reserved_until)}</p>
                        {statusCode === 'PENDING_PAYMENT' && reservationMsLeft > 0 ? (
                            <p><strong>المتبقي للحجز:</strong> <span style={{ fontFamily: 'var(--font-latin)' }}>{formatCountdown(reservationMsLeft)}</span></p>
                        ) : null}
                        <p><strong>المجموع الفرعي:</strong> {subtotal.toLocaleString('en-US')} {order.currency || 'SAR'}</p>
                        <p><strong>رسوم المنصة:</strong> {platformFee.toLocaleString('en-US')} {order.currency || 'SAR'}</p>
                        <p><strong>الإجمالي:</strong> {total.toLocaleString('en-US')} {order.currency || 'SAR'}</p>
                        <p><strong>التاريخ:</strong> {new Date(order.created_at).toLocaleString('ar-SA')}</p>
                    </div>

                    {canRetryPayment ? (
                        <div style={{ marginTop: 10 }}>
                            <UIButton type="button" onClick={handleRetryPayment} disabled={paying} style={{ width: '100%' }}>
                                {paying ? 'جارٍ تحويلك للدفع...' : 'إعادة محاولة الدفع'}
                            </UIButton>
                        </div>
                    ) : null}
                </UICard>

                <UICard>
                    <h3 style={{ marginBottom: 8 }}>التايملاين</h3>
                    {events.length === 0 ? (
                        <p style={{ color: 'var(--color-text-muted)' }}>لا توجد أحداث بعد.</p>
                    ) : (
                        <div style={{ display: 'grid', gap: 8 }}>
                            {events.map((event) => (
                                <div key={event.id} style={{ border: '1px solid var(--color-border)', borderRadius: 10, padding: 10 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 4 }}>
                                        <span>{event.type} · {event.actor_role || 'SYSTEM'}</span>
                                        <span>{new Date(event.created_at).toLocaleString('ar-SA')}</span>
                                    </div>
                                    <p>{event.message}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </UICard>
            </section>

            <section className="page-section" style={{ marginTop: 16 }}>
                <UICard>
                    <h3 style={{ marginBottom: 8 }}>عناصر الطلب</h3>
                    <UITable>
                        <thead>
                            <tr>
                                <th>العنصر</th>
                                <th>النوع</th>
                                <th>السعر</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(order.items || []).map((item, idx) => (
                                <tr key={`${item.listingId}-${idx}`}>
                                    <td>{item.title || item.listingId}</td>
                                    <td>{item.type || '-'}</td>
                                    <td>{Number(item.price || 0).toLocaleString('en-US')} {item.currency || 'SAR'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </UITable>
                </UICard>
            </section>
        </main>
    );
}
