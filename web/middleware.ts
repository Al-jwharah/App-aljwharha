import { NextResponse, type NextRequest } from 'next/server';

function buildCsp() {
    return [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com data:",
        "img-src 'self' data: https:",
        "connect-src 'self' https://api.aljwharah.ai",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        'upgrade-insecure-requests',
    ].join('; ');
}

export function middleware(_request: NextRequest) {
    const response = NextResponse.next();
    response.headers.set('Content-Security-Policy', buildCsp());
    return response;
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};