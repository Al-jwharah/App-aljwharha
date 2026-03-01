import type { Metadata } from 'next';
import { IBM_Plex_Sans_Arabic, Inter } from 'next/font/google';
import Link from 'next/link';
import { AppProviders } from '../components/providers';
import { ThemeToggle } from '../components/theme-toggle';
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
    metadataBase: new URL('https://aljwharah.ai'),
    title: {
        default: 'Aljwharah.ai | منصة تداول الأصول الصناعية',
        template: '%s | Aljwharah.ai',
    },
    description: 'Aljwharah.ai منصة عربية احترافية لتداول الأصول الصناعية والتجارية في المملكة العربية السعودية.',
    openGraph: {
        type: 'website',
        locale: 'ar_SA',
        title: 'Aljwharah.ai | منصة تداول الأصول الصناعية',
        description: 'تداول وبيع وشراء الأصول الصناعية مع إدارة مزادات ومدفوعات احترافية.',
        url: 'https://aljwharah.ai',
        siteName: 'Aljwharah.ai',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Aljwharah.ai | منصة تداول الأصول الصناعية',
        description: 'منصة عربية لتداول الأصول الصناعية والتجارية.',
    },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="ar" dir="rtl">
            <body className={`${arabicFont.variable} ${latinFont.variable}`}>
                <AppProviders>
                    <TopContactBar />
                    <Header />
                    <div className="page-content">{children}</div>
                    <Footer />
                </AppProviders>
            </body>
        </html>
    );
}

function TopContactBar() {
    return (
        <div className="top-contact-bar">
            <div className="top-contact-inner">
                <a href="mailto:support@aljwharah.ai">support@aljwharah.ai</a>
                <a href="tel:+966500000000">+966 50 000 0000</a>
                <Link href="/support">مركز الدعم</Link>
                <Link href="/pricing">الباقات</Link>
                <a href="/auth/sso/google/start" target="_blank" rel="noreferrer">دخول Google SSO</a>
            </div>
        </div>
    );
}

function Header() {
    return (
        <header className="site-header">
            <div className="header-inner">
                <Link href="/" className="logo-link">
                    <span className="logo-text">Aljwharah.ai</span>
                </Link>
                <nav className="main-nav">
                    <Link href="/" className="nav-link">الرئيسية</Link>
                    <Link href="/auctions" className="nav-link">المزادات</Link>
                    <Link href="/listings" className="nav-link">الإعلانات</Link>
                    <Link href="/seller" className="nav-link">لوحة البائع</Link>
                    <Link href="/orders" className="nav-link">طلباتي</Link>
                    <Link href="/ai" className="nav-link">الذكاء الاصطناعي</Link>
                    <Link href="/support" className="nav-link">الدعم</Link>
                    <Link href="/admin" className="nav-link">الإدارة</Link>
                    <Link href="/owner" className="nav-link">المالك</Link>
                </nav>
                <div className="header-tools">
                    <ThemeToggle />
                    <Link href="/pricing" className="nav-link nav-link-pill">الباقات</Link>
                </div>
            </div>
        </header>
    );
}

function Footer() {
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