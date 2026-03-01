import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'لوحة التحكم | Aljwharah.ai',
    description: 'إدارة إعلاناتك ومتابعة حالتها على منصة الجوهرة',
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    return children;
}
