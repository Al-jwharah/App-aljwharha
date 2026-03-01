'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
import Link from 'next/link';
import { apiFetch } from '../lib/api';
import s from './enterprise-home.module.css';

/* ─── Types ─── */
type Locale = 'ar' | 'en';
type Listing = { id: string; title: string; type: string; city?: string; price?: string; currency?: string; category_name_ar?: string; category_name_en?: string; seller_verified?: boolean };
type Auction = { id: string; title: string; city?: string; status: string; current_price?: string; starting_price?: string; bid_increment?: string; ends_at: string; bid_count?: number };
type CartItem = { id: string; title: string; price: number; qty: number };

const CART_KEY = 'aljwharah_cart_v2';
const LOCALE_KEY = 'aljwharah_locale_v2';

/* ─── Demo Data ─── */
const demoAuctions: Auction[] = [
    { id: 'demo-a1', title: 'خط إنتاج بلاستيك — ألماني', city: 'الرياض', status: 'LIVE', current_price: '1250000', starting_price: '900000', bid_increment: '25000', ends_at: new Date(Date.now() + 3600000 * 4).toISOString(), bid_count: 14 },
    { id: 'demo-a2', title: 'مخزون قطع غيار صناعية — 12 طن', city: 'الدمام', status: 'LIVE', current_price: '380000', starting_price: '250000', bid_increment: '10000', ends_at: new Date(Date.now() + 3600000 * 8).toISOString(), bid_count: 9 },
    { id: 'demo-a3', title: 'سكراب حديد — 50 طن', city: 'جدة', status: 'LIVE', current_price: '95000', starting_price: '60000', bid_increment: '5000', ends_at: new Date(Date.now() + 3600000 * 2).toISOString(), bid_count: 22 },
];

const demoListings: Listing[] = [
    { id: 'demo-l1', title: 'مواد خام بتروكيماوية — بولي إيثيلين', type: 'RAW_MATERIAL', city: 'الجبيل', price: '420000', currency: 'SAR', category_name_ar: 'مواد خام', category_name_en: 'Raw Materials', seller_verified: true },
    { id: 'demo-l2', title: 'خط تعبئة مياه — طاقة 5000 عبوة/ساعة', type: 'PRODUCTION_LINE', city: 'الرياض', price: '2800000', currency: 'SAR', category_name_ar: 'خطوط إنتاج', category_name_en: 'Production Lines', seller_verified: true },
    { id: 'demo-l3', title: 'مستودع مبرّد — 3000م² — مرخّص', type: 'WAREHOUSE', city: 'الدمام', price: '1500000', currency: 'SAR', category_name_ar: 'مستودعات', category_name_en: 'Warehouses', seller_verified: true },
    { id: 'demo-l4', title: 'معدات تصنيع CNC — 4 ماكينات', type: 'EQUIPMENT', city: 'جدة', price: '680000', currency: 'SAR', category_name_ar: 'معدات', category_name_en: 'Equipment', seller_verified: false },
    { id: 'demo-l5', title: 'مخزون زائد — أنابيب PVC 200 طن', type: 'SURPLUS', city: 'ينبع', price: '145000', currency: 'SAR', category_name_ar: 'مخزون زائد', category_name_en: 'Surplus Stock', seller_verified: true },
    { id: 'demo-l6', title: 'قطع غيار محركات ديزل — كوماتسو', type: 'SPARE_PARTS', city: 'الرياض', price: '92000', currency: 'SAR', category_name_ar: 'قطع غيار', category_name_en: 'Spare Parts', seller_verified: false },
    { id: 'demo-l7', title: 'سكراب نحاس — 8 طن درجة A', type: 'SCRAP', city: 'الدمام', price: '210000', currency: 'SAR', category_name_ar: 'سكراب', category_name_en: 'Scrap', seller_verified: true },
    { id: 'demo-l8', title: 'خط إنتاج كرتون مموّج — ياباني', type: 'PRODUCTION_LINE', city: 'الخبر', price: '3200000', currency: 'SAR', category_name_ar: 'خطوط إنتاج', category_name_en: 'Production Lines', seller_verified: true },
];

const demoPromoted: Listing[] = [
    { id: 'promo-1', title: 'مصنع أغذية مرخّص — جاهز للتشغيل', type: 'FACTORY', city: 'الرياض', price: '8500000', currency: 'SAR', category_name_ar: 'مصانع', category_name_en: 'Factories', seller_verified: true },
    { id: 'promo-2', title: 'خط تصنيع مستحضرات تجميل كامل', type: 'PRODUCTION_LINE', city: 'جدة', price: '4200000', currency: 'SAR', category_name_ar: 'خطوط إنتاج', category_name_en: 'Production Lines', seller_verified: true },
    { id: 'promo-3', title: 'مستودع لوجستي — الرياض — 5000م²', type: 'WAREHOUSE', city: 'الرياض', price: '2100000', currency: 'SAR', category_name_ar: 'مستودعات', category_name_en: 'Warehouses', seller_verified: true },
    { id: 'promo-4', title: 'معدات طباعة أوفست — هايدلبرج', type: 'EQUIPMENT', city: 'الدمام', price: '1600000', currency: 'SAR', category_name_ar: 'معدات', category_name_en: 'Equipment', seller_verified: true },
];

