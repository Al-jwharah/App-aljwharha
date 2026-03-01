import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'من نحن | Aljwharah.ai',
    description: 'تعرّف على منصة الجوهرة — السوق الرقمي الأول للأصول الصناعية في المملكة العربية السعودية',
};

export default function AboutPage() {
    return (
        <main className="legal-page">
            <div className="legal-container">
                <h1>من نحن</h1>

                <section>
                    <h2>عن منصة الجوهرة</h2>
                    <p>
                        Aljwharah.ai هي منصة رقمية متخصصة في تداول الأصول الصناعية والتجارية في المملكة العربية السعودية.
                        نوفّر بيئة آمنة وشفافة لبيع وشراء العلامات التجارية والمصانع والمحلات والمعدات والمواد الخام.
                    </p>
                </section>

                <section>
                    <h2>رؤيتنا</h2>
                    <p>
                        نسعى لأن نكون المنصة الأولى والأكثر ثقة لتداول الأصول الصناعية في المنطقة،
                        من خلال تقنيات حديثة وتجربة مستخدم استثنائية تُسهّل على البائعين والمشترين إتمام صفقاتهم بكفاءة.
                    </p>
                </section>

                <section>
                    <h2>لماذا الجوهرة؟</h2>
                    <ul>
                        <li><strong>سوق متخصص:</strong> نركّز حصرياً على الأصول الصناعية والتجارية — لا إعلانات عشوائية.</li>
                        <li><strong>تقييم ذكي:</strong> نوفّر أدوات تقييم مبنية على بيانات السوق لمساعدتك في اتخاذ قرارات دقيقة.</li>
                        <li><strong>مزادات مباشرة:</strong> نظام مزادات شفاف يضمن أفضل سعر للبائع والمشتري.</li>
                        <li><strong>دفع آمن:</strong> بوابات دفع معتمدة تدعم جميع وسائل الدفع المحلية والدولية.</li>
                        <li><strong>دعم متواصل:</strong> فريق دعم متخصص يساعدك في كل خطوة.</li>
                    </ul>
                </section>

                <section>
                    <h2>الثقة والأمان</h2>
                    <p>
                        نلتزم بأعلى معايير الأمان والشفافية. جميع الإعلانات تخضع لمراجعة دقيقة قبل النشر،
                        والمعاملات المالية مشفرة بالكامل. نعمل وفق أنظمة المملكة العربية السعودية لضمان حقوق جميع الأطراف.
                    </p>
                </section>

                <section className="about-cta">
                    <h2>ابدأ الآن</h2>
                    <p>تصفّح الأصول المتاحة أو أضف أصلك للبيع.</p>
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '16px' }}>
                        <a href="/trademarks" className="btn-submit">العلامات التجارية</a>
                        <a href="/factories" className="btn-submit" style={{ background: 'var(--color-accent-strong)' }}>المصانع</a>
                        <a href="/stores" className="btn-submit" style={{ background: 'var(--color-text)' }}>المحلات</a>
                    </div>
                </section>
            </div>
        </main>
    );
}
