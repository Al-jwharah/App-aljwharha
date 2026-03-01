'use client';

import { ToastProvider } from './ui-kit';

export function AppProviders({ children }: { children: React.ReactNode }) {
    return <ToastProvider>{children}</ToastProvider>;
}
