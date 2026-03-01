'use client';

import { useState } from 'react';
import { apiFetch, parseApiError } from '../../lib/api';
import { getAccessToken } from '../../lib/auth';
import { UIButton, UICard, UIInput, UITextarea, useToast } from '../../components/ui-kit';

export default function AiPage() {
    const { push } = useToast();

    const [searchQuery, setSearchQuery] = useState('');
    const [searchResult, setSearchResult] = useState<any>(null);

    const [improveTitle, setImproveTitle] = useState('');
    const [improveDesc, setImproveDesc] = useState('');
    const [improveResult, setImproveResult] = useState<any>(null);

    return (
        <main className="page-shell">
            <section className="page-section">
                <h1 className="page-title">الذكاء الاصطناعي داخل المنصة</h1>
                <p className="page-subtitle">بحث ذكي، تحسين جودة الإعلان، ورؤى تشغيلية حقيقية.</p>
            </section>

            <section className="page-grid-2">
                <UICard>
                    <h2 style={{ marginBottom: 10 }}>AI Search Assistant</h2>
                    <UIInput value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="مثال: مصنع في الرياض أقل من 2000000" />
                    <div style={{ height: 10 }} />
                    <UIButton
                        type="button"
                        onClick={async () => {
                            if (!searchQuery.trim()) return;
                            try {
                                const res = await apiFetch('/ai/search', {
                                    method: 'POST',
                                    body: JSON.stringify({ query: searchQuery.trim(), locale: 'ar' }),
                                });
                                setSearchResult(res);
                            } catch (err) {
                                push(parseApiError(err));
                            }
                        }}
                    >
                        تشغيل البحث الذكي
                    </UIButton>
                    {searchResult ? (
                        <pre style={{ marginTop: 10, whiteSpace: 'pre-wrap', direction: 'ltr', textAlign: 'left', fontSize: 12 }}>
                            {JSON.stringify(searchResult, null, 2)}
                        </pre>
                    ) : null}
                </UICard>

                <UICard>
                    <h2 style={{ marginBottom: 10 }}>AI Seller Assistant</h2>
                    <UIInput value={improveTitle} onChange={(e) => setImproveTitle(e.target.value)} placeholder="عنوان الإعلان" />
                    <div style={{ height: 8 }} />
                    <UITextarea rows={5} value={improveDesc} onChange={(e) => setImproveDesc(e.target.value)} placeholder="وصف الإعلان" />
                    <div style={{ height: 10 }} />
                    <UIButton
                        type="button"
                        onClick={async () => {
                            const token = getAccessToken();
                            if (!token) {
                                push('يرجى تسجيل الدخول كبائع');
                                return;
                            }
                            try {
                                const res = await apiFetch('/ai/listing-improve', {
                                    method: 'POST',
                                    body: JSON.stringify({ title: improveTitle, description: improveDesc }),
                                }, token);
                                setImproveResult(res);
                            } catch (err) {
                                push(parseApiError(err));
                            }
                        }}
                    >
                        تحسين الإعلان
                    </UIButton>
                    {improveResult ? (
                        <pre style={{ marginTop: 10, whiteSpace: 'pre-wrap', direction: 'ltr', textAlign: 'left', fontSize: 12 }}>
                            {JSON.stringify(improveResult, null, 2)}
                        </pre>
                    ) : null}
                </UICard>
            </section>
        </main>
    );
}
