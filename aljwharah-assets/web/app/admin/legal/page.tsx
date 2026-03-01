'use client';

import { useEffect, useState } from 'react';
import { apiFetch, parseApiError } from '../../../lib/api';
import { getAccessToken } from '../../../lib/auth';
import { UIButton, UICard, UIInput, UISelect, UITable, useToast } from '../../../components/ui-kit';

type Report = {
    id: string;
    listing_id?: string;
    listing_title?: string;
    reason: string;
    status: string;
    reporter_email?: string;
    created_at: string;
};

export default function AdminLegalPage() {
    const { push } = useToast();
    const [items, setItems] = useState<Report[]>([]);
    const [status, setStatus] = useState('OPEN');
    const [q, setQ] = useState('');
    const token = typeof window !== 'undefined' ? getAccessToken() : null;

    const load = async () => {
        if (!token) return;

        const params = new URLSearchParams();
        params.set('page', '1');
        params.set('pageSize', '100');
        if (status) params.set('status', status);
        if (q.trim()) params.set('q', q.trim());

        try {
            const res = await apiFetch<{ items: Report[] }>(`/admin/legal/reports?${params.toString()}`, {}, token);
            setItems(res.items || []);
        } catch (err) {
            push(parseApiError(err));
        }
    };

    useEffect(() => { load(); }, [status, q]);

    return (
        <UICard>
            <h2 style={{ marginBottom: 8 }}>بلاغات الملكية الفكرية</h2>
            <div className="page-grid-3" style={{ marginBottom: 10 }}>
                <UISelect value={status} onChange={(e) => setStatus(e.target.value)}>
                    <option value="">الكل</option>
                    <option value="OPEN">OPEN</option>
                    <option value="IN_REVIEW">IN_REVIEW</option>
                    <option value="RESOLVED">RESOLVED</option>
                    <option value="REJECTED">REJECTED</option>
                </UISelect>
                <UIInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث" />
                <UIButton type="button" onClick={load}>تحديث</UIButton>
            </div>
            <UITable>
                <thead>
                    <tr>
                        <th>البلاغ</th>
                        <th>السبب</th>
                        <th>الحالة</th>
                        <th>الإجراء</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((r) => (
                        <tr key={r.id}>
                            <td>
                                <div style={{ display: 'grid', gap: 4 }}>
                                    <strong>{r.id.slice(0, 8)}...</strong>
                                    <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>{r.listing_title || r.listing_id || '-'}</span>
                                </div>
                            </td>
                            <td>{r.reason}</td>
                            <td>{r.status}</td>
                            <td>
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                    <ResolveAction reportId={r.id} nextStatus="IN_REVIEW" reason="مراجعة أولية" actionTaken="request_docs" label="طلب مستندات" onDone={load} />
                                    <ResolveAction reportId={r.id} nextStatus="RESOLVED" reason="ثبوت الانتهاك" actionTaken="hide_listing" label="إخفاء الإعلان" onDone={load} />
                                    <ResolveAction reportId={r.id} nextStatus="REJECTED" reason="بلاغ غير مثبت" label="رفض البلاغ" onDone={load} />
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </UITable>
        </UICard>
    );
}

function ResolveAction({
    reportId,
    nextStatus,
    reason,
    actionTaken,
    label,
    onDone,
}: {
    reportId: string;
    nextStatus: string;
    reason: string;
    actionTaken?: string;
    label: string;
    onDone: () => void;
}) {
    const { push } = useToast();
    return (
        <UIButton
            type="button"
            variant="secondary"
            onClick={async () => {
                const token = getAccessToken();
                if (!token) return;
                try {
                    await apiFetch(`/admin/legal/reports/${reportId}/resolve`, {
                        method: 'PATCH',
                        body: JSON.stringify({ status: nextStatus, reason, actionTaken }),
                    }, token);
                    push('تم تحديث البلاغ');
                    onDone();
                } catch (err) {
                    push(parseApiError(err));
                }
            }}
        >
            {label}
        </UIButton>
    );
}
