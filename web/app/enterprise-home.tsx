'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { apiFetch, parseApiError } from '../lib/api';
import { UIDrawer, UIBadge, UIButton, UICard, UIEmptyState, UISkeleton, UIInput, useToast } from '../components/ui-kit';

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
    seller_verified?: boolean;
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

type AiSuggestion = {
    listingId: string;
    title: string;
    reason: string;
    price?: number;
    currency?: string;
};

const CART_KEY = 'aljwharah_cart_v2';
const LOCALE_KEY = 'aljwharah_locale_v2';

const copy = {
    ar: {
        heroTitle: 'منصة مؤسسية ذكية لتداول الأصول الصناعية',
        heroSub: 'تجربة حديثة تجمع المزادات الفورية، الإعلانات المدفوعة، الرؤى الذكية، والمدفوعات الآمنة.',
        explore: 'استكشف السوق',
        start: 'ابدأ البيع',
        auctions: 'المزادات المباشرة',
        listings: 'إعلانات مختارة',
        ads: 'الإعلانات المدفوعة النشطة',
        categories: 'الفئات الرئيسية',
        ai: 'AI Valuation Engine',
        aiSub: 'تحسين جودة العرض وتقدير السعر بناءً على بيانات داخلية حقيقية.',
        trust: 'طبقة الثقة المؤسسية',
        trust1: 'تحقق هوية البائع ووثائق الملكية',
        trust2: 'Tap للدفع الآمن والتسوية',
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
        liveFeed: 'نشاط المزادات اللحظي',
        smartSearch: 'ابحث باللغة الطبيعية: مصنع أغذية بالرياض أقل من 3 مليون',
        verified: 'بائع موثّق',
        secure: 'معاملة آمنة',
        confidence: 'مؤشر الثقة للمشتري',
        recommendations: 'قد يعجبك',
        lang: 'EN',
    },
    en: {
        heroTitle: 'Smart enterprise marketplace for industrial assets',
        heroSub: 'A premium experience combining live auctions, paid placements, AI insights, and secure payment rails.',
        explore: 'Explore Market',
        start: 'Start Selling',
        auctions: 'Live Auctions',
        listings: 'Featured Listings',
        ads: 'Active Sponsored Placements',
        categories: 'Main Categories',
        ai: 'AI Valuation Engine',
        aiSub: 'Improve listing quality and estimate value from internal real data.',
        trust: 'Enterprise Trust Layer',
        trust1: 'Seller identity and ownership verification',
        trust2: 'Tap secure payment and settlement controls',
        trust3: 'Full auditing on sensitive actions',
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
        liveFeed: 'Live Auction Activity',
        smartSearch: 'Natural language search: Riyadh factory under 3M',
        verified: 'Verified Seller',
        secure: 'Secure Transaction',
        confidence: 'Buyer Confidence Meter',
        recommendations: 'You may like',
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

function scoreListing(listing: Listing, avgPrice: number) {
    const price = Number(listing.price || 0);
    const trust = Math.min(96, 55 + (listing.seller_verified ? 28 : 0) + (listing.city ? 8 : 0));
    const popularity = Math.min(97, 50 + (price > 0 && avgPrice > 0 ? Math.max(0, 30 - Math.abs(price - avgPrice) / avgPrice * 30) : 10));
    const rarity = Math.min(95, 45 + (listing.type === 'TRADEMARK' ? 34 : listing.type === 'FACTORY' ? 26 : 18));
    return {
        trust: Math.round(trust),
        popularity: Math.round(popularity),
        rarity: Math.round(rarity),
    };
}

export default function EnterpriseHome() {
    const router = useRouter();
    const { push } = useToast();

    const [locale, setLocale] = useState<Locale>('ar');
    const [listings, setListings] = useState<Listing[]>([]);
    const [auctions, setAuctions] = useState<Auction[]>([]);
    const [ads, setAds] = useState<AdPlacement[]>([]);
    const [loading, setLoading] = useState(true);

    const [searchQuery, setSearchQuery] = useState('');
    const [searchSuggestions, setSearchSuggestions] = useState<AiSuggestion[]>([]);

    const [auctionFeed, setAuctionFeed] = useState<Array<{ text: string; at: string }>>([]);
    const [pulseAuctionId, setPulseAuctionId] = useState<string | null>(null);

    const [cartOpen, setCartOpen] = useState(false);
    const [cart, setCart] = useState<CartItem[]>([]);

    const t = copy[locale];
    const prevAuctionPriceRef = useRef<Map<string, number>>(new Map());

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

                    const incoming = (auctionsRes.items || []).map((a) => ({ ...a, title: (a as any).title || a.id }));
                    for (const auction of incoming) {
                        const current = Number(auction.current_price || auction.starting_price || 0);
                        const prev = prevAuctionPriceRef.current.get(auction.id);
                        if (prev !== undefined && prev !== current) {
                            setPulseAuctionId(auction.id);
                            setAuctionFeed((old) => [{
                                text: locale === 'ar'
                                    ? `تحديث مزايدة على ${auction.title}: ${current.toLocaleString('en-US')} SAR`
                                    : `New bid on ${auction.title}: ${current.toLocaleString('en-US')} SAR`,
                                at: new Date().toISOString(),
                            }, ...old].slice(0, 8));
                            setTimeout(() => setPulseAuctionId((id) => (id === auction.id ? null : id)), 1400);
                        }
                        prevAuctionPriceRef.current.set(auction.id, current);
                    }

                    setAuctions(incoming);
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
    }, [locale, push]);

    useEffect(() => {
        if (!searchQuery.trim() || searchQuery.trim().length < 2) {
            setSearchSuggestions([]);
            return;
        }

        const timer = setTimeout(() => {
            apiFetch<{ suggestions?: AiSuggestion[] }>(`/ai/search`, {
                method: 'POST',
                body: JSON.stringify({ query: searchQuery.trim(), locale }),
            })
                .then((result) => {
                    setSearchSuggestions(result.suggestions || []);
                })
                .catch(() => {
                    setSearchSuggestions([]);
                });
        }, 360);

        return () => clearTimeout(timer);
    }, [searchQuery, locale]);

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

    const [metricDisplay, setMetricDisplay] = useState<number[]>([0, 0, 0, 0]);
    useEffect(() => {
        const nextTargets = metrics.map((m) => m.value);
        const start = Date.now();
        const duration = 720;

        const tick = () => {
            const elapsed = Date.now() - start;
            const p = Math.min(1, elapsed / duration);
            setMetricDisplay(nextTargets.map((target) => Math.round(target * p)));
            if (p < 1) requestAnimationFrame(tick);
        };

        requestAnimationFrame(tick);
    }, [metrics]);

    const cartCount = cart.reduce((s, i) => s + i.qty, 0);
    const cartTotal = cart.reduce((s, i) => s + i.qty * i.price, 0);
    const avgListingPrice = listings.length > 0
        ? listings.reduce((sum, l) => sum + Number(l.price || 0), 0) / listings.length
        : 0;

    const recommendationPills = useMemo(() => {
        const raw = listings
            .slice(0, 6)
            .map((item) => (locale === 'ar' ? item.category_name_ar || item.type : item.category_name_en || item.type));
        return [...new Set(raw)].slice(0, 5);
    }, [listings, locale]);

    return (
        <main className="page-shell">
            <motion.section
                className="page-section"
                id="home"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.32 }}
            >
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

                <div className="smart-search">
                    <UIInput
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={t.smartSearch}
                    />
                    <AnimatePresence>
                        {searchSuggestions.length > 0 ? (
                            <motion.div
                                className="search-dropdown"
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 6 }}
                            >
                                {searchSuggestions.slice(0, 6).map((item) => (
                                    <button
                                        type="button"
                                        className="search-row"
                                        key={item.listingId}
                                        onClick={() => router.push(`/listings/${item.listingId}`)}
                                        style={{ width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', color: 'inherit' }}
                                    >
                                        <span style={{ textAlign: 'start' }}>
                                            <strong>{item.title}</strong>
                                            <div style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>{item.reason}</div>
                                        </span>
                                        <span style={{ fontFamily: 'var(--font-latin)', fontWeight: 700 }}>
                                            {(item.price || 0).toLocaleString('en-US')} {item.currency || 'SAR'}
                                        </span>
                                    </button>
                                ))}
                            </motion.div>
                        ) : null}
                    </AnimatePresence>
                </div>

                <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                    <Link href="/listings"><UIButton type="button">{t.explore}</UIButton></Link>
                    <Link href="/seller"><UIButton type="button" variant="secondary">{t.start}</UIButton></Link>
                </div>

                <div className="page-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
                    {metrics.map((m, index) => (
                        <UICard key={m.label} className="interactive-card">
                            <p style={{ color: 'var(--color-text-muted)', marginBottom: 6 }}>{m.label}</p>
                            <strong className="kpi-number">{(metricDisplay[index] || 0).toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US')}{m.suffix || ''}</strong>
                        </UICard>
                    ))}
                </div>
            </motion.section>

            <motion.section className="page-section" id="auctions" initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
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
                            <UICard key={auction.id} className="interactive-card">
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                    <UIBadge tone={auction.status === 'LIVE' ? 'success' : 'info'}>{auction.status}</UIBadge>
                                    <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{auction.bid_count || 0}</span>
                                </div>
                                <h3 style={{ marginBottom: 8 }}>{auction.title}</h3>
                                <p style={{ color: 'var(--color-text-muted)', marginBottom: 8 }}>{auction.city || '—'}</p>
                                <p className={pulseAuctionId === auction.id ? 'badge-pulse' : ''} style={{ marginBottom: 8, fontFamily: 'var(--font-latin)', fontWeight: 700 }}>
                                    {Number(auction.current_price || auction.starting_price || 0).toLocaleString('en-US')} SAR
                                </p>
                                <p style={{ marginBottom: 10, color: 'var(--color-text-muted)' }}>{t.endsIn}: {formatRemaining(auction.ends_at, locale)}</p>
                                <Link href={`/auctions/${auction.id}`}><UIButton type="button" style={{ width: '100%' }}>{t.bid}</UIButton></Link>
                            </UICard>
                        ))}
                    </div>
                )}
            </motion.section>

            <motion.section className="page-section" id="listings" initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
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
                            const score = scoreListing(listing, avgListingPrice);
                            const confidence = Math.round((score.trust + score.popularity + score.rarity) / 3);
                            const delta = avgListingPrice > 0 ? ((price - avgListingPrice) / avgListingPrice) * 100 : 0;

                            return (
                                <UICard key={listing.id} className="interactive-card">
                                    <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                                        {listing.seller_verified ? <UIBadge tone="success">{t.verified}</UIBadge> : null}
                                        <UIBadge tone="info">{t.secure}</UIBadge>
                                    </div>
                                    <h3 style={{ marginBottom: 8 }}>{title}</h3>
                                    <p style={{ color: 'var(--color-text-muted)', marginBottom: 8 }}>
                                        {(locale === 'ar' ? listing.category_name_ar : listing.category_name_en) || listing.type}
                                        {listing.city ? ` · ${listing.city}` : ''}
                                    </p>
                                    <p style={{ fontFamily: 'var(--font-latin)', fontWeight: 700, marginBottom: 6 }}>
                                        {price.toLocaleString('en-US')} {listing.currency || 'SAR'}
                                    </p>
                                    <p style={{ color: 'var(--color-text-muted)', fontSize: 12, marginBottom: 8 }}>
                                        Δ السوق: {delta >= 0 ? '+' : ''}{delta.toFixed(1)}%
                                    </p>

                                    <div className="ai-score-grid">
                                        <div className="ai-score-item">
                                            Trust {score.trust}
                                            <div className="progress-track"><div className="progress-fill" style={{ width: `${score.trust}%` }} /></div>
                                        </div>
                                        <div className="ai-score-item">
                                            Popularity {score.popularity}
                                            <div className="progress-track"><div className="progress-fill" style={{ width: `${score.popularity}%` }} /></div>
                                        </div>
                                        <div className="ai-score-item">
                                            Rarity {score.rarity}
                                            <div className="progress-track"><div className="progress-fill" style={{ width: `${score.rarity}%` }} /></div>
                                        </div>
                                    </div>

                                    <p style={{ marginTop: 8, marginBottom: 8, fontSize: 12, color: 'var(--color-text-muted)' }}>{t.confidence}: {confidence}%</p>
                                    <div className="progress-track" style={{ marginBottom: 12 }}><div className="progress-fill" style={{ width: `${confidence}%` }} /></div>

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

                <div className="recommend-strip">
                    <strong style={{ marginInlineEnd: 6 }}>{t.recommendations}:</strong>
                    {recommendationPills.map((pill) => <span key={pill} className="recommend-pill">{pill}</span>)}
                </div>
            </motion.section>

            <motion.section className="page-section" id="ads" initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
                <h2 style={{ marginBottom: 8 }}>{t.ads}</h2>
                {ads.length === 0 ? (
                    <UIEmptyState title={t.noAds} description="" />
                ) : (
                    <div className="page-grid-3">
                        {ads.map((ad) => (
                            <UICard key={ad.id} className="interactive-card">
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
            </motion.section>

            <section className="page-grid-2 page-section" id="categories">
                <UICard className="interactive-card">
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
                <UICard id="ai" className="interactive-card">
                    <h2 style={{ marginBottom: 8 }}>{t.ai}</h2>
                    <p style={{ color: 'var(--color-text-muted)', marginBottom: 10 }}>{t.aiSub}</p>
                    <Link href="/ai"><UIButton type="button">تشغيل المساعد الذكي</UIButton></Link>
                </UICard>
            </section>

            <section className="page-grid-2 page-section" id="live-feed">
                <UICard className="interactive-card">
                    <h2 style={{ marginBottom: 8 }}>{t.liveFeed}</h2>
                    <div className="activity-feed">
                        {auctionFeed.length === 0
                            ? <p style={{ color: 'var(--color-text-muted)' }}>No activity yet.</p>
                            : auctionFeed.map((entry, idx) => (
                                <div className="activity-row" key={`${entry.at}-${idx}`}>
                                    <div>{entry.text}</div>
                                    <div style={{ color: 'var(--color-text-muted)', fontSize: 12, marginTop: 6 }}>{new Date(entry.at).toLocaleTimeString(locale === 'ar' ? 'ar-SA' : 'en-US')}</div>
                                </div>
                            ))}
                    </div>
                </UICard>
                <UICard className="interactive-card" id="faq">
                    <h2 style={{ marginBottom: 8 }}>{t.trust}</h2>
                    <div className="page-grid-3" style={{ gridTemplateColumns: '1fr', gap: 10 }}>
                        <UICard><p>{t.trust1}</p></UICard>
                        <UICard><p>{t.trust2}</p></UICard>
                        <UICard><p>{t.trust3}</p></UICard>
                    </div>
                </UICard>
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