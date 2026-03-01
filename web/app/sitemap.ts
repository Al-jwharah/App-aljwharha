import type { MetadataRoute } from 'next';

function getApiBase() {
    return process.env.NEXT_PUBLIC_API_URL || process.env.API_BASE_URL || 'https://api.aljwharah.ai';
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const base = 'https://aljwharah.ai';

    const staticRoutes: MetadataRoute.Sitemap = [
        { url: base, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
        { url: `${base}/listings`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.95 },
        { url: `${base}/auctions`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.95 },
        { url: `${base}/pricing`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.85 },
        { url: `${base}/support`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
        { url: `${base}/seller`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
        { url: `${base}/billing`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
        { url: `${base}/about`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
        { url: `${base}/how-it-works`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
        { url: `${base}/contact`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
        { url: `${base}/terms`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.4 },
        { url: `${base}/privacy`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.4 },
        { url: `${base}/refund`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.4 },
        { url: `${base}/ip-policy`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.4 },
        { url: `${base}/trademark-sale-policy`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.4 },
    ];

    try {
        const [listingsRes, auctionsRes] = await Promise.all([
            fetch(`${getApiBase()}/listings?status=APPROVED&page=1&limit=500`, { next: { revalidate: 600 } }),
            fetch(`${getApiBase()}/auctions?page=1&pageSize=500`, { next: { revalidate: 600 } }),
        ]);

        const listingRoutes: MetadataRoute.Sitemap = [];
        const auctionRoutes: MetadataRoute.Sitemap = [];

        if (listingsRes.ok) {
            const payload = await listingsRes.json();
            const items = Array.isArray(payload?.data) ? payload.data : [];
            listingRoutes.push(...items
                .filter((item: any) => item?.id)
                .map((item: any) => ({
                    url: `${base}/listings/${item.id}`,
                    lastModified: item.updated_at ? new Date(item.updated_at) : new Date(),
                    changeFrequency: 'daily' as const,
                    priority: 0.8,
                })));
        }

        if (auctionsRes.ok) {
            const payload = await auctionsRes.json();
            const items = Array.isArray(payload?.items) ? payload.items : [];
            auctionRoutes.push(...items
                .filter((item: any) => item?.id)
                .map((item: any) => ({
                    url: `${base}/auctions/${item.id}`,
                    lastModified: item.updated_at ? new Date(item.updated_at) : new Date(),
                    changeFrequency: 'hourly' as const,
                    priority: 0.85,
                })));
        }

        return [...staticRoutes, ...listingRoutes, ...auctionRoutes];
    } catch {
        return staticRoutes;
    }
}
