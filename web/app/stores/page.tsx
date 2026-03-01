const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface Listing {
    id: string;
    title: string;
    description: string;
    price: number;
    currency: string;
    city: string;
}

async function getListings(type: string) {
    try {
        const res = await fetch(`${API}/listings?type=${type}&status=APPROVED`, {
            cache: 'no-store',
        });
        if (!res.ok) return { data: [], total: 0 };
        return res.json();
    } catch {
        return { data: [], total: 0 };
    }
}

export default async function StoresPage() {
    const { data: listings, total } = await getListings('STORE');

    return (
        <>
            <section className="page-hero">
                <h1>🏪 محلات تجارية</h1>
                <p>تصفح المحلات التجارية المتاحة للبيع والتملك</p>
            </section>

            <section className="section">
                <div className="section-header">
                    <h2 className="section-title">
                        النتائج <span style={{ color: 'var(--color-muted)', fontSize: '1rem' }}>({total})</span>
                    </h2>
                </div>

                {listings.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--color-muted)' }}>
                        <p style={{ fontSize: '2rem', marginBottom: '12px' }}>🏪</p>
                        <p>لا توجد محلات حالياً</p>
                        <p style={{ fontSize: '0.85rem' }}>كن أول من يضيف محلاً!</p>
                    </div>
                ) : (
                    <div className="cards-grid">
                        {listings.map((l: Listing) => (
                            <div key={l.id} className="card">
                                <div className="card-image">🏪</div>
                                <div className="card-body">
                                    <span className="card-type store">محل تجاري</span>
                                    <h3 className="card-title">{l.title}</h3>
                                    <p style={{ color: 'var(--color-muted)', fontSize: '0.9rem' }}>
                                        {l.description?.slice(0, 100)}
                                    </p>
                                    <div className="card-meta">
                                        <span className="card-price">
                                            {l.price ? `${l.price.toLocaleString()} ${l.currency}` : 'اتصل للسعر'}
                                        </span>
                                        <span className="card-location">{l.city || '—'}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </>
    );
}
