'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiFetch, parseApiError } from '../../lib/api';
import { getAccessToken } from '../../lib/auth';
import { UIBadge, UIButton, UICard, UIEmptyState, UITable, useToast } from '../../components/ui-kit';

type Order = {
    id: string;
    status: string;
    ui_status?: string;
    invoice_no?: string;
    total_amount?: string;
    total?: string;
    currency?: string;
    created_at: string;
    reserved_until?: string;
};

const toneByStatus: Record<string, 'info' | 'success' | 'warning' | 'danger'> = {
    PENDING_PAYMENT: 'warning',
    PAID: 'success',
    FULFILLED: 'success',
    RESERVED: 'warning',
    CANCELLED: 'danger',
    EXPIRED: 'danger',
    FAILED: 'danger',
};

export default function OrdersPage() {
    const { push } = useToast();
    const [items, setItems] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = getAccessToken() || (typeof window !== 'undefined' ? localStorage.getItem('aljwharah_token') : null);
        if (!token) {
            setLoading(false);
            return;
        }

        apiFetch<{ data: Order[] }>('/orders', {}, token)
            .then((res) => setItems(res.data || []))
            .catch((err) => push(parseApiError(err)))
            .finally(() => setLoading(false));
    }, [push]);

    if (loading) {
        return <main className="page-shell"><UICard>جارٍ التحميل...</UICard></main>;
    }

    if ((getAccessToken() || (typeof window !== 'undefined' ? localStorage.getItem('aljwharah_token') : null)) === null) {
        return <main className="page-shell"><UIEmptyState title="تسجيل الدخول مطلوب" description="يرجى تسجيل الدخول لعرض الطلبات." /></main>;
    }

    return (
        <main className="page-shell">
            <section className="page-section">
                <h1 className="page-title">طلباتي</h1>
                <p className="page-subtitle">متابعة جميع الطلبات والفواتير وحالات الدفع.</p>
            </section>

            {items.length === 0 ? (
                <UIEmptyState title="لا توجد طلبات" description="لم يتم إنشاء أي طلب حتى الآن." />
            ) : (
                <UICard>
                    <UITable>
                        <thead>
                            <tr>
                                <th>الطلب</th>
                                <th>الفاتورة</th>
                                <th>الحالة</th>
                                <th>القيمة</th>
                                <th>التاريخ</th>
                                <th>الإجراء</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((order) => {
                                const status = order.ui_status || order.status;
                                return (
                                    <tr key={order.id}>
                                        <td>{order.id.slice(0, 8)}...</td>
                                        <td>{order.invoice_no || '-'}</td>
                                        <td><UIBadge tone={toneByStatus[status] || 'info'}>{status}</UIBadge></td>
                                        <td>{Number(order.total_amount ?? order.total ?? 0).toLocaleString('en-US')} {order.currency || 'SAR'}</td>
                                        <td>{new Date(order.created_at).toLocaleDateString('ar-SA')}</td>
                                        <td>
                                            <Link href={`/orders/${order.id}`}>
                                                <UIButton type="button" variant="secondary">تفاصيل</UIButton>
                                            </Link>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </UITable>
                </UICard>
            )}
        </main>
    );
}
