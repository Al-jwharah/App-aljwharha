export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.aljwharah.ai';

export async function apiFetch<T = any>(path: string, init: RequestInit = {}, token?: string | null): Promise<T> {
    const headers = new Headers(init.headers || {});
    headers.set('Accept', 'application/json');
    if (init.body && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
    }
    if (token) {
        headers.set('Authorization', `Bearer ${token}`);
    }

    const response = await fetch(`${API_BASE}${path}`, {
        ...init,
        headers,
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Request failed (${response.status})`);
    }

    if (response.status === 204) return null as T;
    return response.json() as Promise<T>;
}

export function parseApiError(err: unknown) {
    if (err instanceof Error) return err.message;
    return 'حدث خطأ غير متوقع';
}
