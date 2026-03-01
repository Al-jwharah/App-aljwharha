import type { Metadata } from 'next';
import { IBM_Plex_Sans_Arabic, Inter } from 'next/font/google';
import Link from 'next/link';
import './globals.css';

const arabicFont = IBM_Plex_Sans_Arabic({
    subsets: ['arabic', 'latin'],
    weight: ['300', '400', '500', '600', '700'],
    variable: '--alj-font-arabic',
});

const latinFont = Inter({
    subsets: ['latin'],
    weight: ['300', '400', '500', '600', '700'],
    variable: '--alj-font-latin',
});

export const metadata: Metadata = {
    title: 'Aljwharah.ai | منصة تداول الأصول الصناعية',
    description: 'منصة الجوهرة — السوق الرقمي الأول لتداول الأصول الصناعية والتجارية في المملكة العربية السعودية',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="ar" dir="rtl">
            <body className={`${arabicFont.variable} ${latinFont.variable}`}>
                <Header />
                <div className="page-content">{children}</div>
                <Footer />
            </body>
        </html>
    );
}

/* ─── Header ─── */
function Header() {
    return (
        <header className="site-header">
            <div className="header-inner">
                <Link href="/" className="logo-link">
                    <span className="logo-text">Aljwharah.ai</span>
                </Link>
                <nav className="main-nav">
                    <Link href="/about" className="nav-link">من نحن</Link>
                    <Link href="/how-it-works" className="nav-link">كيف تعمل</Link>
                    <Link href="/trademarks" className="nav-link">علامات تجارية</Link>
                    <Link href="/factories" className="nav-link">مصانع</Link>
                    <Link href="/stores" className="nav-link">محلات</Link>
                    <Link href="/support" className="nav-link">الدعم</Link>
                    <Link href="/contact" className="nav-link">اتصل بنا</Link>
                </nav>
            </div>
        </header>
    );
}

/* ─── Footer ─── */
function Footer() {
    return (
        <footer className="site-footer">
            <div className="footer-inner">
                <div className="footer-grid">
                    <div className="footer-col">
                        <h3>الشركة</h3>
                        <Link href="/about">من نحن</Link>
                        <Link href="/how-it-works">كيف تعمل المنصة</Link>
                        <Link href="/pricing">العمولات والرسوم</Link>
                    </div>
                    <div className="footer-col">
                        <h3>الدعم</h3>
                        <Link href="/support">الدعم</Link>
                        <Link href="/contact">اتصل بنا</Link>
                        <Link href="/seller-guide">دليل البائع</Link>
                        <Link href="/buyer-guide">دليل المشتري</Link>
                    </div>
                    <div className="footer-col">
                        <h3>السياسات</h3>
                        <Link href="/terms">الشروط والأحكام</Link>
                        <Link href="/privacy">سياسة الخصوصية</Link>
                        <Link href="/refund">سياسة الاسترجاع</Link>
                        <Link href="/delivery">سياسة التسليم</Link>
                    </div>
                </div>
                <div className="footer-bottom">
                    <p>&copy; {new Date().getFullYear()} Aljwharah.ai — جميع الحقوق محفوظة</p>
                </div>
            </div>
        </footer>
    );
}
