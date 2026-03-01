
'use client';

import Image from 'next/image';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import styles from './enterprise-home.module.css';

type Locale = 'ar' | 'en';
type CartItem = { id: string; title: string; category: string; price: number; quantity: number };

const CART_KEY = 'aljwharah_cart_v1';
const LOCALE_KEY = 'aljwharah_locale_v1';

const reveal = {
  initial: { opacity: 0, y: 14 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.16 },
  transition: { duration: 0.35, ease: [0.2, 1, 0.3, 1] },
} as const;

const i18n = {
  ar: {
    top: { email: 'البريد', phone: 'الهاتف', language: 'اللغة', links: [{ href: '#sell', label: 'ابدأ البيع' }, { href: '#faq', label: 'الأسئلة الشائعة' }, { href: '#contact', label: 'اتصل بنا' }] },
    nav: { home: 'الرئيسية', auctions: 'المزادات', listings: 'الإعلانات', sell: 'بع الآن', ai: 'تقييم الذكاء الاصطناعي', contact: 'التواصل' },
    actions: { search: 'بحث', cart: 'السلة', menu: 'القائمة', close: 'إغلاق', login: 'تسجيل الدخول', signup: 'إنشاء حساب', searchPlaceholder: 'ابحث عن أصل أو فئة أو مدينة' },
    hero: { eyebrow: 'منصة مؤسسية لتداول الأصول الصناعية', title: 'Aljwharah.ai تقود سوق الأصول الصناعية باحترافية', subtitle: 'Enterprise-grade marketplace for verified industrial asset transactions.', explore: 'استكشف السوق', start: 'ابدأ البيع' },
    metrics: [{ value: 1240, suffix: '+', label: 'أصل مدرج' }, { value: 86, suffix: '+', label: 'مزاد نشط' }, { value: 380, suffix: '+', label: 'شركة موثقة' }, { value: 97, suffix: '%', label: 'رضا العملاء' }],
    auctions: { title: 'المزادات المباشرة', subtitle: 'مزادات متميزة بتحديث لحظي.', demo: 'عرض تجريبي', live: 'مباشر', ends: 'ينتهي خلال', highest: 'أعلى مزايدة', bidders: 'المزايدون', bid: 'زايد الآن' },
    listings: { title: 'إعلانات مختارة', subtitle: 'بطاقات غنية بالبيانات لاتخاذ قرار أسرع.', loading: 'جاري تحميل الإعلانات', empty: 'لا توجد نتائج مطابقة.', qty: 'الكمية', add: 'إضافة للسلة', remove: 'إزالة', inCart: 'في السلة' },
    categories: { title: 'فئات السوق', subtitle: 'تغطية متكاملة لكل الأصول الصناعية والتجارية.', cards: [{ icon: 'عت', title: 'علامات تجارية' }, { icon: 'مص', title: 'مصانع' }, { icon: 'مع', title: 'معدات' }, { icon: 'خا', title: 'مواد خام' }, { icon: 'مس', title: 'مستودعات' }, { icon: 'ام', title: 'امتيازات تجارية' }] },
    ai: { title: 'محرك التقييم بالذكاء الاصطناعي', desc: 'تقدير ذكي لقيمة الأصل بناءً على بيانات السوق.', cta: 'ابدأ التقييم' },
    trust: { title: 'طبقة الثقة المؤسسية', cards: [{ title: 'تحقق متقدم للهوية', desc: 'توثيق البائعين والكيانات قبل النشر.' }, { title: 'مدفوعات مؤمنة عبر Tap', desc: 'تكامل دفع آمن عبر شركاء معتمدين.' }, { title: 'شروط تشغيل مؤسسية', desc: 'أطر تشغيل واضحة للالتزامات والعمولات.' }] },
    sell: { title: 'لوحة بيع مؤسسية جاهزة', desc: 'ابدأ عرض الأصل عبر نموذج بيع منظم وخيارات مزاد أو إعلان مباشر.' },
    footer: { platform: 'المنصة', market: 'السوق', legal: 'القانونية', contact: 'التواصل', about: 'عن المنصة', how: 'كيف تعمل', faq: 'الأسئلة الشائعة', auctions: 'المزادات', listings: 'الإعلانات', sell: 'بع الآن', terms: 'الشروط والأحكام', privacy: 'سياسة الخصوصية', rights: '© 2026 Aljwharah.ai — جميع الحقوق محفوظة' },
    cart: { title: 'السلة', subtitle: 'واجهة تجريبية بدون دفع إلكتروني', empty: 'السلة فارغة حالياً.', totalItems: 'إجمالي العناصر', totalAmount: 'الإجمالي التقديري', clear: 'تفريغ السلة', checkout: 'متابعة لاحقاً' },
  },
  en: {
    top: { email: 'Email', phone: 'Phone', language: 'Language', links: [{ href: '#sell', label: 'Start Selling' }, { href: '#faq', label: 'FAQ' }, { href: '#contact', label: 'Contact' }] },
    nav: { home: 'Home', auctions: 'Auctions', listings: 'Listings', sell: 'Sell', ai: 'AI Valuation', contact: 'Contact' },
    actions: { search: 'Search', cart: 'Cart', menu: 'Menu', close: 'Close', login: 'Login', signup: 'Sign up', searchPlaceholder: 'Search by asset, category, or city' },
    hero: { eyebrow: 'Enterprise marketplace for industrial assets', title: 'Aljwharah.ai powers premium industrial transactions', subtitle: 'Buy and sell verified assets through structured listings and live auctions.', explore: 'Explore Market', start: 'Start Selling' },
    metrics: [{ value: 1240, suffix: '+', label: 'Assets listed' }, { value: 86, suffix: '+', label: 'Live auctions' }, { value: 380, suffix: '+', label: 'Verified companies' }, { value: 97, suffix: '%', label: 'Client satisfaction' }],
    auctions: { title: 'Live Auctions', subtitle: 'Premium mock auction cards remain visible.', demo: 'Demo View', live: 'Live', ends: 'Ends in', highest: 'Highest bid', bidders: 'Bidders', bid: 'Place Bid' },
    listings: { title: 'Featured Listings', subtitle: 'Data-rich listing cards for fast decisions.', loading: 'Loading featured listings', empty: 'No listings match your search query.', qty: 'Quantity', add: 'Add to cart', remove: 'Remove', inCart: 'In cart' },
    categories: { title: 'Market Categories', subtitle: 'Complete coverage across industrial and commercial assets.', cards: [{ icon: 'TM', title: 'Trademarks' }, { icon: 'FX', title: 'Factories' }, { icon: 'EQ', title: 'Equipment' }, { icon: 'RM', title: 'Raw Materials' }, { icon: 'WH', title: 'Warehouses' }, { icon: 'FR', title: 'Franchises' }] },
    ai: { title: 'AI Valuation Engine', desc: 'Estimate fair asset value using market depth and comparables.', cta: 'Run AI Valuation' },
    trust: { title: 'Enterprise Trust Layer', cards: [{ title: 'Advanced Verification', desc: 'Seller and entity verification before publishing.' }, { title: 'Secure Payments via Tap', desc: 'Payment flow can be enabled through certified partners.' }, { title: 'Enterprise-grade Terms', desc: 'Structured policies for obligations and dispute handling.' }] },
    sell: { title: 'Enterprise Selling Workflow', desc: 'Launch your asset with a structured selling flow.' },
    footer: { platform: 'Platform', market: 'Market', legal: 'Legal', contact: 'Contact', about: 'About', how: 'How it works', faq: 'FAQ', auctions: 'Auctions', listings: 'Listings', sell: 'Sell', terms: 'Terms', privacy: 'Privacy', rights: '© 2026 Aljwharah.ai — All rights reserved' },
    cart: { title: 'Cart', subtitle: 'UI demo only, no checkout logic', empty: 'Your cart is empty.', totalItems: 'Total items', totalAmount: 'Estimated total', clear: 'Clear cart', checkout: 'Continue later' },
  },
} as const;

