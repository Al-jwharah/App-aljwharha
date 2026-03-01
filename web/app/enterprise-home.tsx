'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { apiFetch, parseApiError } from '../lib/api';
import { UIDrawer, UIBadge, UIButton, UICard, UIEmptyState, UISkeleton, useToast } from '../components/ui-kit';

type Locale = 'ar' | 'en';

type Listing = {
    id: string;
    title: string;
    type: string;
    city?: string;
    price?: string;
    currency?: string;
    category_name_ar?: string;
    category_name_en?: string;
};

type Auction = {
    id: string;
    title: string;
    city?: string;
    status: string;
    current_price?: string;
    starting_price?: string;
    bid_increment?: string;
    ends_at: string;
    bid_count?: number;
};

type AdPlacement = {
    id: string;
    product_code: string;
    listing_id: string;
    title: string;
    city?: string;
    price?: string;
    currency?: string;
};

type CartItem = {
    id: string;
    title: string;
    price: number;
    qty: number;
};

const CART_KEY = 'aljwharah_cart_v2';
const LOCALE_KEY = 'aljwharah_locale_v2';

const copy = {
    ar: {
        heroTitle: 'منصة مؤسسية للتداول الصناعي في السعودية',
        heroSub: 'بيع وشراء الأصول عبر إعلانات موثقة ومزادات حية ومدفوعات آمنة.',
        explore: 'استكشف السوق',
        start: 'ابدأ البيع',
        auctions: 'المزادات المباشرة',
        listings: 'إعلانات مختارة',
        ads: 'إعلانات مدفوعة نشطة',
        categories: 'الفئات الرئيسية',
        ai: 'محرك التقييم بالذكاء الاصطناعي',
        aiSub: 'حلّل وصف الأصل واستلم اقتراحات سعرية مبنية على بيانات داخلية.',
        trust: 'طبقة الثقة المؤسسية',
        trust1: 'توثيق الهوية والملكية قبل النشر',
        trust2: 'Tap للدفع والتحقق من حالات التحصيل',
        trust3: 'تدقيق كامل لكل إجراء حساس',
        noAuctions: 'لا توجد مزادات مباشرة الآن.',
        noListings: 'لا توجد إعلانات متاحة الآن.',
        noAds: 'لا توجد حملات إعلانية نشطة حالياً.',
        endsIn: 'ينتهي خلال',
        bid: 'زايد الآن',
        addCart: 'أضف للسلة',
        removeCart: 'إزالة',
        cart: 'السلة',
        cartEmpty: 'السلة فارغة.',
        cartTotal: 'الإجمالي',
        lang: 'EN',
    },
    en: {
        heroTitle: 'Enterprise marketplace for industrial assets in Saudi Arabia',
        heroSub: 'Buy and sell through verified listings, live auctions, and secure payments.',
        explore: 'Explore Market',
        start: 'Start Selling',
        auctions: 'Live Auctions',
        listings: 'Featured Listings',
        ads: 'Active Sponsored Placements',
        categories: 'Main Categories',
        ai: 'AI Valuation Engine',
        aiSub: 'Analyze listing quality and get pricing guidance from internal comparables.',
        trust: 'Enterprise Trust Layer',
        trust1: 'Identity and ownership verification before publishing',
        trust2: 'Tap payment integration with reconciliation safety',
        trust3: 'Complete auditing for sensitive operations',
        noAuctions: 'No live auctions right now.',
        noListings: 'No listings available right now.',
        noAds: 'No active ad campaigns right now.',
        endsIn: 'Ends in',
        bid: 'Place Bid',
        addCart: 'Add to cart',
        removeCart: 'Remove',
        cart: 'Cart',
        cartEmpty: 'Your cart is empty.',
        cartTotal: 'Total',
        lang: 'AR',
    },
} as const;

function formatRemaining(endsAt: string, locale: Locale) {
    const diff = Math.max(0, new Date(endsAt).getTime() - Date.now());
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const n = locale === 'ar' ? 'ar-SA' : 'en-US';
    return `${h.toLocaleString(n)}h ${m.toLocaleString(n)}m`;
}

