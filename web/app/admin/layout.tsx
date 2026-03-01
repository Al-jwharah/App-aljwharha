'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
    { href: '/admin', label: 'الإعلانات' },
    { href: '/admin/orders', label: 'الطلبات' },
    { href: '/admin/ads', label: 'الإعلانات المدفوعة' },
    { href: '/admin/auctions', label: 'المزادات' },
    { href: '/admin/support', label: 'الدعم' },
    { href: '/admin/users', label: 'المستخدمون' },
    { href: '/admin/legal', label: 'قانوني/IP' },
    { href: '/admin/audit', label: 'سجل التدقيق' },
    { href: '/admin/revenue', label: 'الإيرادات' },
    { href: '/admin/payouts', label: 'السحوبات' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    return (
        <main className="page-shell">
            <section className="page-section">
                <h1 className="page-title">لوحة العمليات الإدارية</h1>
                <p className="page-subtitle">إدارة السوق والطلبات والمدفوعات والمزادات والإعلانات المدفوعة والدعم من واجهة واحدة.</p>
            </section>

            <nav style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
                {links.map((link) => {
                    const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
                    return (
                        <Link
                            key={link.href}
                            href={link.href}
                            style={{
                                padding: '10px 14px',
                                borderRadius: '10px',
                                border: '1px solid var(--color-border)',
                                background: active ? 'var(--color-primary)' : 'var(--color-surface)',
                                color: active ? '#fff' : 'var(--color-text)',
                                textDecoration: 'none',
                                fontWeight: 600,
                            }}
                        >
                            {link.label}
                        </Link>
                    );
                })}
            </nav>

            {children}
        </main>
    );
}

