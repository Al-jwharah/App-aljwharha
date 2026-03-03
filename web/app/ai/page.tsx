'use client';

import { useState } from 'react';
import { apiFetch, parseApiError } from '../../lib/api';
import { getAccessToken } from '../../lib/auth';
import { UIButton, UICard, UIInput, UITextarea, useToast } from '../../components/ui-kit';

export default function AiPage() {
    const { push } = useToast();

    const [searchQuery, setSearchQuery] = useState('');
    const [searchResult, setSearchResult] = useState<any>(null);
    const [searchLoading, setSearchLoading] = useState(false);

    const [improveTitle, setImproveTitle] = useState('');
    const [improveDesc, setImproveDesc] = useState('');
    const [improveResult, setImproveResult] = useState<any>(null);
    const [improveLoading, setImproveLoading] = useState(false);

    const [ticketId, setTicketId] = useState('');
    const [ticketMessage, setTicketMessage] = useState('');
    const [supportDraftResult, setSupportDraftResult] = useState<any>(null);
    const [supportLoading, setSupportLoading] = useState(false);

    const [adminInsights, setAdminInsights] = useState<any>(null);
    const [agentReport, setAgentReport] = useState<any>(null);
    const [adminLoading, setAdminLoading] = useState(false);

    async function callAuthed(path: string, body?: Record<string, unknown>) {
        const token = getAccessToken();
        if (!token) {
            throw new Error('يرجى تسجيل الدخول بحساب مخوّل (Admin/Agent)');
        }

        return apiFetch(path, {
            method: 'POST',
            body: body ? JSON.stringify(body) : undefined,
        }, token);
    }

    return (
        <main className="page-shell">
            <section className="page-section">
                <h1 className="page-title">الوكيل الذكي داخل المنصة</h1>
                <p className="page-subtitle">بحث ذكي، تحسين الإعلانات، ومساعد عمليات احترافي مع تقرير تنفيذي.</p>
            </section>

            <section className="page-grid-2">
                <UICard>
                    <h2 style={{ marginBottom: 10 }}>Smart Search Agent</h2>
                    <UIInput value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="مثال: مصنع في الرياض أقل من 2000000" />
                    <div style={{ height: 10 }} />
                    <UIButton
                        type="button"
                        disabled={searchLoading}
                        onClick={async () => {
                            if (!searchQuery.trim()) return;
                            setSearchLoading(true);
                            try {
                                const res = await apiFetch('/ai/search', {
                                    method: 'POST',
                                    body: JSON.stringify({ query: searchQuery.trim(), locale: 'ar' }),
                                });
                                setSearchResult(res);
                            } catch (err) {
                                push(parseApiError(err));
                            } finally {
                                setSearchLoading(false);
                            }
                        }}
                    >
                        {searchLoading ? 'جاري التحليل...' : 'تشغيل البحث الذكي'}
                    </UIButton>
                    {searchResult ? (
                        <pre style={{ marginTop: 10, whiteSpace: 'pre-wrap', direction: 'ltr', textAlign: 'left', fontSize: 12 }}>
                            {JSON.stringify(searchResult, null, 2)}
                        </pre>
                    ) : null}
                </UICard>

                <UICard>
                    <h2 style={{ marginBottom: 10 }}>Listing Improvement Agent</h2>
                    <UIInput value={improveTitle} onChange={(e) => setImproveTitle(e.target.value)} placeholder="عنوان الإعلان" />
                    <div style={{ height: 8 }} />
                    <UITextarea rows={5} value={improveDesc} onChange={(e) => setImproveDesc(e.target.value)} placeholder="وصف الإعلان" />
                    <div style={{ height: 10 }} />
                    <UIButton
                        type="button"
                        disabled={improveLoading}
                        onClick={async () => {
                            setImproveLoading(true);
                            try {
                                const res = await callAuthed('/ai/listing-improve', {
                                    title: improveTitle,
                                    description: improveDesc,
                                });
                                setImproveResult(res);
                            } catch (err) {
                                push(parseApiError(err));
                            } finally {
                                setImproveLoading(false);
                            }
                        }}
                    >
                        {improveLoading ? 'جاري التحسين...' : 'تحسين الإعلان'}
                    </UIButton>
                    {improveResult ? (
                        <pre style={{ marginTop: 10, whiteSpace: 'pre-wrap', direction: 'ltr', textAlign: 'left', fontSize: 12 }}>
                            {JSON.stringify(improveResult, null, 2)}
                        </pre>
                    ) : null}
                </UICard>
            </section>

            <section style={{ marginTop: 18 }}>
                <UICard>
                    <h2 style={{ marginBottom: 10 }}>Professional Agent Console</h2>
                    <p style={{ marginTop: 0, marginBottom: 12, opacity: 0.8 }}>لوحة تشغيل الوكيل للإدارة: مسودات دعم، رؤى تشغيلية، وتقرير تنفيذي كامل.</p>

                    <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))' }}>
                        <UIButton
                            type="button"
                            disabled={adminLoading}
                            onClick={async () => {
                                setAdminLoading(true);
                                try {
                                    const res = await callAuthed('/ai/admin-insights');
                                    setAdminInsights(res);
                                } catch (err) {
                                    push(parseApiError(err));
                                } finally {
                                    setAdminLoading(false);
                                }
                            }}
                        >
                            {adminLoading ? 'جاري التحليل...' : 'تحديث رؤى الإدارة'}
                        </UIButton>

                        <UIButton
                            type="button"
                            variant="secondary"
                            disabled={adminLoading}
                            onClick={async () => {
                                setAdminLoading(true);
                                try {
                                    const res = await callAuthed('/ai/agent-report');
                                    setAgentReport(res);
                                } catch (err) {
                                    push(parseApiError(err));
                                } finally {
                                    setAdminLoading(false);
                                }
                            }}
                        >
                            {adminLoading ? 'جاري الإنشاء...' : 'تقرير الوكيل التنفيذي'}
                        </UIButton>
                    </div>

                    <div style={{ height: 14 }} />
                    <h3 style={{ marginTop: 0 }}>مسودة رد تذكرة دعم</h3>
                    <UIInput value={ticketId} onChange={(e) => setTicketId(e.target.value)} placeholder="Ticket ID" dir="ltr" />
                    <div style={{ height: 8 }} />
                    <UITextarea rows={4} value={ticketMessage} onChange={(e) => setTicketMessage(e.target.value)} placeholder="رسالة العميل" />
                    <div style={{ height: 10 }} />
                    <UIButton
                        type="button"
                        disabled={supportLoading}
                        onClick={async () => {
                            if (!ticketId.trim() || !ticketMessage.trim()) {
                                push('أدخل رقم التذكرة ورسالة العميل أولًا');
                                return;
                            }
                            setSupportLoading(true);
                            try {
                                const res = await callAuthed('/ai/support-draft', {
                                    ticketId: ticketId.trim(),
                                    userMessage: ticketMessage.trim(),
                                    locale: 'ar',
                                });
                                setSupportDraftResult(res);
                            } catch (err) {
                                push(parseApiError(err));
                            } finally {
                                setSupportLoading(false);
                            }
                        }}
                    >
                        {supportLoading ? 'جاري التوليد...' : 'توليد مسودة احترافية'}
                    </UIButton>

                    {supportDraftResult ? (
                        <pre style={{ marginTop: 10, whiteSpace: 'pre-wrap', direction: 'ltr', textAlign: 'left', fontSize: 12 }}>
                            {JSON.stringify(supportDraftResult, null, 2)}
                        </pre>
                    ) : null}

                    {adminInsights ? (
                        <pre style={{ marginTop: 10, whiteSpace: 'pre-wrap', direction: 'ltr', textAlign: 'left', fontSize: 12 }}>
                            {JSON.stringify(adminInsights, null, 2)}
                        </pre>
                    ) : null}

                    {agentReport ? (
                        <pre style={{ marginTop: 10, whiteSpace: 'pre-wrap', direction: 'ltr', textAlign: 'left', fontSize: 12 }}>
                            {JSON.stringify(agentReport, null, 2)}
                        </pre>
                    ) : null}
                </UICard>
            </section>
        </main>
    );
}
