'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { apiFetch, parseApiError } from '../../lib/api';
import { getAccessToken } from '../../lib/auth';
import { UIButton, UICard, UIEmptyState, UIInput, UISelect, UISkeleton, useToast } from '../../components/ui-kit';

type Listing = {
    id: string;
    title: string;
    type: string;
    city?: string;
    price?: number;
    currency?: string;
    category_name_ar?: string;
};

export default function ListingsPage() {
    const { push } = useToast();
    const [items, setItems] = useState<Listing[]>([]);
    const [loading, setLoading] = useState(true);
    const [q, setQ] = useState('');
    const [type, setType] = useState('');
    const [status] = useState('APPROVED');
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);

    const pageSize = 12;

    const queryString = useMemo(() => {
        const params = new URLSearchParams();
        params.set('status', status);
        params.set('page', String(page));
        params.set('limit', String(pageSize));
        if (type) params.set('type', type);
        if (q.trim()) params.set('q', q.trim());
        return params.toString();
    }, [page, pageSize, q, status, type]);

    useEffect(() => {
        let active = true;
        setLoading(true);

        apiFetch<{ data: Listing[]; total: number }>(`/listings?${queryString}`)
            .then((res) => {
                if (!active) return;
                setItems(res.data || []);
                setTotal(res.total || 0);
            })
            .catch((err) => {
                if (!active) return;
                push(parseApiError(err));
            })
            .finally(() => {
                if (active) setLoading(false);
            });

        return () => {
            active = false;
        };
    }, [push, queryString]);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return (
        <main className="page-shell">
            <section className="page-section">
                <h1 className="page-title">الإعلانات المعتمدة</h1>
                <p className="page-subtitle">تصفّح جميع الأصول المتاحة للبيع، مع فلاتر سريعة حسب النوع والمدينة.</p>
            </section>

            <UICard className="page-section">
                <div className="page-grid-3" style={{ alignItems: 'end' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: 6 }}>بحث</label>
                        <UIInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="عنوان، مدينة، وصف" />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: 6 }}>النوع</label>
                        <UISelect value={type} onChange={(e) => setType(e.target.value)}>
                            <option value="">الكل</option>
                            <option value="TRADEMARK">علامة تجارية</option>
                            <option value="FACTORY">مصنع</option>
                            <option value="STORE">متجر</option>
                        </UISelect>
                    </div>
                    <div>
                        <UIButton
                            type="button"
                            onClick={() => setPage(1)}
                            style={{ width: '100%', height: 42 }}
                        >
                            تطبيق الفلاتر
                        </UIButton>
                    </div>
                </div>
            </UICard>

            {loading ? (
                <div className="page-grid-3">
                    {Array.from({ length: 6 }).map((_, idx) => (
                        <UICard key={idx}>
                            <UISkeleton height={20} width="70%" />
                            <div style={{ height: 10 }} />
                            <UISkeleton height={14} width="45%" />
                            <div style={{ height: 14 }} />
                            <UISkeleton height={14} width="35%" />
                        </UICard>
                    ))}
                </div>
            ) : items.length === 0 ? (
                <UIEmptyState title="لا توجد نتائج" description="لم يتم العثور على إعلانات مطابقة للفلاتر الحالية." />
            ) : (
                <>
                    <div className="page-grid-3">
                        {items.map((item) => (
                            <UICard key={item.id}>
                                <h3 style={{ marginBottom: 8 }}>{item.title}</h3>
                                <p style={{ color: 'var(--color-text-muted)', marginBottom: 6 }}>
                                    {item.category_name_ar || item.type}{item.city ? ` · ${item.city}` : ''}
                                </p>
                                <p style={{ fontWeight: 700, fontFamily: 'var(--font-latin)', marginBottom: 10 }}>
                                    {Number(item.price || 0).toLocaleString('en-US')} {item.currency || 'SAR'}
                                </p>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <Link href={`/listings/${item.id}`} style={{ flex: 1 }}>
                                        <UIButton type="button" style={{ width: '100%' }}>عرض التفاصيل</UIButton>
                                    </Link>
                                    <UIButton
                                        type="button"
                                        variant="secondary"
                                        onClick={async () => {
                                            try {
                                                const token = getAccessToken();
                                                if (!token) {
                                                    push('يرجى تسجيل الدخول أولاً لإضافة العنصر إلى السلة');
                                                    return;
                                                }
                                                await apiFetch('/cart/items', {
                                                    method: 'POST',
                                                    body: JSON.stringify({ listingId: item.id }),
                                                }, token);
                                                push('تمت الإضافة إلى السلة');
                                            } catch (err) {
                                                push(parseApiError(err));
                                            }
                                        }}
                                        style={{ flex: 1 }}
                                    >
                                        أضف للسلة
                                    </UIButton>
                                </div>
                            </UICard>
                        ))}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: 18 }}>
                        <UIButton variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>السابق</UIButton>
                        <span>{page} / {totalPages}</span>
                        <UIButton variant="secondary" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>التالي</UIButton>
                    </div>
                </>
            )}
        </main>
    );
}