const demoStores = [
    { id: 'store-1', name: 'مؤسسة الراشد للمعدات', city: 'الرياض', listings: 24, verified: true },
    { id: 'store-2', name: 'مصانع الخليج للبلاستيك', city: 'الدمام', listings: 18, verified: true },
    { id: 'store-3', name: 'شركة الأمل للخردة', city: 'جدة', listings: 31, verified: true },
    { id: 'store-4', name: 'مجموعة النور الصناعية', city: 'الخبر', listings: 12, verified: true },
    { id: 'store-5', name: 'مؤسسة الصحراء للمواد الخام', city: 'ينبع', listings: 9, verified: true },
    { id: 'store-6', name: 'مصنع الوطنية للكرتون', city: 'الرياض', listings: 15, verified: true },
];

const categories = [
    { key: 'raw-materials', ar: 'مواد خام', en: 'Raw Materials', icon: '🧪' },
    { key: 'surplus', ar: 'مخزون زائد', en: 'Surplus Stock', icon: '📦' },
    { key: 'equipment', ar: 'معدات', en: 'Equipment', icon: '⚙️' },
    { key: 'production-lines', ar: 'خطوط إنتاج', en: 'Production Lines', icon: '🏭' },
    { key: 'spare-parts', ar: 'قطع غيار', en: 'Spare Parts', icon: '🔧' },
    { key: 'scrap', ar: 'سكراب', en: 'Scrap', icon: '♻️' },
    { key: 'warehouses', ar: 'مستودعات', en: 'Warehouses', icon: '🏢' },
];

const plans = [
    { id: 'basic', ar: 'أساسي', en: 'Basic', price: 0, arDesc: 'مجاني — إعلان واحد', enDesc: 'Free — 1 listing', listings: 1, commission: '1%', featured: false, color: '#64748b' },
    { id: 'pro', ar: 'احترافي', en: 'Professional', price: 299, arDesc: 'للبائعين الجادين', enDesc: 'For serious sellers', listings: 15, commission: '0.75%', featured: true, color: '#c6a75e', popular: true },
    { id: 'enterprise', ar: 'مؤسسات', en: 'Enterprise', price: 799, arDesc: 'حلول شاملة للشركات', enDesc: 'Full enterprise', listings: 999, commission: '0.5%', featured: true, color: '#0f3d2e' },
];

function fmtTime(endsAt: string, isAr: boolean) {
    const diff = Math.max(0, new Date(endsAt).getTime() - Date.now());
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return isAr ? `${h} ساعة ${m} دقيقة` : `${h}h ${m}m`;
}

