export function getAccessToken() {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('accessToken') || localStorage.getItem('aljwharah_token');
}

export function setAccessToken(token: string) {
    if (typeof window === 'undefined') return;
    localStorage.setItem('accessToken', token);
    localStorage.setItem('aljwharah_token', token);
}

export function clearAccessToken() {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('accessToken');
    localStorage.removeItem('aljwharah_token');
}
