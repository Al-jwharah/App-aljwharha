'use client';

import { usePathname } from 'next/navigation';
import { SiteHeader, SiteFooter } from './site-chrome';

const HIDE_CHROME_PATHS = ['/sso', '/auth'];

export function PathAwareChrome({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const hideChrome = HIDE_CHROME_PATHS.some(p => pathname?.startsWith(p)) || pathname === '/';

    if (hideChrome) {
        return <>{children}</>;
    }

    return (
        <>
            <SiteHeader />
            <div className="page-content">{children}</div>
            <SiteFooter />
        </>
    );
}