const mockListings = [
  { id: 'l1', titleAr: 'مصنع تعبئة مياه بطاقة تشغيل عالية', titleEn: 'High-throughput bottled water factory', categoryAr: 'مصانع', categoryEn: 'Factories', locationAr: 'الرياض', locationEn: 'Riyadh', qtyAr: 'قدرة 24000 عبوة/ساعة', qtyEn: 'Capacity 24,000 units/hour', badgeAr: 'موثق', badgeEn: 'Verified', price: 3800000 },
  { id: 'l2', titleAr: 'علامة تجارية لمنتجات التغليف المتخصصة', titleEn: 'Specialized packaging trademark', categoryAr: 'علامات تجارية', categoryEn: 'Trademarks', locationAr: 'جدة', locationEn: 'Jeddah', qtyAr: '7 فئات مسجلة', qtyEn: '7 registered classes', badgeAr: 'جاهز للنقل', badgeEn: 'Transfer ready', price: 620000 },
  { id: 'l3', titleAr: 'مستودع لوجستي حديث بعقد تشغيلي طويل', titleEn: 'Modern logistics warehouse with long lease', categoryAr: 'مستودعات', categoryEn: 'Warehouses', locationAr: 'الدمام', locationEn: 'Dammam', qtyAr: 'مساحة 5400 م²', qtyEn: 'Area 5,400 sqm', badgeAr: 'دخله قائم', badgeEn: 'Revenue generating', price: 2400000 },
];

