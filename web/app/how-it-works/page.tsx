import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'كيف تعمل المنصة | Aljwharah.ai',
    description: 'تعرّف على خطوات البيع والشراء في منصة الجوهرة للأصول الصناعية',
};

export default function HowItWorksPage() {
    return (
        <main className="legal-page">
            <div className="legal-container">
                <h1>كيف تعمل المنصة</h1>
                <p className="legal-updated">دليلك الكامل لاستخدام منصة الجوهرة كمشتري أو بائع</p>

                <section>
                    <h2>خطوات المشتري</h2>
                    <div className="steps-list">
                        <div className="step-item">
                            <span className="step-number">1</span>
                            <div>
                                <strong>تصفّح الأصول</strong>
                                <p>استعرض العلامات التجارية والمصانع والمحلات المعروضة وفلتر حسب النوع والموقع والسعر.</p>
                            </div>
                        </div>
                        <div className="step-item">
                            <span className="step-number">2</span>
                            <div>
                                <strong>قيّم العرض</strong>
                                <p>اطّلع على التفاصيل والمرفقات، واستخدم أداة التقييم الذكي للحصول على تقدير سوقي.</p>
                            </div>
                        </div>
                        <div className="step-item">
                            <span className="step-number">3</span>
                            <div>
                                <strong>قدّم عرضك أو زايد</strong>
                                <p>تواصل مع البائع مباشرة أو شارك في المزاد المباشر للحصول على أفضل سعر.</p>
                            </div>
                        </div>
                        <div className="step-item">
                            <span className="step-number">4</span>
                            <div>
                                <strong>أتمم الصفقة بأمان</strong>
                                <p>ادفع عبر بوابات الدفع الآمنة واحصل على تأكيد فوري بإتمام العملية.</p>
                            </div>
                        </div>
                    </div>
                </section>

                <section>
                    <h2>خطوات البائع</h2>
                    <div className="steps-list">
                        <div className="step-item">
                            <span className="step-number">1</span>
                            <div>
                                <strong>سجّل حسابك</strong>
                                <p>أنشئ حساباً مجانياً وأكمل بيانات ملفك الشخصي والتجاري.</p>
                            </div>
                        </div>
                        <div className="step-item">
                            <span className="step-number">2</span>
                            <div>
                                <strong>أضف إعلانك</strong>
                                <p>أدخل تفاصيل الأصل مع صور واضحة ووصف دقيق وسعر مناسب.</p>
                            </div>
                        </div>
                        <div className="step-item">
                            <span className="step-number">3</span>
                            <div>
                                <strong>انتظر المراجعة</strong>
                                <p>يراجع فريقنا الإعلان للتأكد من استيفاء الشروط ثم يُنشر للمشترين.</p>
                            </div>
                        </div>
                        <div className="step-item">
                            <span className="step-number">4</span>
                            <div>
                                <strong>أتمم البيع</strong>
                                <p>تلقّ العروض أو المزايدات وأتمم الصفقة بأمان عبر المنصة.</p>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="about-cta">
                    <h2>ابدأ الآن</h2>
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '16px' }}>
                        <a href="/trademarks" className="btn-submit">تصفّح الأصول</a>
                        <a href="/seller-guide" className="btn-submit" style={{ background: 'var(--color-accent-strong)' }}>دليل البائع</a>
                    </div>
                </section>
            </div>
        </main>
    );
}
