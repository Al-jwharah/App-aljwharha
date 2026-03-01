import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'سلة المشتريات | Aljwharah.ai',
    description: 'عرض ومراجعة الأصول في سلة المشتريات',
};

export default function CartLayout({ children }: { children: React.ReactNode }) {
    return children;
}
