'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function AuthCallbackInner() {
    const params = useSearchParams();

    useEffect(() => {
        const token = params.get('token');
        const refresh = params.get('refresh');
        const error = params.get('error');

        if (error) {
            window.location.href = '/sso?error=' + error;
            return;
        }

        if (token) {
            localStorage.setItem('aljwharah_token', token);
            if (refresh) localStorage.setItem('aljwharah_refresh', refresh);
            window.location.href = '/';
        } else {
            window.location.href = '/sso?error=no_token';
        }
    }, [params]);

    return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a2e23', color: '#fff', fontFamily: 'var(--font-arabic, Cairo, sans-serif)', direction: 'rtl' }}>
            <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', marginBottom: 12 }}>⏳</div>
                <p style={{ fontSize: '1.1rem', fontWeight: 700 }}>جاري تسجيل الدخول...</p>
            </div>
        </div>
    );
}

export default function AuthCallbackPage() {
    return (
        <Suspense fallback={<div style={{ minHeight: '100vh', background: '#0a2e23' }} />}>
            <AuthCallbackInner />
        </Suspense>
    );
}
