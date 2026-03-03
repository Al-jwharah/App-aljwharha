'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiFetch } from '../lib/api';
import s from './enterprise-home.module.css';

type Locale = 'ar' | 'en';

type Listing = {
    id: string;
    title: string;
    type: string;
    city?: string;
    price?: string | number;
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
    current_price?: string | number;
    starting_price?: string | number;
    bid_increment?: string | number;
    ends_at: string;
    bid_count?: number;
};

type Store = {
    id: string;
    name: string;
    city: string;
    listings: number;
    verified: boolean;
};

const LOCALE_KEY = 'aljwharah_locale_v2';

const demoListings: Listing[] = [
    { id: 'd-l1', title: 'خط تعبئة مياه بطاقة 5000 عبوة/ساعة', type: 'PRODUCTION_LINE', city: 'الرياض', price: 2800000, currency: 'SAR', category_name_ar: 'خطوط إنتاج', seller_verified: true },
    { id: 'd-l2', title: 'مستودع مبرد مرخص بمساحة 3000 م2', type: 'WAREHOUSE', city: 'الدمام', price: 1500000, currency: 'SAR', category_name_ar: 'مستودعات', seller_verified: true },
    { id: 'd-l3', title: 'معدات CNC صناعية - 4 ماكينات', type: 'EQUIPMENT', city: 'جدة', price: 680000, currency: 'SAR', category_name_ar: 'معدات', seller_verified: false },
    { id: 'd-l4', title: 'مواد خام بتروكيماوية بولي إيثيلين', type: 'RAW_MATERIAL', city: 'الجبيل', price: 420000, currency: 'SAR', category_name_ar: 'مواد خام', seller_verified: true },
    { id: 'd-l5', title: 'مخزون قطع غيار صناعية متنوع', type: 'SPARE_PARTS', city: 'الرياض', price: 92000, currency: 'SAR', category_name_ar: 'قطع غيار', seller_verified: false },
    { id: 'd-l6', title: 'سكراب نحاس درجة A - 8 طن', type: 'SCRAP', city: 'الدمام', price: 210000, currency: 'SAR', category_name_ar: 'سكراب', seller_verified: true },
];

const demoAuctions: Auction[] = [
    { id: 'd-a1', title: 'مزاد خط إنتاج بلاستيك ألماني', city: 'الرياض', status: 'LIVE', current_price: 1250000, starting_price: 900000, bid_increment: 25000, ends_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(), bid_count: 14 },
    { id: 'd-a2', title: 'مزاد مخزون قطع غيار صناعية', city: 'الدمام', status: 'LIVE', current_price: 380000, starting_price: 250000, bid_increment: 10000, ends_at: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(), bid_count: 9 },
    { id: 'd-a3', title: 'مزاد سكراب حديد - 50 طن', city: 'جدة', status: 'LIVE', current_price: 95000, starting_price: 60000, bid_increment: 5000, ends_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), bid_count: 22 },
];

const demoStores: Store[] = [
    { id: 'd-s1', name: 'مصانع الخليج للبلاستيك', city: 'الدمام', listings: 18, verified: true },
    { id: 'd-s2', name: 'مؤسسة الراشد للمعدات', city: 'الرياض', listings: 24, verified: true },
    { id: 'd-s3', name: 'شركة الأمل للسكراب', city: 'جدة', listings: 31, verified: true },
    { id: 'd-s4', name: 'مجموعة النور الصناعية', city: 'الخبر', listings: 12, verified: true },
];

function money(value: string | number | undefined, currency = 'SAR') {
    const amount = Number(value || 0);
    return `${amount.toLocaleString('en-US')} ${currency}`;
}

function timeLeftLabel(endsAt: string, isAr: boolean) {
    const diff = Math.max(0, new Date(endsAt).getTime() - Date.now());
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return isAr ? `${h}س ${m}د` : `${h}h ${m}m`;
}

function seedFromText(text: string) {
    let hash = 0;
    for (let i = 0; i < text.length; i += 1) {
        hash = text.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash % 360);
}

