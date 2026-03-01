import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'لوحة البائع | Aljwharah.ai',
    description: 'متابعة رصيد البائع وسجل الحركات وطلبات السحب',
};

export default function SellerLayout({ children }: { children: React.ReactNode }) {
    return children;
}