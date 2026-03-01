'use client';

import type { Metadata } from 'next';
import { useState } from 'react';

export default function ContactPage() {
    const [submitted, setSubmitted] = useState(false);
    const [form, setForm] = useState({ name: '', email: '', message: '' });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitted(true);
    };

    return (
        <main className="legal-page">
            <div className="legal-container">
                <h1>تواصل معنا</h1>
                <p style={{ color: 'var(--color-text-muted)', marginBottom: '32px' }}>
                    نسعد بتواصلكم. أرسل لنا رسالتك وسنرد عليك في أقرب وقت.
                </p>

                {submitted ? (
                    <div className="contact-success">
                        <div style={{ fontSize: '3rem', marginBottom: '16px' }}>✅</div>
                        <h2>تم استلام رسالتك</h2>
                        <p>شكراً لتواصلك معنا. سنرد عليك خلال 1-2 يوم عمل.</p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="contact-form">
                        <div className="form-group">
                            <label htmlFor="contact-name">الاسم الكامل</label>
                            <input
                                id="contact-name"
                                type="text"
                                required
                                placeholder="أدخل اسمك الكامل"
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="contact-email">البريد الإلكتروني</label>
                            <input
                                id="contact-email"
                                type="email"
                                required
                                placeholder="example@email.com"
                                dir="ltr"
                                value={form.email}
                                onChange={(e) => setForm({ ...form, email: e.target.value })}
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="contact-message">الرسالة</label>
                            <textarea
                                id="contact-message"
                                rows={6}
                                required
                                placeholder="اكتب رسالتك هنا..."
                                value={form.message}
                                onChange={(e) => setForm({ ...form, message: e.target.value })}
                            />
                        </div>

                        <button type="submit" className="btn-submit">إرسال الرسالة</button>
                    </form>
                )}

                <div className="contact-info">
                    <h2>معلومات التواصل</h2>
                    <div className="contact-info-grid">
                        <div>
                            <strong>البريد الإلكتروني</strong>
                            <p dir="ltr">support@aljwharah.ai</p>
                        </div>
                        <div>
                            <strong>ساعات العمل</strong>
                            <p>الأحد – الخميس، 9:00 ص – 5:00 م (توقيت السعودية)</p>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
