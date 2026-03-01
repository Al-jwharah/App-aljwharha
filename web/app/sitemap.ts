import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
    const base = 'https://aljwharah.ai';

    return [
        { url: base, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
        { url: `${base}/trademarks`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
        { url: `${base}/factories`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
        { url: `${base}/stores`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
        { url: `${base}/about`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
        { url: `${base}/how-it-works`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
        { url: `${base}/pricing`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
        { url: `${base}/seller-guide`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
        { url: `${base}/buyer-guide`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
        { url: `${base}/contact`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
        { url: `${base}/support`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
        { url: `${base}/terms`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
        { url: `${base}/privacy`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
        { url: `${base}/refund`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
        { url: `${base}/delivery`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    ];
}