/* ═══════════ COMPONENT ═══════════ */
export default function EnterpriseHome() {
    const [locale, setLocale] = useState<Locale>('ar');
    const [listings, setListings] = useState<Listing[]>([]);
    const [auctions, setAuctions] = useState<Auction[]>([]);
    const [loading, setLoading] = useState(true);
    const [isDemo, setIsDemo] = useState(false);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [cartOpen, setCartOpen] = useState(false);
    const [searchQ, setSearchQ] = useState('');
    const marqueeRef = useRef<HTMLDivElement>(null);

    const isAr = locale === 'ar';

    useEffect(() => {
        const s = localStorage.getItem(LOCALE_KEY);
        if (s === 'ar' || s === 'en') setLocale(s);
        try { const c = JSON.parse(localStorage.getItem(CART_KEY) || '[]'); if (Array.isArray(c)) setCart(c); } catch { /* */ }
    }, []);

    useEffect(() => {
        document.documentElement.lang = locale;
        document.documentElement.dir = isAr ? 'rtl' : 'ltr';
        localStorage.setItem(LOCALE_KEY, locale);
    }, [locale, isAr]);

    useEffect(() => { localStorage.setItem(CART_KEY, JSON.stringify(cart)); }, [cart]);

    useEffect(() => {
        let active = true;
        setLoading(true);
        Promise.all([
            apiFetch<{ data: Listing[] }>('/listings?status=APPROVED&page=1&limit=12').catch(() => ({ data: [] })),
            apiFetch<{ items: Auction[] }>('/auctions?status=LIVE&page=1&pageSize=6').catch(() => ({ items: [] })),
        ]).then(([lr, ar]) => {
            if (!active) return;
            const rl = lr.data || [];
            const ra = (ar.items || []).map((a) => ({ ...a, title: (a as any).title || (a as any).title_ar || a.id }));
            setListings(rl.length > 0 ? rl : demoListings);
            setAuctions(ra.length > 0 ? ra : demoAuctions);
            setIsDemo(rl.length === 0 && ra.length === 0);
        }).finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, []);

    const metrics = useMemo(() => [
        { label: isAr ? 'إعلانات نشطة' : 'Active Listings', value: Math.max(listings.length, 48) },
        { label: isAr ? 'مزادات مباشرة' : 'Live Auctions', value: Math.max(auctions.length, 12) },
        { label: isAr ? 'بائعون موثّقون' : 'Verified Sellers', value: 156 },
        { label: isAr ? 'حجم التداول' : 'Trading Volume', value: 24, suffix: 'M SAR' },
    ], [listings.length, auctions.length, isAr]);

    const [md, setMd] = useState<number[]>([0, 0, 0, 0]);
    useEffect(() => {
        const targets = metrics.map((m) => m.value);
        const start = Date.now();
        const tick = () => { const p = Math.min(1, (Date.now() - start) / 900); setMd(targets.map((v) => Math.round(v * p))); if (p < 1) requestAnimationFrame(tick); };
        requestAnimationFrame(tick);
    }, [metrics]);

    const cartCount = cart.reduce((s, i) => s + i.qty, 0);
    const cartTotal = cart.reduce((s, i) => s + i.qty * i.price, 0);
    const dir = isAr ? 'rtl' : 'ltr';

    return (
        <div className={`${s.page} ${isAr ? s.rtl : s.ltr}`} data-homepage="true">

            {/* ══════ A) TOP BAR ══════ */}
            <div className={s.topBar}>
                <div className={s.topBarLeft}>
                    <span className={s.topBarItem}><span className={s.topBarLabel}>📞</span> <a href="tel:+966570002169" style={{ color: 'inherit' }}>0570002169</a></span>
                    <span className={s.topBarItem}><span className={s.topBarLabel}>📧</span> <a href="mailto:info@aljwharah.ai" style={{ color: 'inherit' }}>info@aljwharah.ai</a></span>
                </div>
                <div className={s.topBarRight}>
                    <Link href="/support" className={s.quickLink}>{isAr ? 'الدعم الفني' : 'Support'}</Link>
                    <Link href="/pricing" className={s.quickLink}>{isAr ? 'الباقات' : 'Pricing'}</Link>
                    <div className={s.langGroup}>
                        <button className={`${s.langBtn} ${isAr ? s.langBtnActive : ''}`} onClick={() => setLocale('ar')}>العربية</button>
                        <button className={`${s.langBtn} ${!isAr ? s.langBtnActive : ''}`} onClick={() => setLocale('en')}>EN</button>
                    </div>
                </div>
            </div>

            {/* ══════ B) HEADER ══════ */}
            <header className={s.header}>
                <div className={s.headerInner}>
                    <Link href="/" className={s.logoBlock}>
                        <div className={s.logoBadge}>
                            <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
                                <rect x="3" y="3" width="7" height="7" rx="1.5" fill="#c6a75e" />
                                <rect x="14" y="3" width="7" height="7" rx="1.5" fill="#c6a75e" opacity="0.7" />
                                <rect x="3" y="14" width="7" height="7" rx="1.5" fill="#c6a75e" opacity="0.7" />
                                <rect x="14" y="14" width="7" height="7" rx="1.5" fill="#c6a75e" opacity="0.4" />
                                <path d="M10 10l4 4M14 10l-4 4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
                            </svg>
                        </div>
                        <div>
                            <span className={s.logoText} style={{ fontSize: '1.5rem', fontWeight: 900, letterSpacing: '-0.5px', display: 'block', lineHeight: 1.1 }}>الجوهرة</span>
                            <span style={{ fontSize: '0.68rem', color: '#8b9db5', fontFamily: 'var(--font-latin)', fontWeight: 700, letterSpacing: '1.5px' }}>ALJWHARAH.AI</span>
                        </div>
                    </Link>
                    <nav className={s.mainNav}>
                        <Link href="/listings" className={s.navLink}>{isAr ? 'السوق' : 'Market'}</Link>
                        <Link href="/auctions" className={s.navLink}>{isAr ? 'المزادات' : 'Auctions'}</Link>
                        <Link href="/listings?category=factories" className={s.navLink}>{isAr ? 'المصانع' : 'Factories'}</Link>
                        <Link href="/stores" className={s.navLink}>{isAr ? 'المتاجر' : 'Stores'}</Link>
                        <Link href="/ai" className={s.navLink}>{isAr ? 'التقييم الذكي' : 'AI'}</Link>
                        <Link href="/support" className={s.navLink}>{isAr ? 'الدعم' : 'Support'}</Link>
                    </nav>
                    <div className={s.headerActions}>
                        <button className={s.iconButton} onClick={() => setCartOpen(!cartOpen)} aria-label="Cart">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" /></svg>
                            {cartCount > 0 && <span className={s.cartBadge}>{cartCount}</span>}
                        </button>
                        <Link href="/sso" className={s.loginBtn}>{isAr ? 'دخول' : 'Login'}</Link>
                        <Link href="/sso" className={s.signupBtn}>{isAr ? 'أضف إعلان' : 'Post Ad'}</Link>
                    </div>
                    <div className={s.mobileActions}>
                        <button className={s.iconButton} onClick={() => setCartOpen(!cartOpen)} aria-label="Cart">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" /></svg>
                            {cartCount > 0 && <span className={s.cartBadge}>{cartCount}</span>}
                        </button>
                    </div>
                </div>
            </header>

            {/* ══════ C) HERO + SEARCH ══════ */}
            <div className={s.hero}>
                <div className={s.heroContent}>
                    <p className={s.eyebrow}>{isAr ? 'أول سوق سعودي متخصص للأصول الصناعية' : 'Saudi Arabia\'s first specialized industrial marketplace'}</p>
                    <h1 className={s.heroTitle}>{isAr ? 'تداول الأصول الصناعية والمعدات والمواد الخام' : 'Trade Industrial Assets, Equipment & Raw Materials'}</h1>
                    <p className={s.heroSubtitle}>{isAr
                        ? 'مزادات مباشرة · تقييم ذكي AI · مدفوعات آمنة عبر Tap · عمولة 1% فقط'
                        : 'Live Auctions · AI Valuation · Secure Tap Payments · Only 1% Fee'}</p>

                    {/* Search Bar */}
                    <div style={{ maxWidth: 680, margin: '0 auto 20px', position: 'relative' }}>
                        <input
                            value={searchQ}
                            onChange={(e) => setSearchQ(e.target.value)}
                            placeholder={isAr ? 'ابحث: معدات CNC، مواد خام، خطوط إنتاج، سكراب...' : 'Search: CNC equipment, raw materials, production lines...'}
                            style={{ width: '100%', padding: '14px 18px', borderRadius: 14, border: '2px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.12)', color: '#fff', fontSize: '1rem', backdropFilter: 'blur(4px)', outline: 'none' }}
                            onKeyDown={(e) => { if (e.key === 'Enter' && searchQ.trim()) window.location.href = `/listings?q=${encodeURIComponent(searchQ.trim())}`; }}
                        />
                        <button
                            onClick={() => { if (searchQ.trim()) window.location.href = `/listings?q=${encodeURIComponent(searchQ.trim())}`; }}
                            style={{ position: 'absolute', top: '50%', left: isAr ? 10 : undefined, right: isAr ? undefined : 10, transform: 'translateY(-50%)', background: 'linear-gradient(135deg, #c6a75e, #d4b96e)', border: 'none', borderRadius: 10, padding: '8px 18px', fontWeight: 800, cursor: 'pointer', color: '#1a1a1a', fontSize: '0.88rem' }}
                        >{isAr ? '🔍 بحث' : '🔍 Search'}</button>
                    </div>

                    <div className={s.heroButtons}>
                        <Link href="/listings"><button className={s.primaryCta}>{isAr ? 'استكشف السوق' : 'Explore Market'}</button></Link>
                        <Link href="/sso"><button className={s.secondaryCta}>{isAr ? 'أضف إعلان' : 'Post Ad'}</button></Link>
                    </div>

                    <div className={s.metricsGrid}>
                        {metrics.map((m, i) => (
                            <div key={m.label} className={s.metricCard}>
                                <div className={s.metricValue}>{md[i]?.toLocaleString(isAr ? 'ar-SA' : 'en-US')}{m.suffix ? ` ${m.suffix}` : '+'}</div>
                                <div className={s.metricLabel}>{m.label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ══════ D) ANIMATED ADS MARQUEE ══════ */}
            <section style={{ overflow: 'hidden', background: 'linear-gradient(90deg, #0d3629, #1d5d47)', padding: '12px 0' }}>
                <div ref={marqueeRef} style={{ display: 'flex', gap: 24, animation: 'marquee 30s linear infinite', whiteSpace: 'nowrap' }}>
                    {[...demoPromoted, ...demoPromoted].map((item, idx) => (
                        <Link key={`${item.id}-${idx}`} href={item.id.startsWith('promo') ? '/listings' : `/listings/${item.id}`}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: '8px 16px', flexShrink: 0, border: '1px solid rgba(198,167,94,0.3)', color: '#fff' }}>
                            <span style={{ background: '#c6a75e', color: '#1a1a1a', padding: '2px 8px', borderRadius: 999, fontSize: '0.68rem', fontWeight: 800 }}>⭐ {isAr ? 'مميز' : 'AD'}</span>
                            <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>{item.title}</span>
                            <span style={{ fontFamily: 'var(--font-latin)', fontWeight: 800, color: '#c6a75e' }}>{Number(item.price || 0).toLocaleString('en-US')} SAR</span>
                        </Link>
                    ))}
                </div>
                <style>{`@keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }`}</style>
            </section>

            {/* ══════ E) FEATURED LISTINGS GRID ══════ */}
            <section className={s.section} id="listings">
                <div className={s.sectionHead}>
                    <div><h2>{isAr ? 'إعلانات السوق' : 'Market Listings'}</h2><p>{isAr ? 'أصول صناعية وتجارية من بائعين موثّقين.' : 'Industrial assets from verified sellers.'}</p></div>
                    {isDemo && <span className={s.demoBadge}>{isAr ? 'بيانات توضيحية' : 'Demo'}</span>}
                </div>
                {loading ? (
                    <div className={s.listingsGrid}>{[0, 1, 2, 3].map(i => <div key={i} className={s.listingSkeleton}><div className={s.skeletonLineLong} /><div className={s.skeletonLineMid} /><div className={s.skeletonLineShort} /></div>)}</div>
                ) : (
                    <div className={s.listingsGrid}>
                        {listings.slice(0, 8).map(listing => {
                            const price = Number(listing.price || 0);
                            const inCart = cart.find(x => x.id === listing.id);
                            return (
                                <div key={listing.id} className={s.listingCard}>
                                    {listing.seller_verified && <span className={s.listingBadge}>✓ {isAr ? 'موثّق' : 'Verified'}</span>}
                                    <h3>{listing.title}</h3>
                                    <p className={s.listingMeta}>{(isAr ? listing.category_name_ar : listing.category_name_en) || listing.type} · {listing.city || '—'}</p>
                                    <p className={s.listingPrice}>{price.toLocaleString('en-US')} {listing.currency || 'SAR'}</p>
                                    <div className={s.listingActions}>
                                        <button className={s.addBtn} onClick={() => { if (listing.id.startsWith('demo')) return; setCart(prev => { const e = prev.find(x => x.id === listing.id); if (e) return prev.map(x => x.id === listing.id ? { ...x, qty: x.qty + 1 } : x); return [...prev, { id: listing.id, title: listing.title, price, qty: 1 }]; }); }}>
                                            {isAr ? 'أضف للسلة' : 'Add to Cart'}
                                        </button>
                                        <Link href={listing.id.startsWith('demo') ? '/listings' : `/listings/${listing.id}`}><button className={s.removeBtn}>{isAr ? 'التفاصيل' : 'Details'}</button></Link>
                                    </div>
                                    {inCart && <p className={s.inCartLabel}>{isAr ? `في السلة (${inCart.qty})` : `In cart (${inCart.qty})`}</p>}
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>

            {/* ══════ F) LIVE AUCTIONS STRIP ══════ */}
            <section className={s.section} id="auctions">
                <div className={s.sectionHead}>
                    <div><h2>{isAr ? '🔴 المزادات المباشرة' : '🔴 Live Auctions'}</h2><p>{isAr ? 'زايد الآن على أصول صناعية حقيقية.' : 'Bid now on real industrial assets.'}</p></div>
                </div>
                <div className={s.auctionsGrid}>
                    {(loading ? [] : auctions).map(a => {
                        const price = Number(a.current_price || a.starting_price || 0);
                        const start = Number(a.starting_price || 0);
                        const prog = start > 0 ? Math.min(100, ((price - start) / start) * 100 + 30) : 50;
                        return (
                            <div key={a.id} className={s.auctionCard}>
                                <div className={s.auctionTopRow}><span className={s.liveTag}>● {isAr ? 'مباشر' : 'LIVE'}</span><span className={s.countdownLabel}>{fmtTime(a.ends_at, isAr)}</span></div>
                                <h3>{a.title}</h3>
                                <p className={s.auctionMeta}>{a.city} · {a.bid_count} {isAr ? 'مزايدة' : 'bids'}</p>
                                <div className={s.auctionStats}>
                                    <div><span>{isAr ? 'الحالي' : 'Current'}</span><strong>{price.toLocaleString('en-US')} SAR</strong></div>
                                    <div><span>{isAr ? 'الحد الأدنى' : 'Min'}</span><strong>{Number(a.bid_increment || 0).toLocaleString('en-US')} SAR</strong></div>
                                </div>
                                <div className={s.progressTrack}><span className={s.progressFill} style={{ width: `${prog}%` }} /></div>
                                <Link href={a.id.startsWith('demo') ? '/auctions' : `/auctions/${a.id}`}><button className={s.auctionCta}>{isAr ? 'زايد الآن' : 'Place Bid'}</button></Link>
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* ══════ G) CATEGORIES GRID ══════ */}
            <section className={s.section} id="categories">
                <div className={s.sectionHead}><div><h2>{isAr ? 'تصفح حسب الفئة' : 'Browse by Category'}</h2></div></div>
                <div className={s.categoriesGrid}>
                    {categories.map(c => (
                        <Link key={c.key} href={`/listings?category=${c.key}`}>
                            <div className={s.categoryCard}><div className={s.categoryIcon}>{c.icon}</div><div><strong>{isAr ? c.ar : c.en}</strong></div></div>
                        </Link>
                    ))}
                </div>
            </section>

            {/* ══════ H) VERIFIED SELLERS / STORES ══════ */}
            <section className={s.section} id="stores">
                <div className={s.sectionHead}><div><h2>{isAr ? 'بائعون ومتاجر موثّقة' : 'Verified Sellers & Stores'}</h2><p>{isAr ? 'متاجر صناعية معتمدة على المنصة.' : 'Certified industrial stores on the platform.'}</p></div></div>
                <div className={s.auctionsGrid}>
                    {demoStores.slice(0, 3).map(store => (
                        <Link key={store.id} href={`/stores?id=${store.id}`}>
                            <div className={s.listingCard} style={{ textAlign: 'center', padding: 24 }}>
                                <div style={{ width: 56, height: 56, borderRadius: 16, background: 'linear-gradient(145deg, #0f3d2e, #225e4a)', margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c6a75e', fontSize: 24, fontWeight: 900 }}>{store.name[0]}</div>
                                <h3 style={{ marginBottom: 4 }}>{store.name}</h3>
                                <p className={s.auctionMeta}>{store.city} · {store.listings} {isAr ? 'إعلان' : 'listings'}</p>
                                {store.verified && <span className={s.listingBadge} style={{ marginTop: 8 }}>✓ {isAr ? 'موثّق' : 'Verified'}</span>}
                            </div>
                        </Link>
                    ))}
                </div>
            </section>

            {/* ══════ I) HOW IT WORKS ══════ */}
            <section className={s.section} id="how-it-works">
                <div className={s.sectionHead}><div><h2>{isAr ? 'كيف تعمل المنصة؟' : 'How It Works'}</h2></div></div>
                <div className={s.trustGrid} style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                    <div className={s.trustCard} style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>1️⃣</div>
                        <h3>{isAr ? 'سجّل حسابك' : 'Register'}</h3>
                        <p>{isAr ? 'أنشئ حسابك مجاناً عبر الجوال أو البريد الإلكتروني أو Google.' : 'Create a free account via phone, email, or Google.'}</p>
                    </div>
                    <div className={s.trustCard} style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>2️⃣</div>
                        <h3>{isAr ? 'أضف إعلانك أو زايد' : 'Post or Bid'}</h3>
                        <p>{isAr ? 'أضف إعلانك الصناعي أو شارك في المزادات المباشرة.' : 'Post your industrial listing or participate in live auctions.'}</p>
                    </div>
                    <div className={s.trustCard} style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>3️⃣</div>
                        <h3>{isAr ? 'أتمم الصفقة بأمان' : 'Complete Securely'}</h3>
                        <p>{isAr ? 'ادفع عبر بوابة Tap الآمنة. عمولة المنصة 1% فقط.' : 'Pay via Tap secure gateway. Only 1% platform fee.'}</p>
                    </div>
                </div>
            </section>

            {/* ══════ AI VALUATION ══════ */}
            <div className={s.aiSection}>
                <div className={s.aiCopy}>
                    <h2>{isAr ? 'محرك التقييم الذكي AI' : 'AI Valuation Engine'}</h2>
                    <p>{isAr ? 'تقييم فوري للأصول الصناعية بناءً على بيانات السوق الحقيقية.' : 'Instant asset valuation powered by real market data.'}</p>
                </div>
                <Link href="/ai"><button className={s.aiCta}>{isAr ? 'جرّب التقييم' : 'Try AI'}</button></Link>
            </div>

            {/* ══════ SUBSCRIPTION PLANS ══════ */}
            <section className={s.section} id="pricing">
                <div className={s.sectionHead}><div><h2>{isAr ? 'باقات الاشتراك' : 'Plans'}</h2><p>{isAr ? 'اختر باقتك وابدأ البيع. الدفع عبر Tap بجميع الوسائل.' : 'Choose your plan. Payment via Tap — all methods.'}</p></div></div>
                <div className={s.auctionsGrid}>
                    {plans.map(plan => (
                        <div key={plan.id} className={s.listingCard} style={plan.popular ? { borderColor: '#c6a75e', borderWidth: 2, position: 'relative' } : {}}>
                            {plan.popular && <span style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(135deg, #c6a75e, #d4b96e)', color: '#1a1a1a', padding: '4px 14px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 800 }}>{isAr ? '⭐ الأكثر طلباً' : '⭐ Popular'}</span>}
                            <div style={{ textAlign: 'center', paddingTop: plan.popular ? 12 : 0 }}>
                                <h3 style={{ fontSize: '1.3rem', color: plan.color, marginBottom: 4 }}>{isAr ? plan.ar : plan.en}</h3>
                                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginBottom: 14 }}>{isAr ? plan.arDesc : plan.enDesc}</p>
                                <div style={{ fontFamily: 'var(--font-latin)', fontSize: '2.2rem', fontWeight: 900 }}>{plan.price === 0 ? (isAr ? 'مجاني' : 'Free') : `${plan.price} SAR`}</div>
                                {plan.price > 0 && <p style={{ color: 'var(--color-text-muted)', fontSize: '0.78rem', marginBottom: 12 }}>{isAr ? '/ شهرياً' : '/ month'}</p>}
                            </div>
                            <div style={{ display: 'grid', gap: 6, margin: '14px 0' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.86rem' }}><span>{isAr ? 'الإعلانات' : 'Listings'}</span><strong>{plan.listings === 999 ? '∞' : plan.listings}</strong></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.86rem' }}><span>{isAr ? 'العمولة' : 'Fee'}</span><strong>{plan.commission}</strong></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.86rem' }}><span>{isAr ? 'إعلانات مميزة' : 'Featured'}</span><strong>{plan.featured ? '✓' : '—'}</strong></div>
                            </div>
                            <Link href="/sso" style={{ display: 'block' }}><button className={plan.popular ? s.addBtn : s.removeBtn} style={{ width: '100%' }}>{plan.price === 0 ? (isAr ? 'ابدأ مجاناً' : 'Start Free') : (isAr ? 'اشترك' : 'Subscribe')}</button></Link>
                        </div>
                    ))}
                </div>
                <p style={{ textAlign: 'center', margin: '14px 0', color: 'var(--color-text-muted)', fontSize: '0.82rem' }}>{isAr ? '💳 مدى · فيزا · ماستركارد · Apple Pay · STC Pay' : '💳 mada · Visa · Mastercard · Apple Pay · STC Pay'}</p>
            </section>

            {/* ══════ J) TRUST & IP COMPLIANCE ══════ */}
            <section className={s.section} id="trust">
                <div className={s.sectionHead}><div><h2>{isAr ? 'الثقة والامتثال' : 'Trust & Compliance'}</h2></div></div>
                <div className={s.trustGrid} style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                    <div className={s.trustCard}>
                        <h3>{isAr ? 'الامتثال لأنظمة الملكية الفكرية' : 'IP Compliance'}</h3>
                        <p>{isAr ? 'نلتزم بأنظمة الهيئة السعودية للملكية الفكرية (SAIP) ونتحقق من وثائق الملكية قبل نشر أي إعلان.' : 'We comply with Saudi IP Authority (SAIP) regulations and verify ownership documents before publishing.'}</p>
                    </div>
                    <div className={s.trustCard}>
                        <h3>{isAr ? 'آلية بلاغات الملكية الفكرية' : 'IP Takedown Process'}</h3>
                        <p>{isAr ? 'إذا وجدت انتهاكاً لحقوق ملكيتك الفكرية، يمكنك تقديم بلاغ وسنتعامل معه خلال 48 ساعة عمل.' : 'If you find an IP violation, submit a report and we\'ll handle it within 48 business hours.'}</p>
                    </div>
                    <div className={s.trustCard}>
                        <h3>{isAr ? 'مدفوعات آمنة' : 'Secure Payments'}</h3>
                        <p>{isAr ? 'بوابة Tap المرخّصة من مؤسسة النقد. دعم جميع وسائل الدفع المحلية والدولية.' : 'Tap gateway licensed by SAMA. All local and international payment methods.'}</p>
                    </div>
                </div>
            </section>

            {/* ══════ SELL CTA ══════ */}
            <section className={s.section}>
                <div className={s.sellBanner}>
                    <div>
                        <h2>{isAr ? 'لديك أصل صناعي؟ أضف إعلانك الآن' : 'Have an asset? Post your ad now'}</h2>
                        <p>{isAr ? 'سجّل مجاناً وأضف إعلانك بدقائق. عمولة 1% فقط عند البيع.' : 'Register free and post in minutes. Only 1% fee on sale.'}</p>
                    </div>
                    <Link href="/sso"><button className={s.primaryCta}>{isAr ? 'أضف إعلان' : 'Post Ad'}</button></Link>
                </div>
            </section>

            {/* ══════ K) FOOTER ══════ */}
            <footer className={s.footer}>
                <div className={s.footerGrid}>
                    <div>
                        <h4>{isAr ? 'المنصة' : 'Platform'}</h4>
                        <Link href="/about">{isAr ? 'من نحن' : 'About'}</Link>
                        <Link href="/how-it-works">{isAr ? 'كيف تعمل' : 'How It Works'}</Link>
                        <Link href="/pricing">{isAr ? 'الباقات' : 'Pricing'}</Link>
                    </div>
                    <div>
                        <h4>{isAr ? 'السوق' : 'Market'}</h4>
                        <Link href="/listings">{isAr ? 'الإعلانات' : 'Listings'}</Link>
                        <Link href="/auctions">{isAr ? 'المزادات' : 'Auctions'}</Link>
                        <Link href="/stores">{isAr ? 'المتاجر' : 'Stores'}</Link>
                        <Link href="/ai">{isAr ? 'التقييم الذكي' : 'AI'}</Link>
                    </div>
                    <div>
                        <h4>{isAr ? 'القانونية' : 'Legal'}</h4>
                        <Link href="/terms">{isAr ? 'الشروط والأحكام' : 'Terms'}</Link>
                        <Link href="/privacy">{isAr ? 'الخصوصية' : 'Privacy'}</Link>
                        <Link href="/refund">{isAr ? 'الاسترجاع' : 'Refund'}</Link>
                        <Link href="/ip-policy">{isAr ? 'الملكية الفكرية' : 'IP Policy'}</Link>
                    </div>
                    <div>
                        <h4>{isAr ? 'الدعم الفني' : 'Support'}</h4>
                        <a href="tel:+966570002169">📞 0570002169</a>
                        <a href="mailto:info@aljwharah.ai">📧 info@aljwharah.ai</a>
                        <a href="https://wa.me/966570002169" target="_blank" rel="noreferrer">💬 {isAr ? 'واتساب' : 'WhatsApp'}</a>
                        <div className={s.footerSocials}>
                            <a href="https://x.com" target="_blank" rel="noreferrer">𝕏</a>
                            <a href="https://linkedin.com" target="_blank" rel="noreferrer">in</a>
                        </div>
                    </div>
                </div>
                <div className={s.footerBottom}>
                    <p>© 2026 {isAr ? 'الجوهرة' : 'Aljwharah'}.ai — {isAr ? 'جميع الحقوق محفوظة' : 'All rights reserved'}</p>
                    <p style={{ fontSize: '0.76rem', opacity: 0.6, marginTop: 4 }}>{isAr ? 'عمولة المنصة 1% ثابتة على كل عملية بيع ناجحة.' : 'Fixed 1% platform fee on every successful sale.'}</p>
                </div>
            </footer>

            {/* ══════ CART SHEET ══════ */}
            {cartOpen && (
                <>
                    <button className={s.overlay} onClick={() => setCartOpen(false)} aria-label="Close" />
                    <div className={`${s.cartSheet} ${dir === 'rtl' ? s.cartSheetRtl : s.cartSheetLtr}`}>
                        <div className={s.cartHead}>
                            <div><h3>{isAr ? 'السلة' : 'Cart'}</h3><p>{cartCount} {isAr ? 'عناصر' : 'items'}</p></div>
                            <button onClick={() => setCartOpen(false)}>✕</button>
                        </div>
                        {cart.length === 0 ? <p className={s.cartEmpty}>{isAr ? 'فارغة' : 'Empty'}</p> : (
                            <>
                                <div className={s.cartItems}>{cart.map(item => (
                                    <div key={item.id} className={s.cartItem}>
                                        <h4>{item.title}</h4>
                                        <p>{item.price.toLocaleString('en-US')} SAR × {item.qty}</p>
                                        <div className={s.cartQtyControls}>
                                            <button onClick={() => setCart(p => p.map(x => x.id === item.id ? { ...x, qty: Math.max(1, x.qty - 1) } : x))}>−</button>
                                            <span>{item.qty}</span>
                                            <button onClick={() => setCart(p => p.map(x => x.id === item.id ? { ...x, qty: x.qty + 1 } : x))}>+</button>
                                        </div>
                                        <button className={s.cartRemove} onClick={() => setCart(p => p.filter(x => x.id !== item.id))}>{isAr ? 'حذف' : 'Remove'}</button>
                                    </div>
                                ))}</div>
                                <div className={s.cartTotals}><div><span>{isAr ? 'الإجمالي' : 'Total'}</span><strong>{cartTotal.toLocaleString('en-US')} SAR</strong></div></div>
                                <div className={s.cartFoot}>
                                    <Link href="/cart"><button className={s.primaryCta}>{isAr ? 'إتمام' : 'Checkout'}</button></Link>
                                    <button className={s.removeBtn} onClick={() => setCartOpen(false)}>{isAr ? 'متابعة' : 'Continue'}</button>
                                </div>
                            </>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}