export default function EnterpriseHome() {
    const { push } = useToast();

    const [locale, setLocale] = useState<Locale>('ar');
    const [listings, setListings] = useState<Listing[]>([]);
    const [auctions, setAuctions] = useState<Auction[]>([]);
    const [ads, setAds] = useState<AdPlacement[]>([]);
    const [loading, setLoading] = useState(true);

    const [cartOpen, setCartOpen] = useState(false);
    const [cart, setCart] = useState<CartItem[]>([]);

    const t = copy[locale];

    useEffect(() => {
        const savedLocale = localStorage.getItem(LOCALE_KEY);
        if (savedLocale === 'ar' || savedLocale === 'en') {
            setLocale(savedLocale);
        }

        const storedCart = localStorage.getItem(CART_KEY);
        if (storedCart) {
            try {
                const parsed = JSON.parse(storedCart) as CartItem[];
                if (Array.isArray(parsed)) setCart(parsed);
            } catch {
                // ignore broken storage
            }
        }
    }, []);

    useEffect(() => {
        document.documentElement.lang = locale;
        document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
        localStorage.setItem(LOCALE_KEY, locale);
    }, [locale]);

    useEffect(() => {
        localStorage.setItem(CART_KEY, JSON.stringify(cart));
    }, [cart]);

    useEffect(() => {
        let active = true;
        setLoading(true);

        Promise.all([
            apiFetch<{ data: Listing[] }>('/listings?status=APPROVED&page=1&limit=6'),
            apiFetch<{ items: Auction[] }>('/auctions?status=LIVE&page=1&pageSize=6'),
            apiFetch<{ items: AdPlacement[] }>('/ads/placements?page=home&limit=6'),
        ])
            .then(([listingsRes, auctionsRes, adsRes]) => {
                if (!active) return;
                setListings(listingsRes.data || []);
                setAuctions((auctionsRes.items || []).map((a) => ({
                    ...a,
                    title: (a as any).title || (a as any).title_ar || (a as any).title_en || a.id,
                })));
                setAds(adsRes.items || []);
            })
            .catch((err) => {
                if (!active) return;
                push(parseApiError(err));
            })
            .finally(() => {
                if (active) setLoading(false);
            });

        const refresh = setInterval(() => {
            Promise.all([
                apiFetch<{ items: Auction[] }>('/auctions?status=LIVE&page=1&pageSize=6'),
                apiFetch<{ items: AdPlacement[] }>('/ads/placements?page=home&limit=6'),
            ])
                .then(([auctionsRes, adsRes]) => {
                    if (!active) return;
                    setAuctions((auctionsRes.items || []).map((a) => ({ ...a, title: (a as any).title || a.id })));
                    setAds(adsRes.items || []);
                })
                .catch(() => {
                    // avoid toast loop during polling
                });
        }, 10000);

        return () => {
            active = false;
            clearInterval(refresh);
        };
    }, [push]);

    const metrics = useMemo(() => {
        const listingsCount = listings.length;
        const auctionsCount = auctions.length;
        const adsCount = ads.length;
        const avgPrice = listingsCount > 0
            ? Math.round(listings.reduce((sum, l) => sum + Number(l.price || 0), 0) / listingsCount)
            : 0;

        return [
            { label: locale === 'ar' ? 'إعلانات نشطة' : 'Active listings', value: listingsCount },
            { label: locale === 'ar' ? 'مزادات مباشرة' : 'Live auctions', value: auctionsCount },
            { label: locale === 'ar' ? 'حملات إعلانية' : 'Ad campaigns', value: adsCount },
            { label: locale === 'ar' ? 'متوسط السعر' : 'Avg price', value: avgPrice, suffix: ' SAR' },
        ];
    }, [ads.length, auctions.length, listings, locale]);

    const cartCount = cart.reduce((s, i) => s + i.qty, 0);
    const cartTotal = cart.reduce((s, i) => s + i.qty * i.price, 0);

    return (
        <main className="page-shell">
            <section className="page-section" id="home" style={{ position: 'relative', overflow: 'hidden' }}>
                <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.32 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, alignItems: 'center', gap: 8 }}>
                        <h1 className="page-title" style={{ marginBottom: 0 }}>{t.heroTitle}</h1>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <UIButton type="button" variant="secondary" onClick={() => setLocale(locale === 'ar' ? 'en' : 'ar')}>{t.lang}</UIButton>
                            <UIButton type="button" variant="secondary" data-testid="cart-toggle" onClick={() => setCartOpen(true)}>
                                {t.cart} ({cartCount})
                            </UIButton>
                        </div>
                    </div>
                    <p className="page-subtitle">{t.heroSub}</p>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                        <Link href="/listings"><UIButton type="button">{t.explore}</UIButton></Link>
                        <Link href="/seller"><UIButton type="button" variant="secondary">{t.start}</UIButton></Link>
                    </div>
                </motion.div>
                <div className="page-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
                    {metrics.map((m) => (
                        <UICard key={m.label}>
                            <p style={{ color: 'var(--color-text-muted)', marginBottom: 6 }}>{m.label}</p>
                            <strong style={{ fontSize: '1.15rem', fontFamily: 'var(--font-latin)' }}>{m.value.toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US')}{m.suffix || ''}</strong>
                        </UICard>
                    ))}
                </div>
            </section>

            <section className="page-section" id="auctions">
                <h2 style={{ marginBottom: 8 }}>{t.auctions}</h2>
                {loading ? (
                    <div className="page-grid-3">
                        {Array.from({ length: 3 }).map((_, idx) => <UICard key={idx}><UISkeleton height={20} width="50%" /></UICard>)}
                    </div>
                ) : auctions.length === 0 ? (
                    <UIEmptyState title={t.noAuctions} description="" />
                ) : (
                    <div className="page-grid-3">
                        {auctions.map((auction) => (
                            <UICard key={auction.id}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                    <UIBadge tone={auction.status === 'LIVE' ? 'success' : 'info'}>{auction.status}</UIBadge>
                                    <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{auction.bid_count || 0}</span>
                                </div>
                                <h3 style={{ marginBottom: 8 }}>{auction.title}</h3>
                                <p style={{ color: 'var(--color-text-muted)', marginBottom: 8 }}>{auction.city || '—'}</p>
                                <p style={{ marginBottom: 8, fontFamily: 'var(--font-latin)', fontWeight: 700 }}>
                                    {Number(auction.current_price || auction.starting_price || 0).toLocaleString('en-US')} SAR
                                </p>
                                <p style={{ marginBottom: 10, color: 'var(--color-text-muted)' }}>{t.endsIn}: {formatRemaining(auction.ends_at, locale)}</p>
                                <Link href={`/auctions/${auction.id}`}><UIButton type="button" style={{ width: '100%' }}>{t.bid}</UIButton></Link>
                            </UICard>
                        ))}
                    </div>
                )}
            </section>

            <section className="page-section" id="listings">
                <h2 style={{ marginBottom: 8 }}>{t.listings}</h2>
                {loading ? (
                    <div className="page-grid-3">
                        {Array.from({ length: 3 }).map((_, idx) => <UICard key={idx}><UISkeleton height={20} width="50%" /></UICard>)}
                    </div>
                ) : listings.length === 0 ? (
                    <UIEmptyState title={t.noListings} description="" />
                ) : (
                    <div className="page-grid-3">
                        {listings.map((listing) => {
                            const qty = cart.find((x) => x.id === listing.id)?.qty || 0;
                            const title = listing.title;
                            const price = Number(listing.price || 0);

                            return (
                                <UICard key={listing.id}>
                                    <h3 style={{ marginBottom: 8 }}>{title}</h3>
                                    <p style={{ color: 'var(--color-text-muted)', marginBottom: 8 }}>
                                        {(locale === 'ar' ? listing.category_name_ar : listing.category_name_en) || listing.type}
                                        {listing.city ? ` · ${listing.city}` : ''}
                                    </p>
                                    <p style={{ fontFamily: 'var(--font-latin)', fontWeight: 700, marginBottom: 10 }}>
                                        {price.toLocaleString('en-US')} {listing.currency || 'SAR'}
                                    </p>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <UIButton
                                            type="button"
                                            onClick={() => {
                                                setCart((prev) => {
                                                    const existing = prev.find((x) => x.id === listing.id);
                                                    if (existing) {
                                                        return prev.map((x) => x.id === listing.id ? { ...x, qty: x.qty + 1 } : x);
                                                    }
                                                    return [...prev, { id: listing.id, title, price, qty: 1 }];
                                                });
                                            }}
                                            style={{ flex: 1 }}
                                        >
                                            {t.addCart}
                                        </UIButton>
                                        <UIButton
                                            type="button"
                                            variant="secondary"
                                            disabled={qty === 0}
                                            onClick={() => {
                                                setCart((prev) => prev
                                                    .map((x) => x.id === listing.id ? { ...x, qty: Math.max(0, x.qty - 1) } : x)
                                                    .filter((x) => x.qty > 0));
                                            }}
                                            style={{ flex: 1 }}
                                        >
                                            {t.removeCart}
                                        </UIButton>
                                    </div>
                                </UICard>
                            );
                        })}
                    </div>
                )}
            </section>

            <section className="page-section" id="ads">
                <h2 style={{ marginBottom: 8 }}>{t.ads}</h2>
                {ads.length === 0 ? (
                    <UIEmptyState title={t.noAds} description="" />
                ) : (
                    <div className="page-grid-3">
                        {ads.map((ad) => (
                            <UICard key={ad.id}>
                                <UIBadge tone="warning">إعلان</UIBadge>
                                <h3 style={{ marginTop: 8, marginBottom: 8 }}>{ad.title}</h3>
                                <p style={{ color: 'var(--color-text-muted)' }}>{ad.city || '—'}</p>
                                <p style={{ fontFamily: 'var(--font-latin)', fontWeight: 700, marginTop: 8 }}>
                                    {Number(ad.price || 0).toLocaleString('en-US')} {ad.currency || 'SAR'}
                                </p>
                                <Link href={`/listings/${ad.listing_id}`}><UIButton type="button" variant="secondary" style={{ width: '100%', marginTop: 10 }}>عرض الإعلان</UIButton></Link>
                            </UICard>
                        ))}
                    </div>
                )}
            </section>

            <section className="page-grid-2 page-section" id="categories">
                <UICard>
                    <h2 style={{ marginBottom: 8 }}>{t.categories}</h2>
                    <div className="page-grid-3" style={{ gap: 8 }}>
                        {['Trademarks', 'Factories', 'Equipment', 'Raw Materials', 'Warehouses', 'Franchises'].map((c) => (
                            <div key={c} style={{ border: '1px solid var(--color-border)', borderRadius: 10, padding: 10, textAlign: 'center' }}>
                                {locale === 'ar'
                                    ? ({ Trademarks: 'علامات تجارية', Factories: 'مصانع', Equipment: 'معدات', 'Raw Materials': 'مواد خام', Warehouses: 'مستودعات', Franchises: 'امتيازات' } as any)[c]
                                    : c}
                            </div>
                        ))}
                    </div>
                </UICard>
                <UICard id="ai">
                    <h2 style={{ marginBottom: 8 }}>{t.ai}</h2>
                    <p style={{ color: 'var(--color-text-muted)', marginBottom: 10 }}>{t.aiSub}</p>
                    <Link href="/ai"><UIButton type="button">تشغيل المساعد الذكي</UIButton></Link>
                </UICard>
            </section>

            <section className="page-section" id="faq">
                <h2 style={{ marginBottom: 8 }}>{t.trust}</h2>
                <div className="page-grid-3">
                    <UICard><p>{t.trust1}</p></UICard>
                    <UICard><p>{t.trust2}</p></UICard>
                    <UICard><p>{t.trust3}</p></UICard>
                </div>
            </section>

            <UIDrawer open={cartOpen} onClose={() => setCartOpen(false)} title={t.cart}>
                {cart.length === 0 ? (
                    <p>{t.cartEmpty}</p>
                ) : (
                    <div style={{ display: 'grid', gap: 8 }}>
                        {cart.map((item) => (
                            <div key={item.id} style={{ border: '1px solid var(--color-border)', borderRadius: 10, padding: 10 }}>
                                <strong>{item.title}</strong>
                                <p style={{ color: 'var(--color-text-muted)' }}>{item.qty} × {item.price.toLocaleString('en-US')} SAR</p>
                            </div>
                        ))}
                        <p style={{ fontWeight: 700 }}>{t.cartTotal}: {cartTotal.toLocaleString('en-US')} SAR</p>
                        <Link href="/cart"><UIButton type="button" style={{ width: '100%' }}>الانتقال إلى السلة</UIButton></Link>
                    </div>
                )}
            </UIDrawer>
        </main>
    );
}

