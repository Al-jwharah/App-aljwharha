import type { Metadata } from 'next';
import { Cairo, Inter } from 'next/font/google';
import { AppProviders } from '../components/providers';
import { SiteHeader, SiteFooter } from '../components/site-chrome';
import './globals.css';

const arabicFont = Cairo({
    subsets: ['arabic', 'latin'],
    weight: ['300', '400', '500', '600', '700', '800', '900'],
    variable: '--alj-font-arabic',
    display: 'swap',
});

const latinFont = Inter({
    subsets: ['latin'],
    weight: ['300', '400', '500', '600', '700', '800', '900'],
    variable: '--alj-font-latin',
    display: 'swap',
});

export const metadata: Metadata = {
    metadataBase: new URL('https://aljwharah.ai'),
    title: {
        default: 'الجوهرة | Aljwharah.ai — منصة تداول الأصول الصناعية والعلامات التجارية',
        template: '%s | الجوهرة Aljwharah.ai',
    },
    description: 'منصة الجوهرة Aljwharah.ai — أول منصة سعودية متخصصة لتداول الأصول الصناعية والعلامات التجارية والأسماء التجارية والمصانع والمعدات. مزادات مباشرة، تقييم ذكي، ومدفوعات آمنة عبر Tap.',
    keywords: ['تداول أصول صناعية', 'بيع علامات تجارية', 'مزادات صناعية', 'منصة الجوهرة', 'aljwharah', 'بيع مصانع', 'شراء معدات صناعية', 'أسماء تجارية للبيع', 'علامات تجارية مسجلة', 'مزاد سعودي', 'منصة تداول سعودية'],
    openGraph: {
        type: 'website',
        locale: 'ar_SA',
        title: 'الجوهرة | Aljwharah.ai — منصة تداول الأصول الصناعية والعلامات التجارية',
        description: 'أول منصة سعودية متخصصة لتداول الأصول الصناعية والعلامات التجارية. مزادات مباشرة، تقييم ذكي AI، ومدفوعات آمنة.',
        url: 'https://aljwharah.ai',
        siteName: 'الجوهرة Aljwharah.ai',
        images: [{ url: 'https://aljwharah.ai/og-image.png', width: 1200, height: 630, alt: 'منصة الجوهرة — تداول الأصول الصناعية' }],
    },
    twitter: {
        card: 'summary_large_image',
        title: 'الجوهرة | Aljwharah.ai — منصة تداول الأصول الصناعية',
        description: 'منصة سعودية متخصصة لتداول الأصول الصناعية والعلامات التجارية.',
    },
    robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
    alternates: { canonical: 'https://aljwharah.ai' },
    verification: { google: 'GOOGLE_SITE_VERIFICATION_TOKEN' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="ar" dir="rtl">
            <head>
                <script type="application/ld+json" dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                        '@context': 'https://schema.org',
                        '@type': 'WebSite',
                        name: 'الجوهرة Aljwharah.ai',
                        url: 'https://aljwharah.ai',
                        description: 'منصة سعودية متخصصة لتداول الأصول الصناعية والعلامات التجارية',
                        potentialAction: {
                            '@type': 'SearchAction',
                            target: 'https://aljwharah.ai/listings?q={search_term_string}',
                            'query-input': 'required name=search_term_string'
                        }
                    })
                }} />
            </head>
            <body className={`${arabicFont.variable} ${latinFont.variable}`}>
                <AppProviders>
                    <SiteHeader />
                    <div className="page-content">{children}</div>
                    <SiteFooter />
                </AppProviders>
            </body>
        </html>
    );
}