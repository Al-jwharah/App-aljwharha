import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'تواصل معنا | Aljwharah.ai',
    description: 'تواصل مع فريق منصة الجوهرة للأصول الصناعية — نسعد بخدمتكم',
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
    return children;
}
