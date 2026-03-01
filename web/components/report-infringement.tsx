'use client';

import { useState } from 'react';
import { apiFetch, parseApiError } from '../lib/api';
import { getAccessToken } from '../lib/auth';
import { UIButton, UIInput, UIModal, UITextarea } from './ui-kit';

export function ReportInfringementButton({ listingId }: { listingId: string }) {
    const [open, setOpen] = useState(false);
    const [reason, setReason] = useState('');
    const [details, setDetails] = useState('');
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    const submit = async () => {
        const token = getAccessToken();
        if (!token) {
            setMessage('يرجى تسجيل الدخول لتقديم بلاغ.');
            return;
        }
        if (!reason.trim()) {
            setMessage('سبب البلاغ مطلوب.');
            return;
        }

        setSaving(true);
        setMessage(null);
        try {
            await apiFetch('/legal/reports', {
                method: 'POST',
                body: JSON.stringify({ listingId, reason: reason.trim(), details: details.trim() || undefined }),
            }, token);
            setMessage('تم إرسال البلاغ بنجاح.');
            setReason('');
            setDetails('');
        } catch (err) {
            setMessage(parseApiError(err));
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            <UIButton type="button" variant="danger" onClick={() => setOpen(true)}>
                الإبلاغ عن انتهاك
            </UIButton>
            <UIModal open={open} onClose={() => setOpen(false)} title="بلاغ انتهاك حقوق">
                <div style={{ display: 'grid', gap: 10 }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: 6 }}>سبب البلاغ</label>
                        <UIInput value={reason} onChange={(e) => setReason(e.target.value)} placeholder="مثال: انتهاك علامة تجارية" />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: 6 }}>تفاصيل إضافية</label>
                        <UITextarea rows={4} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="أي معلومات أو روابط داعمة" />
                    </div>
                    {message ? <p style={{ color: 'var(--color-text-muted)' }}>{message}</p> : null}
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <UIButton variant="secondary" onClick={() => setOpen(false)}>إغلاق</UIButton>
                        <UIButton onClick={submit} disabled={saving}>{saving ? 'جارٍ الإرسال...' : 'إرسال البلاغ'}</UIButton>
                    </div>
                </div>
            </UIModal>
        </>
    );
}
