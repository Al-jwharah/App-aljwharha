import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'العمولات والرسوم | Aljwharah.ai',
    description: 'تعرّف على رسوم الخدمة والعمولات في منصة الجوهرة للأصول الصناعية',
};

export default function PricingPage() {
    return (
        <main className="legal-page">
            <div className="legal-container">
                <h1>العمولات والرسوم</h1>

                <section>
                    <h2>كيف نربح؟</h2>
                    <p>
                        تعمل منصة الجوهرة بنموذج عمولة عند إتمام الصفقة.
                        التسجيل وإضافة الإعلانات مجاني — لا نفرض أي رسوم إلا عند نجاح عملية البيع.
                    </p>
                </section>

                <section>
                    <h2>رسوم الخدمة</h2>
                    <ul>
                        <li><strong>إنشاء حساب:</strong> مجاني بالكامل.</li>
                        <li><strong>إضافة إعلان:</strong> مجاني — بدون رسوم نشر.</li>
                        <li><strong>عمولة الصفقة:</strong> تُخصم نسبة من قيمة الصفقة عند إتمامها بنجاح. تختلف النسبة حسب نوع الأصل وقيمته.</li>
                        <li><strong>المزادات:</strong> رسوم خدمة تُحدد حسب قيمة المزاد ونوع الأصل.</li>
                        <li><strong>خدمات إضافية:</strong> قد تتوفر خدمات تسويقية مميزة برسوم إضافية (اختيارية).</li>
                    </ul>
                </section>

                <section>
                    <h2>ملاحظات عامة</h2>
                    <ul>
                        <li>جميع الرسوم تُعرض بوضوح قبل إتمام أي عملية.</li>
                        <li>لا توجد رسوم خفية أو مفاجئة.</li>
                        <li>تختلف العمولة حسب نوع العرض وقيمته — للتفاصيل الدقيقة <a href="/contact">تواصل معنا</a>.</li>
                        <li>جميع الأسعار بالريال السعودي ما لم يُذكر خلاف ذلك.</li>
                    </ul>
                </section>

                <section className="about-cta">
                    <h2>لديك أسئلة؟</h2>
                    <p>فريقنا جاهز للإجابة على استفساراتكم حول الرسوم والعمولات.</p>
                    <a href="/contact" className="btn-submit" style={{ marginTop: '16px', display: 'inline-block' }}>تواصل معنا</a>
                </section>
            </div>
        </main>
    );
}
