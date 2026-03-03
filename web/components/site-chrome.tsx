import Link from 'next/link';
import { ThemeToggle } from './theme-toggle';

export function SiteHeader() {
    return (
        <header className="site-header" style={{ background: '#fff', borderBottom: '1px solid #e8ebe9', position: 'sticky', top: 0, zIndex: 100 }}>
            <div className="header-inner" style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px' }}>
                <Link href="/" className="logo-link" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg, #c6a75e, #d4b96e)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                            <rect x="3" y="3" width="7" height="7" rx="1.5" fill="#0d3629" />
                            <rect x="14" y="3" width="7" height="7" rx="1.5" fill="#0d3629" opacity="0.7" />
                            <rect x="3" y="14" width="7" height="7" rx="1.5" fill="#0d3629" opacity="0.7" />
                            <rect x="14" y="14" width="7" height="7" rx="1.5" fill="#0d3629" opacity="0.4" />
                        </svg>
                    </div>
                    <div>
                        <span style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0d3629', display: 'block', lineHeight: 1.1 }}>الجوهرة</span>
                        <span style={{ fontSize: '0.65rem', color: '#c6a75e', fontWeight: 800, letterSpacing: '2px' }}>ALJWHARAH.AI</span>
                    </div>
                </Link>
                <nav className="main-nav" style={{ display: 'flex', gap: 20 }}>
                    <Link href="/" className="nav-link">الرئيسية</Link>
                    <Link href="/auctions" className="nav-link">المزادات</Link>
                    <Link href="/listings?category=trademarks" className="nav-link">العلامات التجارية</Link>
                    <Link href="/listings?category=business-opportunities" className="nav-link">فرص تجارية</Link>
                    <Link href="/factories" className="nav-link">المصانع</Link>
                    <Link href="/stores" className="nav-link">المتاجر</Link>
                </nav>
                <div className="header-tools" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Link href="/sso" className="nav-link" style={{ padding: '8px 18px', borderRadius: 10, border: '1px solid #0d3629', fontWeight: 700, fontSize: '0.85rem' }}>تسجيل الدخول</Link>
                    <Link href="/sso" className="nav-link nav-link-pill" style={{ padding: '8px 18px', borderRadius: 10, background: 'linear-gradient(135deg, #c6a75e, #d4b96e)', color: '#1a1a1a', fontWeight: 800, fontSize: '0.85rem' }}>أضف إعلان</Link>
                </div>
            </div>
        </header>
    );
}

export function SiteFooter() {
    return (
        <footer className="site-footer" id="contact">
            <div className="footer-inner">
                <div className="footer-grid footer-grid-4">
                    <div className="footer-col">
                        <h3>المنصة</h3>
                        <Link href="/about">من نحن</Link>
                        <Link href="/how-it-works">كيف تعمل</Link>
                        <Link href="/pricing">الباقات</Link>
                    </div>
                    <div className="footer-col">
                        <h3>السوق</h3>
                        <Link href="/auctions">المزادات</Link>
                        <Link href="/listings?category=trademarks">العلامات التجارية</Link>
                        <Link href="/listings?category=trade-names">الأسماء التجارية</Link>
                        <Link href="/listings?category=business-opportunities">فرص تجارية</Link>
                        <Link href="/listings?category=equipment">المعدات</Link>
                    </div>
                    <div className="footer-col">
                        <h3>القانونية</h3>
                        <Link href="/terms">الشروط</Link>
                        <Link href="/privacy">الخصوصية</Link>
                        <Link href="/refund">الاسترجاع</Link>
                        <Link href="/ip-policy">سياسة الملكية الفكرية</Link>
                        <Link href="/trademark-sale-policy">سياسة بيع العلامات</Link>
                    </div>
                    <div className="footer-col">
                        <h3>الدعم الفني</h3>
                        <a href="tel:+966570002169">📞 0570002169</a>
                        <a href="mailto:info@aljwharah.ai">📧 info@aljwharah.ai</a>
                        <a href="https://wa.me/966570002169" target="_blank" rel="noreferrer">💬 واتساب</a>
                    </div>
                </div>
                <div className="footer-bottom">
                    <p>© 2026 الجوهرة Aljwharah.ai — جميع الحقوق محفوظة</p>
                </div>
            </div>
        </footer>
    );
}
