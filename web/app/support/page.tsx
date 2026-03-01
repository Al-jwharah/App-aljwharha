'use client';

import { useState } from 'react';

const faqs = [
    {
        q: 'ما هي منصة Aljwharah.ai؟',
        a: 'منصة الجوهرة هي سوق إلكتروني متخصص في تداول الأصول الصناعية مثل العلامات التجارية والمصانع والمحلات والمعدات والمواد الخام.',
    },
    {
        q: 'كيف أبدأ البيع على المنصة؟',
        a: 'قم بإنشاء حساب، ثم أضف إعلانك مع وصف دقيق وصور واضحة. بعد مراجعة فريقنا، سيُنشر إعلانك للمشترين المهتمين.',
    },
    {
        q: 'ما هي طرق الدفع المتاحة؟',
        a: 'ندعم Visa وMastercard ومدى وApple Pay وSamsung Pay عبر بوابة Tap الآمنة.',
    },
    {
        q: 'هل المزايدة ملزمة؟',
        a: 'نعم، المزايدة ملزمة قانونياً. عند فوزك بالمزاد، يتوجب عليك إتمام عملية الشراء.',
    },
    {
        q: 'كيف أطلب استرداد؟',
        a: 'يمكنك تقديم طلب استرداد عبر صفحة تواصل معنا مع ذكر رقم الصفقة. راجع سياسة الاسترجاع للتفاصيل الكاملة.',
    },
    {
        q: 'هل بياناتي آمنة؟',
        a: 'نستخدم تشفير SSL/TLS وخوادم Google Cloud المؤمنة. لا نخزن بيانات البطاقات البنكية على خوادمنا.',
    },
    {
        q: 'ما هي عمولة المنصة؟',
        a: 'تختلف العمولة حسب نوع الصفقة ويتم الإفصاح عنها بوضوح قبل إتمام أي عملية.',
    },
    {
        q: 'كيف أتواصل مع الدعم؟',
        a: 'يمكنك التواصل معنا عبر صفحة تواصل معنا أو عبر البريد الإلكتروني support@aljwharah.ai.',
    },
];

export default function SupportPage() {
    const [openIndex, setOpenIndex] = useState<number | null>(null);

    return (
        <main className="legal-page">
            <div className="legal-container">
                <h1>الدعم والأسئلة الشائعة</h1>
                <p style={{ color: 'var(--color-text-muted)', marginBottom: '32px' }}>
                    إجابات سريعة لأكثر الأسئلة شيوعاً حول استخدام المنصة.
                </p>

                <div className="faq-list">
                    {faqs.map((faq, i) => (
                        <div key={i} className={`faq-item ${openIndex === i ? 'faq-open' : ''}`}>
                            <button
                                className="faq-question"
                                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                                aria-expanded={openIndex === i}
                            >
                                <span>{faq.q}</span>
                                <span className="faq-icon">{openIndex === i ? '−' : '+'}</span>
                            </button>
                            {openIndex === i && (
                                <div className="faq-answer">
                                    <p>{faq.a}</p>
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                <div className="support-cta">
                    <h2>لم تجد إجابتك؟</h2>
                    <p>تواصل مع فريق الدعم مباشرة وسنساعدك في أقرب وقت.</p>
                    <a href="/contact" className="btn-submit">تواصل معنا</a>
                </div>
            </div>
        </main>
    );
}
