export default function SsoPage() {
    const api = process.env.NEXT_PUBLIC_API_URL || 'https://api.aljwharah.ai';

    return (
        <main className="page-shell">
            <section className="page-section">
                <h1 className="page-title">تسجيل الدخول المؤسسي SSO</h1>
                <p className="page-subtitle">Google Workspace وMicrosoft Entra ID مع ربط حساب آمن.</p>
            </section>

            <div className="page-grid-2">
                <a href={`${api}/auth/sso/google/start`} style={{ textDecoration: 'none' }}>
                    <div style={{ border: '1px solid var(--color-border)', borderRadius: 12, padding: 16, background: 'var(--color-surface)' }}>
                        <h3 style={{ marginBottom: 8 }}>Google Workspace</h3>
                        <p>تسجيل دخول عبر OIDC (OpenID Connect)</p>
                    </div>
                </a>
                <a href={`${api}/auth/sso/microsoft/start`} style={{ textDecoration: 'none' }}>
                    <div style={{ border: '1px solid var(--color-border)', borderRadius: 12, padding: 16, background: 'var(--color-surface)' }}>
                        <h3 style={{ marginBottom: 8 }}>Microsoft Entra ID</h3>
                        <p>تسجيل دخول عبر OAuth2/OIDC للمؤسسات</p>
                    </div>
                </a>
            </div>
        </main>
    );
}
