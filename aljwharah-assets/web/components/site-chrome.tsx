import Link from 'next/link';
import { ThemeToggle } from './theme-toggle';

export function SiteHeader() {
    return (
        <>
            <div className="top-contact-bar">
                <div className="top-contact-inner">
                    <a href="mailto:support@aljwharah.ai">support@aljwharah.ai</a>
                    <a href="tel:+966500000000">+966 50 000 0000</a>
                    <Link href="/support">مركز الدعم</Link>
                    <Link href="/pricing">الباقات</Link>
                </div>
            </div>
            <header className="site-header">
                <div className="header-inner">
                    <Link href="/" className="logo-link">
                        <span className="logo-text">Aljwharah.ai</span>
                    </Link>
                    <nav className="main-nav">
                        <Link href="/" className="nav-link">الرئيسية</Link>
                        <Link href="/auctions" className="nav-link">المزادات</Link>
                        <Link href="/listings" className="nav-link">الإعلانات</Link>
                        <Link href="/ai" className="nav-link">التقييم الذكي</Link>
                        <Link href="/support" className="nav-link">الدعم</Link>
                    </nav>
                    <div className="header-tools">
                        <ThemeToggle />
                        <Link href="/pricing" className="nav-link nav-link-pill">الباقات</Link>
                    </div>
                </div>
            </header>
        </>
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
                        <Link href="/support">الأسئلة الشائعة</Link>
                    </div>
                    <div className="footer-col">
                        <h3>السوق</h3>
                        <Link href="/auctions">المزادات</Link>
                        <Link href="/listings">الإعلانات</Link>
                        <Link href="/seller">بع الآن</Link>
                    </div>
                    <div className="footer-col">
                        <h3>القانونية</h3>
                        <Link href="/terms">الشروط</Link>
                        <Link href="/privacy">الخصوصية</Link>
                        <Link href="/refund">الاسترجاع</Link>
                        <Link href="/ip-policy">سياسة الملكية الفكرية</Link>
                        <Link href="/trademark-sale-policy">سياسة بيع العلامات والأسماء</Link>
                    </div>
                    <div className="footer-col">
                        <h3>التواصل</h3>
                        <a href="mailto:support@aljwharah.ai">support@aljwharah.ai</a>
                        <a href="tel:+966500000000">+966 50 000 0000</a>
                        <a href="https://www.linkedin.com" target="_blank" rel="noreferrer">LinkedIn</a>
                        <a href="https://x.com" target="_blank" rel="noreferrer">X</a>
                    </div>
                </div>
                <div className="footer-bottom">
                    <p>© 2026 Aljwharah.ai — جميع الحقوق محفوظة</p>
                </div>
            </div>
        </footer>
    );
}
