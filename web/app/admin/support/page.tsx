'use client';

import { useEffect, useState } from 'react';
import { apiFetch, parseApiError } from '../../../lib/api';
import { getAccessToken } from '../../../lib/auth';
import { UIButton, UICard, UIInput, UISelect, UITextarea, UITable, useToast } from '../../../components/ui-kit';

type Ticket = {
    id: string;
    subject: string;
    status: string;
    priority: string;
    requester_email?: string;
    agent_user_id?: string;
    messages_count?: number;
    created_at: string;
};

type TicketDetail = Ticket & {
    messages: Array<{ id: number; sender_type: string; message: string; created_at: string }>;
};

export default function AdminSupportPage() {
    const { push } = useToast();
    const [items, setItems] = useState<Ticket[]>([]);
    const [selected, setSelected] = useState<TicketDetail | null>(null);
    const [statusFilter, setStatusFilter] = useState('');
    const [q, setQ] = useState('');
    const [reply, setReply] = useState('');
    const [status, setStatus] = useState('PENDING');
    const [reason, setReason] = useState('');

    const token = typeof window !== 'undefined' ? getAccessToken() : null;

    const load = async () => {
        if (!token) return;
        const params = new URLSearchParams();
        params.set('page', '1');
        params.set('pageSize', '100');
        if (statusFilter) params.set('status', statusFilter);
        if (q.trim()) params.set('q', q.trim());
        try {
            const res = await apiFetch<{ items: Ticket[] }>(`/admin/support/tickets?${params.toString()}`, {}, token);
            setItems(res.items || []);
        } catch (err) {
            push(parseApiError(err));
        }
    };

    useEffect(() => {
        load();
    }, [statusFilter, q]);

    return (
        <div className="page-grid-2" style={{ alignItems: 'start' }}>
            <UICard>
                <h2 style={{ marginBottom: 10 }}>قائمة التذاكر</h2>
                <div className="page-grid-2" style={{ marginBottom: 10 }}>
                    <UISelect value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                        <option value="">كل الحالات</option>
                        <option value="OPEN">OPEN</option>
                        <option value="PENDING">PENDING</option>
                        <option value="RESOLVED">RESOLVED</option>
                        <option value="CLOSED">CLOSED</option>
                    </UISelect>
                    <UIInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="subject / id / email" />
                </div>
                <UITable>
                    <thead>
                        <tr>
                            <th>التذكرة</th>
                            <th>الحالة</th>
                            <th>الأولوية</th>
                            <th>الإجراء</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item) => (
                            <tr key={item.id}>
                                <td>
                                    <div style={{ display: 'grid', gap: 4 }}>
                                        <strong>{item.subject}</strong>
                                        <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>{item.requester_email || item.id}</span>
                                    </div>
                                </td>
                                <td>{item.status}</td>
                                <td>{item.priority}</td>
                                <td>
                                    <UIButton
                                        type="button"
                                        variant="secondary"
                                        onClick={async () => {
                                            try {
                                                if (!token) return;
                                                const detail = await apiFetch<TicketDetail>(`/admin/support/tickets/${item.id}`, {}, token);
                                                setSelected(detail);
                                            } catch (err) {
                                                push(parseApiError(err));
                                            }
                                        }}
                                    >
                                        فتح
                                    </UIButton>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </UITable>
            </UICard>

            <UICard>
                {!selected ? (
                    <p style={{ color: 'var(--color-text-muted)' }}>اختر تذكرة من القائمة لعرض التفاصيل.</p>
                ) : (
                    <div style={{ display: 'grid', gap: 10 }}>
                        <h2>{selected.subject}</h2>
                        <p style={{ color: 'var(--color-text-muted)' }}>الحالة: {selected.status} · الأولوية: {selected.priority}</p>

                        <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: 10, padding: 10 }}>
                            {selected.messages?.map((m) => (
                                <div key={m.id} style={{ marginBottom: 10, borderBottom: '1px solid var(--color-border)', paddingBottom: 8 }}>
                                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 4 }}>{m.sender_type} · {new Date(m.created_at).toLocaleString('ar-SA')}</div>
                                    <p>{m.message}</p>
                                </div>
                            ))}
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: 6 }}>رد للدعم</label>
                            <TextareaWithAction
                                value={reply}
                                onChange={setReply}
                                actionLabel="إرسال الرد"
                                onAction={async () => {
                                    if (!reply.trim()) {
                                        push('اكتب الرد أولاً');
                                        return;
                                    }
                                    if (!token || !selected) return;
                                    try {
                                        await apiFetch(`/admin/support/tickets/${selected.id}/message`, {
                                            method: 'POST',
                                            body: JSON.stringify({ message: reply.trim() }),
                                        }, token);
                                        setReply('');
                                        const detail = await apiFetch<TicketDetail>(`/admin/support/tickets/${selected.id}`, {}, token);
                                        setSelected(detail);
                                        push('تم إرسال الرد');
                                    } catch (err) {
                                        push(parseApiError(err));
                                    }
                                }}
                            />
                        </div>

                        <div className="page-grid-2">
                            <UISelect value={status} onChange={(e) => setStatus(e.target.value)}>
                                <option value="OPEN">OPEN</option>
                                <option value="PENDING">PENDING</option>
                                <option value="RESOLVED">RESOLVED</option>
                                <option value="CLOSED">CLOSED</option>
                            </UISelect>
                            <UIInput value={reason} onChange={(e) => setReason(e.target.value)} placeholder="سبب التغيير" />
                        </div>
                        <UIButton
                            type="button"
                            onClick={async () => {
                                if (!reason.trim()) {
                                    push('سبب التحديث مطلوب');
                                    return;
                                }
                                if (!token || !selected) return;
                                try {
                                    await apiFetch(`/admin/support/tickets/${selected.id}/status`, {
                                        method: 'PATCH',
                                        body: JSON.stringify({ status, reason }),
                                    }, token);
                                    push('تم تحديث الحالة');
                                    await load();
                                    const detail = await apiFetch<TicketDetail>(`/admin/support/tickets/${selected.id}`, {}, token);
                                    setSelected(detail);
                                } catch (err) {
                                    push(parseApiError(err));
                                }
                            }}
                        >
                            تحديث الحالة
                        </UIButton>
                    </div>
                )}
            </UICard>
        </div>
    );
}

function TextareaWithAction({
    value,
    onChange,
    actionLabel,
    onAction,
}: {
    value: string;
    onChange: (value: string) => void;
    actionLabel: string;
    onAction: () => void;
}) {
    return (
        <div>
            <Textarea value={value} onChange={onChange} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                <UIButton type="button" onClick={onAction}>{actionLabel}</UIButton>
            </div>
        </div>
    );
}

function Textarea({ value, onChange }: { value: string; onChange: (value: string) => void }) {
    return <UITextarea rows={4} value={value} onChange={(e) => onChange(e.target.value)} placeholder="اكتب الرسالة" />;
}
