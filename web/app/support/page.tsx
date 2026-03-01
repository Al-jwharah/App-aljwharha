'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiFetch, parseApiError } from '../../lib/api';
import { getAccessToken } from '../../lib/auth';
import { UIButton, UICard, UIEmptyState, UIInput, UISelect, UITextarea, UITable, useToast } from '../../components/ui-kit';

type Ticket = {
    id: string;
    subject: string;
    category: string;
    priority: string;
    status: string;
    last_reply_at?: string;
    created_at: string;
    messages_count?: number;
};

export default function SupportPage() {
    const { push } = useToast();
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [loading, setLoading] = useState(true);
    const [subject, setSubject] = useState('');
    const [category, setCategory] = useState('PAYMENT');
    const [priority, setPriority] = useState('MEDIUM');
    const [message, setMessage] = useState('');
    const [saving, setSaving] = useState(false);

    const load = async () => {
        const token = getAccessToken();
        if (!token) {
            setLoading(false);
            return;
        }
        try {
            const res = await apiFetch<{ items: Ticket[] }>('/support/tickets', {}, token);
            setTickets(res.items || []);
        } catch (err) {
            push(parseApiError(err));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const token = typeof window !== 'undefined' ? getAccessToken() : null;

    return (
        <main className="page-shell">
            <section className="page-section">
                <h1 className="page-title">مركز الدعم والتذاكر</h1>
                <p className="page-subtitle">دعم تشغيلي فعلي 24/7 مع SLA حسب باقتك.</p>
            </section>

            {!token ? (
                <UIEmptyState title="تسجيل الدخول مطلوب" description="يرجى تسجيل الدخول لفتح تذكرة دعم ومتابعتها." />
            ) : (
                <>
                    <UICard className="page-section">
                        <h2 style={{ marginBottom: 10 }}>فتح تذكرة جديدة</h2>
                        <div style={{ display: 'grid', gap: 10 }}>
                            <div className="page-grid-3">
                                <div>
                                    <label style={{ display: 'block', marginBottom: 6 }}>الموضوع</label>
                                    <UIInput value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="مثال: تعذر إتمام الدفع" />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: 6 }}>التصنيف</label>
                                    <UISelect value={category} onChange={(e) => setCategory(e.target.value)}>
                                        <option value="PAYMENT">الدفع</option>
                                        <option value="ORDERS">الطلبات</option>
                                        <option value="LISTINGS">الإعلانات</option>
                                        <option value="LEGAL">قانوني</option>
                                        <option value="OTHER">أخرى</option>
                                    </UISelect>
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: 6 }}>الأولوية</label>
                                    <UISelect value={priority} onChange={(e) => setPriority(e.target.value)}>
                                        <option value="LOW">منخفضة</option>
                                        <option value="MEDIUM">متوسطة</option>
                                        <option value="HIGH">عالية</option>
                                        <option value="CRITICAL">حرجة</option>
                                    </UISelect>
                                </div>
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: 6 }}>الوصف</label>
                                <UITextarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="اكتب تفاصيل المشكلة بدقة" />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <UIButton
                                    type="button"
                                    disabled={saving}
                                    onClick={async () => {
                                        if (!subject.trim()) {
                                            push('الموضوع مطلوب');
                                            return;
                                        }
                                        if (!message.trim()) {
                                            push('وصف المشكلة مطلوب');
                                            return;
                                        }
                                        const localToken = getAccessToken();
                                        if (!localToken) {
                                            push('انتهت الجلسة، أعد تسجيل الدخول');
                                            return;
                                        }

                                        setSaving(true);
                                        try {
                                            await apiFetch('/support/tickets', {
                                                method: 'POST',
                                                body: JSON.stringify({
                                                    subject: subject.trim(),
                                                    category,
                                                    priority,
                                                    message: message.trim(),
                                                }),
                                            }, localToken);
                                            setSubject('');
                                            setMessage('');
                                            push('تم فتح التذكرة بنجاح');
                                            await load();
                                        } catch (err) {
                                            push(parseApiError(err));
                                        } finally {
                                            setSaving(false);
                                        }
                                    }}
                                >
                                    {saving ? 'جارٍ الإنشاء...' : 'فتح التذكرة'}
                                </UIButton>
                            </div>
                        </div>
                    </UICard>

                    <UICard>
                        <h2 style={{ marginBottom: 10 }}>تذاكري</h2>
                        {loading ? (
                            <p>جارٍ التحميل...</p>
                        ) : tickets.length === 0 ? (
                            <UIEmptyState title="لا توجد تذاكر" description="لم يتم فتح أي تذكرة بعد." />
                        ) : (
                            <UITable>
                                <thead>
                                    <tr>
                                        <th>الرقم</th>
                                        <th>الموضوع</th>
                                        <th>الحالة</th>
                                        <th>الأولوية</th>
                                        <th>آخر تحديث</th>
                                        <th>إجراء</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {tickets.map((ticket) => (
                                        <tr key={ticket.id}>
                                            <td>{ticket.id.slice(0, 8)}...</td>
                                            <td>{ticket.subject}</td>
                                            <td>{ticket.status}</td>
                                            <td>{ticket.priority}</td>
                                            <td>{new Date(ticket.last_reply_at || ticket.created_at).toLocaleString('ar-SA')}</td>
                                            <td>
                                                <Link href={`/support/tickets/${ticket.id}`}>
                                                    <UIButton type="button" variant="secondary">فتح</UIButton>
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </UITable>
                        )}
                    </UICard>
                </>
            )}
        </main>
    );
}