const mockAuctions = [
  { id: 'a1', titleAr: 'امتياز مطعم سحابي في 3 مدن', titleEn: 'Cloud kitchen franchise across 3 cities', categoryAr: 'امتيازات تجارية', categoryEn: 'Franchises', locationAr: 'المنطقة الوسطى', locationEn: 'Central Region', highestBid: 410000, bidders: 24, progress: 74, endAt: Date.now() + 4 * 3600000 },
  { id: 'a2', titleAr: 'مصنع بلاستيك طبي مع خطوط جاهزة', titleEn: 'Medical plastics factory with active lines', categoryAr: 'مصانع', categoryEn: 'Factories', locationAr: 'المدينة الصناعية الثانية', locationEn: '2nd Industrial City', highestBid: 5650000, bidders: 11, progress: 61, endAt: Date.now() + 6 * 3600000 },
  { id: 'a3', titleAr: 'محفظة علامات للعناية الشخصية', titleEn: 'Personal care trademark portfolio', categoryAr: 'علامات تجارية', categoryEn: 'Trademarks', locationAr: 'الرياض', locationEn: 'Riyadh', highestBid: 1230000, bidders: 19, progress: 86, endAt: Date.now() + 2 * 3600000 },
];

const navHref = ['#home', '#auctions', '#listings', '#sell', '#ai', '#contact'] as const;

const currency = (v: number, locale: Locale) => new Intl.NumberFormat(locale === 'ar' ? 'ar-SA' : 'en-US', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(v);
const remaining = (endAt: number, locale: Locale) => {
  const diff = Math.max(0, endAt - Date.now());
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  const n = locale === 'ar' ? 'ar-SA' : 'en-US';
  return [h, m, s].map((x) => x.toLocaleString(n, { minimumIntegerDigits: 2, useGrouping: false })).join(':');
};

function MetricCounter({ value, suffix, locale }: { value: number; suffix: string; locale: Locale }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    let frame = 0;
    const start = performance.now();
    const run = (now: number) => {
      const p = Math.min(1, (now - start) / 1200);
      setShown(Math.round(value * (1 - (1 - p) ** 3)));
      if (p < 1) frame = requestAnimationFrame(run);
    };
    frame = requestAnimationFrame(run);
    return () => cancelAnimationFrame(frame);
  }, [value, locale]);
  return <>{shown.toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US')}{suffix}</>;
}

