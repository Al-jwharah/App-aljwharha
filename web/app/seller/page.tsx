'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiFetch, parseApiError } from '../../lib/api';
import { getAccessToken } from '../../lib/auth';
import { UIButton, UICard, UIEmptyState, UIInput, UISelect, UITextarea, UITable, useToast } from '../../components/ui-kit';

type Balance = {
    seller_id: string;
    available_amount: string;
    pending_amount: string;
};

type LedgerRow = {
    id: number;
    type: 'CREDIT' | 'DEBIT' | 'ADJUSTMENT';
    amount: string;
    note?: string;
    order_id?: string;
    created_at: string;
};

type Listing = {
    id: string;
    title: string;
    status: string;
    price?: string;
    city?: string;
};

type AdProduct = {
    code: string;
    price_amount: string;
    currency: string;
    duration_days: number;
};

export default function SellerPage() {
    const { push } = useToast();

    const [balance, setBalance] = useState<Balance | null>(null);
    const [ledger, setLedger] = useState<LedgerRow[]>([]);
    const [listings, setListings] = useState<Listing[]>([]);
    const [adProducts, setAdProducts] = useState<AdProduct[]>([]);

    const [payoutAmount, setPayoutAmount] = useState('');
    const [promoteListingId, setPromoteListingId] = useState('');
    const [promoteProduct, setPromoteProduct] = useState('FEATURED_HOME');

    const [auctionListingId, setAuctionListingId] = useState('');
    const [auctionStartingPrice, setAuctionStartingPrice] = useState('');
    const [auctionIncrement, setAuctionIncrement] = useState('100');
    const [auctionReserve, setAuctionReserve] = useState('');
    const [auctionBuyNow, setAuctionBuyNow] = useState('');
    const [auctionHours, setAuctionHours] = useState('24');

    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);

    const token = useMemo(() => {
        if (typeof window === 'undefined') return null;
        return getAccessToken() || localStorage.getItem('aljwharah_token');
    }, []);

    const load = async () => {
        if (!token) {
            setLoading(false);
            return;
        }

        try {
            const [balanceRes, ledgerRes, listingsRes, productsRes] = await Promise.all([
                apiFetch<Balance>('/seller/balance', {}, token),
                apiFetch<{ items: LedgerRow[] }>('/seller/ledger?page=1&pageSize=30', {}, token),
                apiFetch<{ data: Listing[] }>('/listings/my', {}, token),
                apiFetch<{ items: AdProduct[] }>('/ads/products'),
            ]);

            setBalance(balanceRes);
            setLedger(ledgerRes.items || []);
            setListings((listingsRes.data || []).filter((l) => l.status === 'APPROVED'));
            setAdProducts(productsRes.items || []);

            if (!promoteListingId && listingsRes.data?.[0]?.id) setPromoteListingId(listingsRes.data[0].id);
            if (!auctionListingId && listingsRes.data?.[0]?.id) setAuctionListingId(listingsRes.data[0].id);
        } catch (err) {
            push(parseApiError(err));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    if (!token) {
        return (
            <main className="page-shell">
                <UIEmptyState title="تسجيل الدخول مطلوب" description="يرجى تسجيل الدخول كبائع للوصول إلى لوحة التشغيل." />
            </main>
        );
    }

    return (
        <main className="page-shell">
            <section className="page-section">
                <h1 className="page-title">لوحة البائع</h1>
                <p className="page-subtitle">رصيدك، حملاتك الإعلانية، ومزاداتك في واجهة تشغيل واحدة.</p>
            </section>

            {loading ? <UICard>جارٍ التحميل...</UICard> : null}

            {balance ? (
                <section className="page-grid-2 page-section">
                    <UICard>
                        <h3>الرصيد المتاح</h3>
                        <p style={{ fontFamily: 'var(--font-latin)', fontWeight: 800, fontSize: '1.3rem' }}>{Number(balance.available_amount || 0).toLocaleString('en-US')} SAR</p>
                    </UICard>
                    <UICard>
                        <h3>الرصيد المعلق</h3>
                        <p style={{ fontFamily: 'var(--font-latin)', fontWeight: 800, fontSize: '1.3rem' }}>{Number(balance.pending_amount || 0).toLocaleString('en-US')} SAR</p>
                    </UICard>
                </section>
            ) : null}

            <section className="page-grid-2 page-section">
                <UICard>
                    <h2 style={{ marginBottom: 10 }}>طلب سحب</h2>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <UIInput type="number" min="1" value={payoutAmount} onChange={(e) => setPayoutAmount(e.target.value)} placeholder="المبلغ" />
                        <UIButton
                            type="button"
                            disabled={busy}
                            onClick={async () => {
                                const amount = Number(payoutAmount);
                                if (!Number.isFinite(amount) || amount <= 0) {
                                    push('أدخل مبلغ سحب صحيح');
                                    return;
                                }
                                setBusy(true);
                                try {
                                    await apiFetch('/seller/payout-request', {
                                        method: 'POST',
                                        body: JSON.stringify({ amount }),
                                    }, token);
                                    setPayoutAmount('');
                                    push('تم إرسال طلب السحب');
                                    await load();
                                } catch (err) {
                                    push(parseApiError(err));
                                } finally {
                                    setBusy(false);
                                }
                            }}
                        >
                            طلب سحب
                        </UIButton>
                    </div>
                </UICard>

                <UICard>
                    <h2 style={{ marginBottom: 10 }}>ترويج إعلان مدفوع</h2>
                    <div style={{ display: 'grid', gap: 8 }}>
                        <UISelect value={promoteListingId} onChange={(e) => setPromoteListingId(e.target.value)}>
                            {listings.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
                        </UISelect>
                        <UISelect value={promoteProduct} onChange={(e) => setPromoteProduct(e.target.value)}>
                            {adProducts.map((p) => (
                                <option key={p.code} value={p.code}>{p.code} — {Number(p.price_amount || 0).toLocaleString('en-US')} {p.currency}</option>
                            ))}
                        </UISelect>
                        <UIButton
                            type="button"
                            onClick={async () => {
                                if (!promoteListingId) {
                                    push('اختر إعلاناً أولاً');
                                    return;
                                }
                                setBusy(true);
                                try {
                                    const created = await apiFetch<{ id: string }>('/ads/campaigns', {
                                        method: 'POST',
                                        body: JSON.stringify({ listingId: promoteListingId, productCode: promoteProduct }),
                                    }, token);
                                    const paid = await apiFetch<{ transactionUrl?: string }>(`/ads/campaigns/${created.id}/pay`, { method: 'POST' }, token);
                                    if (paid.transactionUrl) {
                                        window.location.href = paid.transactionUrl;
                                        return;
                                    }
                                    push('تم إنشاء الحملة');
                                } catch (err) {
                                    push(parseApiError(err));
                                } finally {
                                    setBusy(false);
                                }
                            }}
                        >
                            إنشاء ودفع الحملة
                        </UIButton>
                    </div>
                </UICard>
            </section>

            <section className="page-grid-2 page-section">
                <UICard>
                    <h2 style={{ marginBottom: 10 }}>إنشاء مزاد جديد</h2>
                    <div style={{ display: 'grid', gap: 8 }}>
                        <UISelect value={auctionListingId} onChange={(e) => setAuctionListingId(e.target.value)}>
                            {listings.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
                        </UISelect>
                        <div className="page-grid-2">
                            <UIInput type="number" value={auctionStartingPrice} onChange={(e) => setAuctionStartingPrice(e.target.value)} placeholder="سعر البداية" />
                            <UIInput type="number" value={auctionIncrement} onChange={(e) => setAuctionIncrement(e.target.value)} placeholder="الحد الأدنى للزيادة" />
                        </div>
                        <div className="page-grid-2">
                            <UIInput type="number" value={auctionReserve} onChange={(e) => setAuctionReserve(e.target.value)} placeholder="سعر احتياطي (اختياري)" />
                            <UIInput type="number" value={auctionBuyNow} onChange={(e) => setAuctionBuyNow(e.target.value)} placeholder="شراء فوري (اختياري)" />
                        </div>
                        <UIInput type="number" value={auctionHours} onChange={(e) => setAuctionHours(e.target.value)} placeholder="مدة المزاد بالساعات" />
                        <UIButton
                            type="button"
                            onClick={async () => {
                                const start = new Date();
                                const end = new Date(start.getTime() + Number(auctionHours || 24) * 60 * 60 * 1000);
                                try {
                                    const created = await apiFetch<{ id: string }>('/auctions', {
                                        method: 'POST',
                                        body: JSON.stringify({
                                            listingId: auctionListingId,
                                            startsAt: start.toISOString(),
                                            endsAt: end.toISOString(),
                                            startingPrice: Number(auctionStartingPrice),
                                            bidIncrement: Number(auctionIncrement),
                                            reservePrice: auctionReserve ? Number(auctionReserve) : undefined,
                                            buyNowPrice: auctionBuyNow ? Number(auctionBuyNow) : undefined,
                                        }),
                                    }, token);
                                    await apiFetch(`/auctions/${created.id}/publish`, { method: 'PATCH' }, token);
                                    push('تم إنشاء ونشر المزاد');
                                } catch (err) {
                                    push(parseApiError(err));
                                }
                            }}
                        >
                            إنشاء ونشر المزاد
                        </UIButton>
                    </div>
                </UICard>

                <UICard>
                    <h2 style={{ marginBottom: 10 }}>السجل المالي</h2>
                    {ledger.length === 0 ? (
                        <p style={{ color: 'var(--color-text-muted)' }}>لا توجد حركات بعد</p>
                    ) : (
                        <UITable>
                            <thead>
                                <tr>
                                    <th>النوع</th>
                                    <th>القيمة</th>
                                    <th>الملاحظة</th>
                                    <th>التاريخ</th>
                                </tr>
                            </thead>
                            <tbody>
                                {ledger.map((row) => (
                                    <tr key={row.id}>
                                        <td>{row.type}</td>
                                        <td>{Number(row.amount || 0).toLocaleString('en-US')} SAR</td>
                                        <td>{row.note || '—'}</td>
                                        <td>{new Date(row.created_at).toLocaleString('ar-SA')}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </UITable>
                    )}
                </UICard>
            </section>
        </main>
    );
}
