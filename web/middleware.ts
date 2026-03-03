import { NextResponse, type NextRequest } from 'next/server';

function buildCsp() {
    return [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.google.com https://www.gstatic.com https://apis.google.com",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com data:",
        "img-src 'self' data: https:",
        "connect-src 'self' https://api.aljwharah.ai https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.googleapis.com https://apis.google.com https://accounts.google.com",
        "frame-src https://www.google.com https://accounts.google.com https://appasd-488822.firebaseapp.com",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self' https://accounts.google.com",
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