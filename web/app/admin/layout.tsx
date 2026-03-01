import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'إدارة الإعلانات | Aljwharah.ai',
    description: 'لوحة إدارة الإعلانات المعلّقة — خاص بالمديرين',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    return children;
}
