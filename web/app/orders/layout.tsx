import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'طلباتي | Aljwharah.ai',
    description: 'عرض ومتابعة طلباتك على منصة الجوهرة',
};

export default function OrdersLayout({ children }: { children: React.ReactNode }) {
    return children;
}
