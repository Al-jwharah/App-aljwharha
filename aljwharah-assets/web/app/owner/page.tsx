'use client';

import { useEffect, useState } from 'react';
import { apiFetch, parseApiError } from '../../lib/api';
import { getAccessToken } from '../../lib/auth';
import { UIButton, UICard, UIInput, UISelect, UITabs, useToast } from '../../components/ui-kit';

type Dashboard = {
    financial: {
        gmv: string;
        fees: string;
        refunded: string;
    };
    totals: {
        users_count: number;
        listings_count: number;
        orders_count: number;
        auctions_count: number;
        ad_campaigns_count: number;
    };
};

type Settings = {
    commission_bps: number;
    minimum_fee: number;
    settlement_delay_days: number;
    auction_pick_next_highest: boolean;
    enforce_domain_allowlist: boolean;
};

export default function OwnerConsolePage() {
    const { push } = useToast();
    const [tab, setTab] = useState<'overview' | 'settings' | 'risk' | 'ops' | 'exports'>('overview');
    const [dashboard, setDashboard] = useState<Dashboard | null>(null);
    const [settings, setSettings] = useState<Settings | null>(null);
    const [reason, setReason] = useState('');
    const [risk, setRisk] = useState<any>(null);
    const [ops, setOps] = useState<any>(null);

    const load = async () => {
        const token = getAccessToken();
        if (!token) return;

        try {
            const [d, s, r, o] = await Promise.all([
                apiFetch<Dashboard>('/owner/dashboard', {}, token),
                apiFetch<Settings>('/owner/settings', {}, token),
                apiFetch('/owner/risk', {}, token),
                apiFetch('/owner/ops', {}, token),
            ]);
            setDashboard(d);
            setSettings(s);
            setRisk(r);
            setOps(o);
        } catch (err) {
            push(parseApiError(err));
        }
    };

    useEffect(() => {
        load();
    }, []);

    return (
        <main className="page-shell">
            <section className="page-section">
                <h1 className="page-title">لوحة المالك الشاملة</h1>
                <p className="page-subtitle">إدارة الأدوار والإعدادات والحوكمة والمخاطر والتصدير من مكان واحد.</p>
            </section>

            <UITabs
                value={tab}
                onChange={setTab}
                options={[
                    { value: 'overview', label: 'نظرة عامة' },
                    { value: 'settings', label: 'الإعدادات' },
                    { value: 'risk', label: 'مركز المخاطر' },
                    { value: 'ops', label: 'عمليات النظام' },
                    { value: 'exports', label: 'التصدير' },
                ]}
            />

            <div style={{ height: 14 }} />

            {tab === 'overview' && dashboard ? (
                <div className="page-grid-3">
                    <UICard>
                        <h3>GMV</h3>
                        <p style={{ fontFamily: 'var(--font-latin)', fontWeight: 800 }}>{Number(dashboard.financial.gmv || 0).toLocaleString('en-US')} SAR</p>
                    </UICard>
                    <UICard>
                        <h3>الرسوم</h3>
                        <p style={{ fontFamily: 'var(--font-latin)', fontWeight: 800 }}>{Number(dashboard.financial.fees || 0).toLocaleString('en-US')} SAR</p>
                    </UICard>
                    <UICard>
                        <h3>المسترد</h3>
                        <p style={{ fontFamily: 'var(--font-latin)', fontWeight: 800 }}>{Number(dashboard.financial.refunded || 0).toLocaleString('en-US')} SAR</p>
                    </UICard>
                    <UICard>
                        <h3>المستخدمون</h3>
                        <p>{dashboard.totals.users_count}</p>
                    </UICard>
                    <UICard>
                        <h3>الإعلانات</h3>
                        <p>{dashboard.totals.listings_count}</p>
                    </UICard>
                    <UICard>
                        <h3>الطلبات</h3>
                        <p>{dashboard.totals.orders_count}</p>
                    </UICard>
                </div>
            ) : null}

            {tab === 'settings' && settings ? (
                <UICard>
                    <div className="page-grid-2">
                        <div>
                            <label style={{ display: 'block', marginBottom: 6 }}>العمولة (bps)</label>
                            <UIInput type="number" value={settings.commission_bps} onChange={(e) => setSettings((prev) => prev ? ({ ...prev, commission_bps: Number(e.target.value) }) : prev)} />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: 6 }}>الحد الأدنى للرسوم</label>
                            <UIInput type="number" value={settings.minimum_fee} onChange={(e) => setSettings((prev) => prev ? ({ ...prev, minimum_fee: Number(e.target.value) }) : prev)} />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: 6 }}>تأخير التسوية (أيام)</label>
                            <UIInput type="number" value={settings.settlement_delay_days} onChange={(e) => setSettings((prev) => prev ? ({ ...prev, settlement_delay_days: Number(e.target.value) }) : prev)} />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: 6 }}>اختيار ثاني أعلى مزايدة</label>
                            <UISelect
                                value={String(settings.auction_pick_next_highest)}
                                onChange={(e) => setSettings((prev) => prev ? ({ ...prev, auction_pick_next_highest: e.target.value === 'true' }) : prev)}
                            >
                                <option value="false">معطل</option>
                                <option value="true">مفعل</option>
                            </UISelect>
                        </div>
                    </div>
                    <div style={{ marginTop: 10 }}>
                        <label style={{ display: 'block', marginBottom: 6 }}>سبب التعديل</label>
                        <UIInput value={reason} onChange={(e) => setReason(e.target.value)} placeholder="سبب إلزامي للتدقيق" />
                    </div>
                    <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
                        <UIButton
                            type="button"
                            onClick={async () => {
                                if (!reason.trim()) {
                                    push('سبب التعديل مطلوب');
                                    return;
                                }
                                const token = getAccessToken();
                                if (!token || !settings) return;
                                try {
                                    await apiFetch('/owner/settings', {
                                        method: 'PATCH',
                                        body: JSON.stringify({ ...settings, reason }),
                                    }, token);
                                    setReason('');
                                    push('تم حفظ الإعدادات');
                                    await load();
                                } catch (err) {
                                    push(parseApiError(err));
                                }
                            }}
                        >
                            حفظ التغييرات
                        </UIButton>
                    </div>
                </UICard>
            ) : null}

            {tab === 'risk' ? (
                <UICard>
                    <pre style={{ whiteSpace: 'pre-wrap', direction: 'ltr', textAlign: 'left' }}>{JSON.stringify(risk, null, 2)}</pre>
                </UICard>
            ) : null}

            {tab === 'ops' ? (
                <UICard>
                    <pre style={{ whiteSpace: 'pre-wrap', direction: 'ltr', textAlign: 'left' }}>{JSON.stringify(ops, null, 2)}</pre>
                </UICard>
            ) : null}

            {tab === 'exports' ? (
                <UICard>
                    <h3 style={{ marginBottom: 8 }}>تصدير البيانات (CSV)</h3>
                    <p style={{ color: 'var(--color-text-muted)', marginBottom: 10 }}>اختر نوع البيانات وسيتم تنزيل الملف فورًا عبر API.</p>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {['orders', 'users', 'listings', 'ads', 'auctions', 'audit'].map((entity) => (
                            <UIButton
                                key={entity}
                                type="button"
                                variant="secondary"
                                onClick={async () => {
                                    const token = getAccessToken();
                                    if (!token) return;
                                    try {
                                        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://api.aljwharah.ai'}/owner/exports/${entity}`, {
                                            headers: { Authorization: `Bearer ${token}` },
                                        });
                                        if (!response.ok) throw new Error('تعذر تنزيل الملف');
                                        const blob = await response.blob();
                                        const url = URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = `${entity}-${new Date().toISOString().slice(0, 10)}.csv`;
                                        document.body.appendChild(a);
                                        a.click();
                                        a.remove();
                                        URL.revokeObjectURL(url);
                                    } catch (err) {
                                        push(parseApiError(err));
                                    }
                                }}
                            >
                                {entity}
                            </UIButton>
                        ))}
                    </div>
                </UICard>
            ) : null}
        </main>
    );
}

