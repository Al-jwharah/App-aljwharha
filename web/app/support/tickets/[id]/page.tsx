'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiFetch, parseApiError } from '../../../../lib/api';
import { getAccessToken } from '../../../../lib/auth';
import { UIButton, UICard, UIEmptyState, UITextarea, useToast } from '../../../../components/ui-kit';

type TicketDetail = {
    id: string;
    subject: string;
    status: string;
    priority: string;
    category: string;
    messages: Array<{
        id: number;
        sender_type: 'USER' | 'AGENT' | 'SYSTEM';
        message: string;
        created_at: string;
    }>;
};

export default function SupportTicketDetailPage() {
    const params = useParams<{ id: string }>();
    const ticketId = String(params.id);
    const { push } = useToast();

    const [ticket, setTicket] = useState<TicketDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);

    const load = async () => {
        const token = getAccessToken();
        if (!token) {
            setLoading(false);
            return;
        }

        try {
            const data = await apiFetch<TicketDetail>(`/support/tickets/${ticketId}`, {}, token);
            setTicket(data);
        } catch (err) {
            push(parseApiError(err));
            setTicket(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, [ticketId]);

    if (loading) {
        return (
            <main className="page-shell">
                <UICard>جارٍ التحميل...</UICard>
            </main>
        );
    }

    if (!ticket) {
        return (
            <main className="page-shell">
                <UIEmptyState title="التذكرة غير متاحة" description="تعذر تحميل بيانات التذكرة." />
            </main>
        );
    }

    return (
        <main className="page-shell">
            <section className="page-section">
                <h1 className="page-title">{ticket.subject}</h1>
                <p className="page-subtitle">الحالة: {ticket.status} · الأولوية: {ticket.priority} · التصنيف: {ticket.category}</p>
            </section>

            <UICard className="page-section">
                <div style={{ display: 'grid', gap: 10 }}>
                    {ticket.messages?.map((msg) => (
                        <div key={msg.id} style={{ border: '1px solid var(--color-border)', borderRadius: 10, padding: 10, background: msg.sender_type === 'USER' ? '#f4f7ff' : '#fff' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, color: 'var(--color-text-muted)', fontSize: 12 }}>
                                <span>{msg.sender_type === 'USER' ? 'أنت' : msg.sender_type === 'AGENT' ? 'الدعم' : 'النظام'}</span>
                                <span>{new Date(msg.created_at).toLocaleString('ar-SA')}</span>
                            </div>
                            <p>{msg.message}</p>
                        </div>
                    ))}
                </div>
            </UICard>

            <UICard>
                <h2 style={{ marginBottom: 8 }}>إضافة رد</h2>
                <UITextarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="اكتب ردك هنا" />
                <div style={{ height: 10 }} />
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <UIButton
                        type="button"
                        disabled={sending}
                        onClick={async () => {
                            if (!message.trim()) {
                                push('اكتب نص الرد أولاً');
                                return;
                            }
                            const token = getAccessToken();
                            if (!token) {
                                push('يرجى تسجيل الدخول');
                                return;
                            }
                            setSending(true);
                            try {
                                await apiFetch(`/support/tickets/${ticketId}/messages`, {
                                    method: 'POST',
                                    body: JSON.stringify({ message: message.trim() }),
                                }, token);
                                setMessage('');
                                await load();
                                push('تم إرسال الرد');
                            } catch (err) {
                                push(parseApiError(err));
                            } finally {
                                setSending(false);
                            }
                        }}
                    >
                        {sending ? 'جارٍ الإرسال...' : 'إرسال الرد'}
                    </UIButton>
                </div>
            </UICard>
        </main>
    );
}
