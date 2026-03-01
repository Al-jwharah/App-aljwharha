import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'الدعم والأسئلة الشائعة | Aljwharah.ai',
    description: 'إجابات سريعة لأكثر الأسئلة شيوعاً حول استخدام منصة الجوهرة للأصول الصناعية',
};

export default function SupportLayout({ children }: { children: React.ReactNode }) {
    return children;
}