export default function EnterpriseHome() {
  const [locale, setLocale] = useState<Locale>('ar');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [listingsLoading, setListingsLoading] = useState(true);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [timeTick, setTimeTick] = useState(0);

  useEffect(() => {
    const savedLocale = localStorage.getItem(LOCALE_KEY);
    if (savedLocale === 'ar' || savedLocale === 'en') setLocale(savedLocale);
    const storedCart = localStorage.getItem(CART_KEY);
    if (storedCart) {
      try { const parsed = JSON.parse(storedCart) as CartItem[]; if (Array.isArray(parsed)) setCartItems(parsed); } catch {}
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(LOCALE_KEY, locale);
    localStorage.setItem(CART_KEY, JSON.stringify(cartItems));
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
    document.body.style.fontFamily = locale === 'ar' ? 'var(--font-arabic)' : 'var(--font-latin)';
  }, [locale, cartItems]);

  useEffect(() => {
    const timeout = setTimeout(() => setListingsLoading(false), 900);
    return () => clearTimeout(timeout);
  }, [locale]);

  useEffect(() => {
    const id = setInterval(() => setTimeTick((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const t = i18n[locale];
  const navItems = [t.nav.home, t.nav.auctions, t.nav.listings, t.nav.sell, t.nav.ai, t.nav.contact];

  const listings = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const rows = mockListings.filter((l) => (`${l.titleAr} ${l.titleEn} ${l.categoryAr} ${l.categoryEn}`).toLowerCase().includes(q || ''));
    return rows;
  }, [searchQuery]);

  const cartCount = cartItems.reduce((s, i) => s + i.quantity, 0);
  const cartTotal = cartItems.reduce((s, i) => s + i.quantity * i.price, 0);

  const addToCart = (id: string) => {
    const l = mockListings.find((x) => x.id === id);
    if (!l) return;
    const title = locale === 'ar' ? l.titleAr : l.titleEn;
    const category = locale === 'ar' ? l.categoryAr : l.categoryEn;
    setCartItems((prev) => prev.find((x) => x.id === id) ? prev.map((x) => x.id === id ? { ...x, quantity: x.quantity + 1 } : x) : [...prev, { id, title, category, price: l.price, quantity: 1 }]);
  };

  const removeFromCart = (id: string) => setCartItems((prev) => prev.filter((x) => x.id !== id));
  const changeQty = (id: string, d: number) => setCartItems((prev) => prev.map((x) => x.id === id ? { ...x, quantity: Math.max(0, x.quantity + d) } : x).filter((x) => x.quantity > 0));

  return (
    <div className={`${styles.page} ${locale === 'ar' ? styles.rtl : styles.ltr}`}>
      <div className={styles.topBar}>
        <div className={styles.topBarLeft}>
          <a href="mailto:support@aljwharah.ai" className={styles.topBarItem}><span className={styles.topBarLabel}>{t.top.email}</span><span>support@aljwharah.ai</span></a>
          <a href="tel:+966500000000" className={styles.topBarItem}><span className={styles.topBarLabel}>{t.top.phone}</span><span>+966 50 000 0000</span></a>
        </div>
        <div className={styles.topBarRight}>
          {t.top.links.map((l) => <a key={l.href} href={l.href} className={styles.quickLink}>{l.label}</a>)}
          <div className={styles.langGroup}><span className={styles.topBarLabel}>{t.top.language}</span><button type="button" className={`${styles.langBtn} ${locale === 'ar' ? styles.langBtnActive : ''}`} onClick={() => setLocale('ar')}>AR</button><button type="button" className={`${styles.langBtn} ${locale === 'en' ? styles.langBtnActive : ''}`} onClick={() => setLocale('en')}>EN</button></div>
        </div>
      </div>

      <header className={styles.header}><div className={styles.headerInner}><a href="#home" className={styles.logoBlock}><span className={styles.logoBadge}><Image src="/logo-mark.png" alt="Aljwharah.ai logo" width={42} height={42} priority /></span><span className={styles.logoText}>Aljwharah.ai</span></a><nav className={styles.mainNav}>{navItems.map((label, i) => <a key={navHref[i]} href={navHref[i]} className={styles.navLink}>{label}</a>)}</nav><div className={styles.headerActions}><button type="button" className={styles.iconButton} aria-label={t.actions.search} onClick={() => setSearchOpen((v) => !v)}><SearchIcon /></button><button type="button" className={styles.iconButton} aria-label={t.actions.cart} data-testid="cart-toggle" onClick={() => setCartOpen(true)}><CartIcon /><span className={styles.cartBadge}>{cartCount}</span></button><a href="#" className={styles.loginBtn}>{t.actions.login}</a><a href="#" className={styles.signupBtn}>{t.actions.signup}</a></div><div className={styles.mobileActions}><button type="button" className={styles.iconButton} aria-label={t.actions.search} onClick={() => setSearchOpen((v) => !v)}><SearchIcon /></button><button type="button" className={styles.iconButton} aria-label={t.actions.cart} data-testid="cart-toggle" onClick={() => setCartOpen(true)}><CartIcon /><span className={styles.cartBadge}>{cartCount}</span></button><button type="button" className={styles.iconButton} aria-label={t.actions.menu} onClick={() => setMobileMenuOpen(true)}><MenuIcon /></button></div></div></header>

      <AnimatePresence>{searchOpen ? <motion.div className={styles.searchPanel} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}><input className={styles.searchInput} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={t.actions.searchPlaceholder} /><button type="button" className={styles.searchClose} onClick={() => setSearchOpen(false)}>{t.actions.close}</button></motion.div> : null}</AnimatePresence>

      <main>
        <motion.section {...reveal} className={styles.hero} id="home"><div className={styles.heroContent}><p className={styles.eyebrow}>{t.hero.eyebrow}</p><h1 className={styles.heroTitle}>{t.hero.title}</h1><p className={styles.heroSubtitle}>{t.hero.subtitle}</p><div className={styles.heroButtons}><a href="#listings" className={styles.primaryCta}>{t.hero.explore}</a><a href="#sell" className={styles.secondaryCta}>{t.hero.start}</a></div><div className={styles.metricsGrid}>{t.metrics.map((m) => <div key={m.label} className={styles.metricCard}><div className={styles.metricValue}><MetricCounter value={m.value} suffix={m.suffix} locale={locale} /></div><div className={styles.metricLabel}>{m.label}</div></div>)}</div></div></motion.section>

        <motion.section {...reveal} className={styles.section} id="auctions"><div className={styles.sectionHead}><div><h2>{t.auctions.title}</h2><p>{t.auctions.subtitle}</p></div><span className={styles.demoBadge}>{t.auctions.demo}</span></div><div className={styles.auctionsGrid}>{mockAuctions.map((a) => <motion.article key={a.id} className={styles.auctionCard} whileHover={{ y: -4 }} transition={{ duration: 0.2 }}><div className={styles.auctionTopRow}><span className={styles.liveTag}>{t.auctions.live}</span><span className={styles.countdownLabel}>{t.auctions.ends}: {remaining(a.endAt + timeTick * 0, locale)}</span></div><h3>{locale === 'ar' ? a.titleAr : a.titleEn}</h3><p className={styles.auctionMeta}>{locale === 'ar' ? a.categoryAr : a.categoryEn} • {locale === 'ar' ? a.locationAr : a.locationEn}</p><div className={styles.auctionStats}><div><span>{t.auctions.highest}</span><strong>{currency(a.highestBid, locale)}</strong></div><div><span>{t.auctions.bidders}</span><strong>{a.bidders.toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US')}</strong></div></div><div className={styles.progressTrack}><span className={styles.progressFill} style={{ width: `${a.progress}%` }} /></div><button type="button" className={styles.auctionCta}>{t.auctions.bid}</button></motion.article>)}</div></motion.section>

        <motion.section {...reveal} className={styles.section} id="listings"><div className={styles.sectionHead}><div><h2>{t.listings.title}</h2><p>{t.listings.subtitle}</p></div></div>{listingsLoading ? <div className={styles.listingsGrid}>{[1, 2, 3].map((s) => <div key={s} className={styles.listingSkeleton} aria-label={t.listings.loading}><span className={styles.skeletonLineLong} /><span className={styles.skeletonLineMid} /><span className={styles.skeletonLineLong} /><span className={styles.skeletonLineShort} /></div>)}</div> : listings.length === 0 ? <div className={styles.emptyState}>{t.listings.empty}</div> : <div className={styles.listingsGrid}>{listings.map((l) => { const inCart = cartItems.find((x) => x.id === l.id)?.quantity ?? 0; return <article key={l.id} className={styles.listingCard}><div className={styles.listingBadge}>{locale === 'ar' ? l.badgeAr : l.badgeEn}</div><h3>{locale === 'ar' ? l.titleAr : l.titleEn}</h3><p className={styles.listingMeta}>{locale === 'ar' ? l.categoryAr : l.categoryEn} • {locale === 'ar' ? l.locationAr : l.locationEn}</p><div className={styles.listingDataRow}><span>{t.listings.qty}</span><strong>{locale === 'ar' ? l.qtyAr : l.qtyEn}</strong></div><div className={styles.listingPrice}>{currency(l.price, locale)}</div><div className={styles.listingActions}><button type="button" className={styles.addBtn} onClick={() => addToCart(l.id)}>{t.listings.add}</button><button type="button" className={styles.removeBtn} disabled={inCart === 0} onClick={() => removeFromCart(l.id)}>{t.listings.remove}</button></div><div className={styles.inCartLabel}>{t.listings.inCart}: {inCart.toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US')}</div></article>; })}</div>}</motion.section>

        <motion.section {...reveal} className={styles.section} id="categories"><div className={styles.sectionHead}><div><h2>{t.categories.title}</h2><p>{t.categories.subtitle}</p></div></div><div className={styles.categoriesGrid}>{t.categories.cards.map((c) => <article key={c.title} className={styles.categoryCard}><span className={styles.categoryIcon}>{c.icon}</span><h3>{c.title}</h3></article>)}</div></motion.section>
        <motion.section {...reveal} className={styles.aiSection} id="ai"><div className={styles.aiCopy}><h2>{t.ai.title}</h2><p>{t.ai.desc}</p></div><a href="#" className={styles.aiCta}>{t.ai.cta}</a></motion.section>
        <motion.section {...reveal} className={styles.section} id="sell"><div className={styles.sellBanner}><div><h2>{t.sell.title}</h2><p>{t.sell.desc}</p></div><a href="#" className={styles.primaryCta}>{t.hero.start}</a></div></motion.section>
        <motion.section {...reveal} className={styles.section} id="faq"><div className={styles.sectionHead}><div><h2>{t.trust.title}</h2></div></div><div className={styles.trustGrid}>{t.trust.cards.map((x) => <article key={x.title} className={styles.trustCard}><h3>{x.title}</h3><p>{x.desc}</p></article>)}</div></motion.section>
      </main>

      <footer className={styles.footer} id="contact"><div className={styles.footerGrid}><div><h4>{t.footer.platform}</h4><a href="#">{t.footer.about}</a><a href="#">{t.footer.how}</a><a href="#faq">{t.footer.faq}</a></div><div><h4>{t.footer.market}</h4><a href="#auctions">{t.footer.auctions}</a><a href="#listings">{t.footer.listings}</a><a href="#sell">{t.footer.sell}</a></div><div><h4>{t.footer.legal}</h4><a href="/terms">{t.footer.terms}</a><a href="/privacy">{t.footer.privacy}</a></div><div><h4>{t.footer.contact}</h4><a href="mailto:support@aljwharah.ai">support@aljwharah.ai</a><a href="tel:+966500000000">+966 50 000 0000</a><div className={styles.footerSocials}><a href="#">{locale === 'ar' ? 'لينكدإن' : 'LinkedIn'}</a><a href="#">{locale === 'ar' ? 'إكس' : 'X'}</a><a href="#">{locale === 'ar' ? 'يوتيوب' : 'YouTube'}</a></div></div></div><div className={styles.footerBottom}>{t.footer.rights}</div></footer>

      <AnimatePresence>{mobileMenuOpen ? <><motion.button type="button" className={styles.overlay} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobileMenuOpen(false)} aria-label={t.actions.close} /><motion.aside className={`${styles.mobileMenu} ${locale === 'ar' ? styles.mobileMenuRtl : styles.mobileMenuLtr}`} initial={{ x: locale === 'ar' ? '100%' : '-100%' }} animate={{ x: 0 }} exit={{ x: locale === 'ar' ? '100%' : '-100%' }} transition={{ duration: 0.25 }}><div className={styles.mobileMenuHead}><strong>Aljwharah.ai</strong><button type="button" onClick={() => setMobileMenuOpen(false)}>{t.actions.close}</button></div><div className={styles.mobileMenuLinks}>{navItems.map((label, i) => <a key={navHref[i]} href={navHref[i]} onClick={() => setMobileMenuOpen(false)}>{label}</a>)}</div><div className={styles.mobileMenuLang}><button type="button" className={locale === 'ar' ? styles.langBtnActive : ''} onClick={() => setLocale('ar')}>AR</button><button type="button" className={locale === 'en' ? styles.langBtnActive : ''} onClick={() => setLocale('en')}>EN</button></div><div className={styles.mobileMenuAuth}><a href="#">{t.actions.login}</a><a href="#" className={styles.signupBtn}>{t.actions.signup}</a></div></motion.aside></> : null}</AnimatePresence>

      <AnimatePresence>{cartOpen ? <><motion.button type="button" className={styles.overlay} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setCartOpen(false)} aria-label={t.actions.close} /><motion.aside className={`${styles.cartSheet} ${locale === 'ar' ? styles.cartSheetRtl : styles.cartSheetLtr}`} initial={{ x: locale === 'ar' ? '-100%' : '100%' }} animate={{ x: 0 }} exit={{ x: locale === 'ar' ? '-100%' : '100%' }} transition={{ duration: 0.28 }}><div className={styles.cartHead}><div><h3>{t.cart.title}</h3><p>{t.cart.subtitle}</p></div><button type="button" onClick={() => setCartOpen(false)}>{t.actions.close}</button></div>{cartItems.length === 0 ? <p className={styles.cartEmpty}>{t.cart.empty}</p> : <div className={styles.cartItems}>{cartItems.map((item) => <article key={item.id} className={styles.cartItem}><div><h4>{item.title}</h4><p>{item.category}</p><strong>{currency(item.price, locale)}</strong></div><div className={styles.cartQtyControls}><button type="button" onClick={() => changeQty(item.id, -1)}>-</button><span>{item.quantity.toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US')}</span><button type="button" onClick={() => changeQty(item.id, 1)}>+</button></div><button type="button" className={styles.cartRemove} onClick={() => removeFromCart(item.id)}>{t.listings.remove}</button></article>)}</div>}<div className={styles.cartTotals}><div><span>{t.cart.totalItems}</span><strong>{cartCount.toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US')}</strong></div><div><span>{t.cart.totalAmount}</span><strong>{currency(cartTotal, locale)}</strong></div></div><div className={styles.cartFoot}><button type="button" className={styles.removeBtn} onClick={() => setCartItems([])}>{t.cart.clear}</button><button type="button" className={styles.addBtn}>{t.cart.checkout}</button></div></motion.aside></> : null}</AnimatePresence>
    </div>
  );
}

function SearchIcon() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" /><path d="M20 20L16.65 16.65" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>;
}
function CartIcon() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 5H6L8.5 15H17.5L20 8H7.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><circle cx="10" cy="19" r="1.5" fill="currentColor" /><circle cx="17" cy="19" r="1.5" fill="currentColor" /></svg>;
}
function MenuIcon() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><path d="M4 12H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><path d="M4 17H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>;
}
