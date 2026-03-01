import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ReportInfringementButton } from '../../../components/report-infringement';

type Listing = {
    id: string;
    title: string;
    description?: string;
    type?: string;
    city?: string;
    price?: string;
    currency?: string;
    status?: string;
    created_at?: string;
    attachments?: Array<{ url: string }>;
};

function getApiBase() {
    return process.env.NEXT_PUBLIC_API_URL || process.env.API_BASE_URL || 'https://api.aljwharah.ai';
}

async function fetchListing(id: string): Promise<Listing | null> {
    try {
        const res = await fetch(`${getApiBase()}/listings/${id}`, {
            next: { revalidate: 300 },
        });
        if (!res.ok) return null;
        return res.json();
    } catch {
        return null;
    }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
    const { id } = await params;
    const listing = await fetchListing(id);

    if (!listing) {
        return {
            title: 'الإعلان غير موجود | Aljwharah.ai',
            description: 'تعذر العثور على الإعلان المطلوب.',
        };
    }

    const title = `${listing.title} | Aljwharah.ai`;
    const description = listing.description || `عرض ${listing.type || 'أصل'} في ${listing.city || 'السعودية'}`;
    const image = listing.attachments?.[0]?.url || 'https://aljwharah.ai/logo-mark.png';

    return {
        title,
        description,
        alternates: {
            canonical: `/listings/${listing.id}`,
        },
        openGraph: {
            title,
            description,
            type: 'website',
            locale: 'ar_SA',
            url: `https://aljwharah.ai/listings/${listing.id}`,
            images: [{ url: image }],
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
            images: [image],
        },
    };
}

export default async function ListingDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const listing = await fetchListing(id);

    if (!listing) {
        notFound();
    }

    const price = Number(listing.price || 0);
    const currency = listing.currency || 'SAR';

    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: listing.title,
        description: listing.description || listing.title,
        sku: listing.id,
        brand: {
            '@type': 'Brand',
            name: 'Aljwharah.ai',
        },
        offers: {
            '@type': 'Offer',
            priceCurrency: currency,
            price,
            availability: listing.status === 'APPROVED' ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
            url: `https://aljwharah.ai/listings/${listing.id}`,
        },
    };

    return (
        <main className="legal-page">
            <div className="legal-container">
                <h1>{listing.title}</h1>
                <p style={{ color: 'var(--color-text-muted)', marginBottom: '16px' }}>
                    {listing.type || 'أصل'}{listing.city ? ` · ${listing.city}` : ''}
                </p>

                <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '16px', marginBottom: '14px' }}>
                    <p style={{ marginBottom: '10px' }}>{listing.description || 'لا يوجد وصف مفصل.'}</p>
                    <p style={{ fontWeight: 700, fontFamily: 'var(--font-latin)' }}>
                        {price.toLocaleString('en-US')} {currency}
                    </p>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}><ReportInfringementButton listingId={listing.id} /></div>

                {listing.attachments?.length ? (
                    <div style={{ display: 'grid', gap: '8px' }}>
                        {listing.attachments.slice(0, 6).map((a, i) => (
                            <a key={i} href={a.url} target="_blank" rel="noreferrer" style={{ color: 'var(--color-accent-strong)' }}>
                                ملف مرفق {i + 1}
                            </a>
                        ))}
                    </div>
                ) : null}

                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
                />
            </div>
        </main>
    );
}