export default function EnterpriseHome() {
    const router = useRouter();
    const [locale, setLocale] = useState<Locale>('ar');
    const [loading, setLoading] = useState(true);
    const [isDemo, setIsDemo] = useState(false);
    const [searchQ, setSearchQ] = useState('');
    const [listings, setListings] = useState<Listing[]>([]);
    const [auctions, setAuctions] = useState<Auction[]>([]);

    const isAr = locale === 'ar';

    useEffect(() => {
        const saved = localStorage.getItem(LOCALE_KEY);
        if (saved === 'ar' || saved === 'en') setLocale(saved);
    }, []);

    useEffect(() => {
        document.documentElement.lang = locale;
        document.documentElement.dir = isAr ? 'rtl' : 'ltr';
        localStorage.setItem(LOCALE_KEY, locale);
    }, [locale, isAr]);

    useEffect(() => {
        let active = true;
        setLoading(true);

        Promise.all([
            apiFetch<{ data: Listing[] }>('/listings?status=APPROVED&page=1&limit=12').catch(() => ({ data: [] })),
            apiFetch<{ items: Auction[] }>('/auctions?status=LIVE&page=1&pageSize=6').catch(() => ({ items: [] })),
        ]).then(([lr, ar]) => {
            if (!active) return;
            const listingsRows = Array.isArray(lr.data) ? lr.data : [];
            const auctionsRows = Array.isArray(ar.items) ? ar.items : [];

            setListings(listingsRows.length ? listingsRows : demoListings);
            setAuctions(auctionsRows.length ? auctionsRows : demoAuctions);
            setIsDemo(listingsRows.length === 0 && auctionsRows.length === 0);
        }).finally(() => {
            if (active) setLoading(false);
        });

        return () => {
            active = false;
        };
    }, []);

    const featuredListings = useMemo(() => listings.slice(0, 6), [listings]);
    const liveAuctions = useMemo(() => auctions.slice(0, 3), [auctions]);

    const stats = useMemo(() => {
        return [
            {
                label: isAr ? 'إعلانات نشطة' : 'Active Listings',
                value: Math.max(listings.length, 48).toLocaleString('en-US'),
            },
            {
                label: isAr ? 'مزادات مباشرة' : 'Live Auctions',
                value: Math.max(auctions.length, 12).toLocaleString('en-US'),
            },
            {
                label: isAr ? 'متاجر موثقة' : 'Verified Stores',
                value: '156+',
            },
            {
                label: isAr ? 'حجم تداول سنوي' : 'Annual GMV',
                value: '24M SAR',
            },
        ];
    }, [isAr, listings.length, auctions.length]);

    const i18n = isAr
        ? {
            home: 'الرئيسية',
            listings: 'الإعلانات',
            auctions: 'المزادات',
            stores: 'المتاجر',
            pricing: 'الباقات',
            signIn: 'تسجيل الدخول',
            postAd: 'أضف إعلان',
            heroBadge: 'منصة سعودية احترافية لتداول الأصول الصناعية',
            heroTitle: 'سوق موثوق لبيع وشراء المعدات والمصانع والخطوط الإنتاجية',
            heroDesc: 'واجهة مؤسسية عالية الاحتراف تجمع بين الإعلانات، المزادات المباشرة، والتحليلات الذكية داخل منصة واحدة.',
            searchPlaceholder: 'ابحث باسم الأصل، المدينة، أو نوع النشاط',
            searchBtn: 'بحث متقدم',
            aiBtn: 'الوكيل الذكي',
            featuredTitle: 'إعلانات مميزة',
            featuredDesc: 'بطاقات إعلانية متوازنة بصريًا لعرض أوضح وأكثر مهنية.',
            auctionTitle: 'مزادات مباشرة',
            auctionDesc: 'متابعة المزادات النشطة مع معلومات سعرية فورية.',
            current: 'السعر الحالي',
            increment: 'الحد الأدنى للزيادة',
            bids: 'مزايدة',
            bidNow: 'زايد الآن',
            storesTitle: 'متاجر معتمدة',
            storesDesc: 'شركاء بيع موثقون مع سجل تداول واضح.',
            advantagesTitle: 'لماذا الجوهرة',
            adv1: 'هوية مؤسسية قوية وتجربة استخدام نظيفة.',
            adv2: 'إعلانات ومزادات ضمن نظام واحد موحد.',
            adv3: 'حوكمة وتشغيل عبر لوحات Admin وOwner.',
            adv4: 'تكامل وكيل AI احترافي مع تقارير تنفيذية.',
            ctaTitle: 'جاهز لعرض أصلك الصناعي باحتراف؟',
            ctaDesc: 'ابدأ الآن وارفع إعلانك مع تجربة مرئية متوازنة وموثوقة.',
            viewAll: 'عرض السوق',
            verified: 'موثق',
            demo: 'يتم عرض بيانات تجريبية لحين توفر بيانات مباشرة',
            legal: 'القانونية',
            terms: 'الشروط',
            privacy: 'الخصوصية',
            support: 'الدعم',
            contact: 'اتصل بنا',
            allRights: 'جميع الحقوق محفوظة',
        }
        : {
            home: 'Home',
            listings: 'Listings',
            auctions: 'Auctions',
            stores: 'Stores',
            pricing: 'Pricing',
            signIn: 'Sign In',
            postAd: 'Post Ad',
            heroBadge: 'Saudi Professional Industrial Marketplace',
            heroTitle: 'Trusted Market for Industrial Assets and Production Lines',
            heroDesc: 'A high-end enterprise interface combining listings, live auctions, and smart operations in one platform.',
            searchPlaceholder: 'Search by asset name, city, or activity type',
            searchBtn: 'Advanced Search',
            aiBtn: 'AI Agent',
            featuredTitle: 'Featured Listings',
            featuredDesc: 'Balanced visual listing cards for clearer and more professional presentation.',
            auctionTitle: 'Live Auctions',
            auctionDesc: 'Track active auctions with real-time pricing context.',
            current: 'Current Price',
            increment: 'Min Increment',
            bids: 'bids',
            bidNow: 'Place Bid',
            storesTitle: 'Verified Stores',
            storesDesc: 'Verified sellers with clear transaction history.',
            advantagesTitle: 'Why Aljwharah',
            adv1: 'Strong enterprise identity and clean UX.',
            adv2: 'Listings and auctions under one platform.',
            adv3: 'Governance workflow across Admin and Owner consoles.',
            adv4: 'Professional AI agent integration with executive reporting.',
            ctaTitle: 'Ready to list your industrial asset professionally?',
            ctaDesc: 'Start now and publish with a trusted, balanced visual experience.',
            viewAll: 'Explore Market',
            verified: 'Verified',
            demo: 'Demo data is currently shown until live market data is available.',
            legal: 'Legal',
            terms: 'Terms',
            privacy: 'Privacy',
            support: 'Support',
            contact: 'Contact',
            allRights: 'All rights reserved',
        };

    return (
        <div className={`${s.page} ${isAr ? s.rtl : s.ltr}`} data-homepage="true">
            <header className={s.header}>
                <div className={s.headerInner}>
                    <Link href="/" className={s.brandBlock}>
                        <div className={s.brandMark}>
                            <span>AA</span>
                        </div>
                        <div className={s.brandText}>
                            <strong>الجوهرة</strong>
                            <small>ALJWHARAH.AI</small>
                        </div>
                    </Link>

                    <nav className={s.nav}>
                        <Link href="/">{i18n.home}</Link>
                        <Link href="/listings">{i18n.listings}</Link>
                        <Link href="/auctions">{i18n.auctions}</Link>
                        <Link href="/stores">{i18n.stores}</Link>
                        <Link href="/pricing">{i18n.pricing}</Link>
                    </nav>

                    <div className={s.actions}>
                        <button
                            className={s.localeBtn}
                            type="button"
                            onClick={() => setLocale(isAr ? 'en' : 'ar')}
                        >
                            {isAr ? 'EN' : 'AR'}
                        </button>
                        <Link href="/sso" className={s.ghostBtn}>{i18n.signIn}</Link>
                        <Link href="/sso" className={s.primaryBtn}>{i18n.postAd}</Link>
                    </div>
                </div>
            </header>

            <section className={s.hero}>
                <div className={s.heroContent}>
                    <p className={s.heroBadge}>{i18n.heroBadge}</p>
                    <h1>{i18n.heroTitle}</h1>
                    <p className={s.heroDesc}>{i18n.heroDesc}</p>

                    <div className={s.searchWrap}>
                        <input
                            value={searchQ}
                            onChange={(e) => setSearchQ(e.target.value)}
                            placeholder={i18n.searchPlaceholder}
                        />
                        <button
                            type="button"
                            className={s.searchBtn}
                            onClick={() => {
                                const q = searchQ.trim();
                                router.push(q ? `/listings?q=${encodeURIComponent(q)}` : '/listings');
                            }}
                        >
                            {i18n.searchBtn}
                        </button>
                        <Link href="/ai" className={s.aiBtn}>{i18n.aiBtn}</Link>
                    </div>

                    <div className={s.statsGrid}>
                        {stats.map((item) => (
                            <article key={item.label} className={s.statCard}>
                                <strong>{item.value}</strong>
                                <span>{item.label}</span>
                            </article>
                        ))}
                    </div>
                </div>
            </section>

            <section className={s.section}>
                <div className={s.sectionHead}>
                    <div>
                        <h2>{i18n.featuredTitle}</h2>
                        <p>{i18n.featuredDesc}</p>
                    </div>
                    {isDemo ? <span className={s.demoFlag}>{i18n.demo}</span> : null}
                </div>

                <div className={s.listingsGrid}>
                    {(loading ? demoListings : featuredListings).map((listing) => {
                        const hue = seedFromText(listing.id + listing.type);
                        const categoryLabel = isAr
                            ? (listing.category_name_ar || listing.type)
                            : (listing.category_name_en || listing.type);

                        return (
                            <article key={listing.id} className={s.listingCard}>
                                <div
                                    className={s.media}
                                    style={{
                                        background: `linear-gradient(140deg, hsl(${hue} 55% 28%), hsl(${(hue + 35) % 360} 65% 42%))`,
                                    }}
                                >
                                    <span>{categoryLabel}</span>
                                </div>

                                <div className={s.listingBody}>
                                    <h3>{listing.title}</h3>
                                    <p>{listing.city || 'Saudi Arabia'}</p>
                                    <div className={s.listingFoot}>
                                        <strong>{money(listing.price, listing.currency || 'SAR')}</strong>
                                        {listing.seller_verified ? <em>{i18n.verified}</em> : null}
                                    </div>
                                    <Link href={`/listings/${listing.id}`} className={s.inlineBtn}>{i18n.viewAll}</Link>
                                </div>
                            </article>
                        );
                    })}
                </div>
            </section>

            <section className={s.section}>
                <div className={s.sectionHead}>
                    <div>
                        <h2>{i18n.auctionTitle}</h2>
                        <p>{i18n.auctionDesc}</p>
                    </div>
                </div>

                <div className={s.auctionGrid}>
                    {(loading ? demoAuctions : liveAuctions).map((auction) => {
                        const current = Number(auction.current_price || auction.starting_price || 0);
                        const start = Number(auction.starting_price || 0);
                        const progress = start > 0 ? Math.min(100, Math.round((current / start) * 45)) : 50;

                        return (
                            <article key={auction.id} className={s.auctionCard}>
                                <div className={s.auctionTop}>
                                    <span className={s.livePill}>LIVE</span>
                                    <span>{timeLeftLabel(auction.ends_at, isAr)}</span>
                                </div>
                                <h3>{auction.title}</h3>
                                <p>{auction.city || '-'} • {auction.bid_count || 0} {i18n.bids}</p>
                                <dl>
                                    <div>
                                        <dt>{i18n.current}</dt>
                                        <dd>{money(current)}</dd>
                                    </div>
                                    <div>
                                        <dt>{i18n.increment}</dt>
                                        <dd>{money(auction.bid_increment || 0)}</dd>
                                    </div>
                                </dl>
                                <div className={s.progressTrack}><span style={{ width: `${progress}%` }} /></div>
                                <Link href={auction.id.startsWith('d-') ? '/auctions' : `/auctions/${auction.id}`} className={s.primaryBtnSmall}>{i18n.bidNow}</Link>
                            </article>
                        );
                    })}
                </div>
            </section>

            <section className={s.section}>
                <div className={s.sectionHead}>
                    <div>
                        <h2>{i18n.storesTitle}</h2>
                        <p>{i18n.storesDesc}</p>
                    </div>
                </div>

                <div className={s.storeGrid}>
                    {demoStores.map((store) => (
                        <article key={store.id} className={s.storeCard}>
                            <div className={s.storeBadge}>{store.name[0]}</div>
                            <h3>{store.name}</h3>
                            <p>{store.city} • {store.listings} {isAr ? 'إعلان' : 'listings'}</p>
                            {store.verified ? <span>{i18n.verified}</span> : null}
                        </article>
                    ))}
                </div>
            </section>

            <section className={s.section}>
                <div className={s.featureBand}>
                    <h2>{i18n.advantagesTitle}</h2>
                    <ul>
                        <li>{i18n.adv1}</li>
                        <li>{i18n.adv2}</li>
                        <li>{i18n.adv3}</li>
                        <li>{i18n.adv4}</li>
                    </ul>
                </div>
            </section>

            <section className={s.section}>
                <div className={s.cta}>
                    <div>
                        <h2>{i18n.ctaTitle}</h2>
                        <p>{i18n.ctaDesc}</p>
                    </div>
                    <div className={s.ctaActions}>
                        <Link href="/sso" className={s.primaryBtn}>{i18n.postAd}</Link>
                        <Link href="/listings" className={s.ghostBtnDark}>{i18n.viewAll}</Link>
                    </div>
                </div>
            </section>

            <footer className={s.footer}>
                <div className={s.footerInner}>
                    <div>
                        <strong>Aljwharah.ai</strong>
                        <p>{isAr ? 'منصة تداول الأصول الصناعية في المملكة العربية السعودية' : 'Saudi industrial assets marketplace platform'}</p>
                    </div>
                    <div>
                        <h4>{i18n.legal}</h4>
                        <Link href="/terms">{i18n.terms}</Link>
                        <Link href="/privacy">{i18n.privacy}</Link>
                    </div>
                    <div>
                        <h4>{i18n.support}</h4>
                        <Link href="/support">{i18n.support}</Link>
                        <Link href="/contact">{i18n.contact}</Link>
                    </div>
                </div>
                <div className={s.footerBottom}>© 2026 Aljwharah.ai — {i18n.allRights}</div>
            </footer>

            <Link href="/ai" className={s.floatingAi}>{i18n.aiBtn}</Link>
        </div>
    );
}
