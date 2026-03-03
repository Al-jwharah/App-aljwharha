'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { auth, RecaptchaVerifier, signInWithPhoneNumber } from '../../lib/firebase';
import type { ConfirmationResult } from 'firebase/auth';

type AuthTab = 'login' | 'register';
type AuthMethod = 'phone' | 'email';

export default function AuthPage() {
    const [tab, setTab] = useState<AuthTab>('login');
    const [method, setMethod] = useState<AuthMethod>('phone');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [otpSent, setOtpSent] = useState(false);
    const [otp, setOtp] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [confirmResult, setConfirmResult] = useState<ConfirmationResult | null>(null);
    const recaptchaRef = useRef<HTMLDivElement>(null);
    const verifierRef = useRef<any>(null);

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.aljwharah.ai';

    // Initialize invisible reCAPTCHA
    useEffect(() => {
        if (typeof window !== 'undefined' && !verifierRef.current && recaptchaRef.current) {
            try {
                verifierRef.current = new RecaptchaVerifier(auth, recaptchaRef.current, {
                    size: 'invisible',
                    callback: () => { },
                });
            } catch (e) {
                console.error('reCAPTCHA init error:', e);
            }
        }
    }, []);

    const handlePhoneSubmit = async () => {
        if (!phone.trim()) return;
        setLoading(true);
        setError('');

        let normalized = phone.replace(/\s+/g, '');
        if (normalized.startsWith('0')) normalized = '+966' + normalized.slice(1);
        if (!normalized.startsWith('+')) normalized = '+966' + normalized;

        try {
            if (!verifierRef.current && recaptchaRef.current) {
                verifierRef.current = new RecaptchaVerifier(auth, recaptchaRef.current, {
                    size: 'invisible',
                    callback: () => { },
                });
            }
            const result = await signInWithPhoneNumber(auth, normalized, verifierRef.current);
            setConfirmResult(result);
            setOtpSent(true);
        } catch (err: any) {
            console.error('SMS send error:', err);
            if (err.code === 'auth/too-many-requests') {
                setError('عدد كبير من المحاولات. حاول لاحقاً');
            } else if (err.code === 'auth/invalid-phone-number') {
                setError('رقم الجوال غير صحيح');
            } else {
                setError('فشل إرسال الرسالة: ' + (err.message || 'حاول مرة أخرى'));
            }
            // Reset reCAPTCHA
            try { verifierRef.current = null; } catch { }
        }
        setLoading(false);
    };

    const handleOtpVerify = async () => {
        if (!confirmResult || otp.length < 4) return;
        setLoading(true);
        setError('');

        try {
            const credential = await confirmResult.confirm(otp);
            const firebaseUser = credential.user;
            const idToken = await firebaseUser.getIdToken();

            // Send Firebase token to our backend to create/find user and get our JWT
            const res = await fetch(`${apiUrl}/auth/firebase/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idToken, phone: firebaseUser.phoneNumber }),
            });

            if (res.ok) {
                const data = await res.json();
                if (data.accessToken) localStorage.setItem('aljwharah_token', data.accessToken);
                if (data.refreshToken) localStorage.setItem('aljwharah_refresh', data.refreshToken);
                window.location.href = '/';
            } else {
                setError('فشل تسجيل الدخول. حاول مرة أخرى');
            }
        } catch (err: any) {
            console.error('OTP verify error:', err);
            if (err.code === 'auth/invalid-verification-code') {
                setError('رمز التحقق غير صحيح');
            } else {
                setError('فشل التحقق: ' + (err.message || 'حاول مرة أخرى'));
            }
        }
        setLoading(false);
    };

    const handleEmailSubmit = async () => {
        setLoading(true);
        setError('');
        try {
            const endpoint = tab === 'login' ? '/auth/login' : '/auth/register';
            const body = tab === 'login' ? { email, password } : { email, password, name };
            const res = await fetch(`${apiUrl}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (res.ok) {
                const data = await res.json();
                if (data.accessToken) localStorage.setItem('aljwharah_token', data.accessToken);
                if (data.refreshToken) localStorage.setItem('aljwharah_refresh', data.refreshToken);
                window.location.href = '/';
            } else {
                const data = await res.json().catch(() => ({}));
                setError(data.message || 'فشلت العملية. تأكد من البيانات');
            }
        } catch {
            setError('خطأ في الاتصال بالخادم');
        }
        setLoading(false);
    };

    const handleGoogleLogin = () => {
        window.location.href = `${apiUrl}/auth/google/start`;
    };

    return (
        <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #0a2e23 0%, #0d3629 40%, #143d2f 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', fontFamily: 'var(--font-arabic, Cairo, sans-serif)', direction: 'rtl' }}>

            {/* reCAPTCHA container */}
            <div ref={recaptchaRef} id="recaptcha-container" />

            {/* Logo */}
            <Link href="/" style={{ textDecoration: 'none', marginBottom: 32, textAlign: 'center', display: 'block' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center' }}>
                    <div style={{ width: 52, height: 52, borderRadius: 14, background: 'linear-gradient(135deg, #c6a75e, #d4b96e)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 32px rgba(198,167,94,0.3)' }}>
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                            <rect x="3" y="3" width="7" height="7" rx="1.5" fill="#0d3629" />
                            <rect x="14" y="3" width="7" height="7" rx="1.5" fill="#0d3629" opacity="0.7" />
                            <rect x="3" y="14" width="7" height="7" rx="1.5" fill="#0d3629" opacity="0.7" />
                            <rect x="14" y="14" width="7" height="7" rx="1.5" fill="#0d3629" opacity="0.4" />
                        </svg>
                    </div>
                    <div>
                        <div style={{ fontSize: '2rem', fontWeight: 900, color: '#fff', lineHeight: 1.1 }}>الجوهرة</div>
                        <div style={{ fontSize: '0.7rem', color: '#c6a75e', fontWeight: 700, letterSpacing: '2px', fontFamily: 'Inter, sans-serif' }}>ALJWHARAH.AI</div>
                    </div>
                </div>
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', marginTop: 8 }}>أول منصة سعودية لتداول الأصول الصناعية</p>
            </Link>

            {/* Auth Card */}
            <div style={{ width: '100%', maxWidth: 440, background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(20px)', borderRadius: 24, border: '1px solid rgba(255,255,255,0.08)', padding: '36px 32px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>

                {/* Tabs */}
                <div style={{ display: 'flex', background: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: 4, marginBottom: 28 }}>
                    <button onClick={() => setTab('login')} style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: '0.95rem', fontFamily: 'inherit', transition: 'all 0.2s', background: tab === 'login' ? 'linear-gradient(135deg, #c6a75e, #d4b96e)' : 'transparent', color: tab === 'login' ? '#1a1a1a' : 'rgba(255,255,255,0.5)' }}>
                        تسجيل الدخول
                    </button>
                    <button onClick={() => setTab('register')} style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: '0.95rem', fontFamily: 'inherit', transition: 'all 0.2s', background: tab === 'register' ? 'linear-gradient(135deg, #c6a75e, #d4b96e)' : 'transparent', color: tab === 'register' ? '#1a1a1a' : 'rgba(255,255,255,0.5)' }}>
                        حساب جديد
                    </button>
                </div>

                {/* Error */}
                {error && (
                    <div style={{ background: 'rgba(255,60,60,0.15)', border: '1px solid rgba(255,60,60,0.3)', borderRadius: 12, padding: '10px 14px', marginBottom: 16, color: '#ff6b6b', fontSize: '0.85rem', textAlign: 'center' }}>
                        {error}
                    </div>
                )}

                {/* Google Login */}
                <button onClick={handleGoogleLogin} style={{ width: '100%', padding: '14px', borderRadius: 14, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, transition: 'all 0.2s', marginBottom: 20 }}>
                    <svg width="20" height="20" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" /><path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" /><path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0124 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" /><path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 01-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" /></svg>
                    {tab === 'login' ? 'الدخول بحساب Google' : 'التسجيل بحساب Google'}
                </button>

                {/* Divider */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                    <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
                    <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem' }}>أو</span>
                    <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
                </div>

                {/* Method Toggle */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                    <button onClick={() => { setMethod('phone'); setOtpSent(false); setError(''); }} style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: method === 'phone' ? '2px solid #c6a75e' : '1px solid rgba(255,255,255,0.1)', background: method === 'phone' ? 'rgba(198,167,94,0.1)' : 'transparent', color: method === 'phone' ? '#c6a75e' : 'rgba(255,255,255,0.5)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.85rem' }}>
                        📱 رقم الجوال
                    </button>
                    <button onClick={() => { setMethod('email'); setOtpSent(false); setError(''); }} style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: method === 'email' ? '2px solid #c6a75e' : '1px solid rgba(255,255,255,0.1)', background: method === 'email' ? 'rgba(198,167,94,0.1)' : 'transparent', color: method === 'email' ? '#c6a75e' : 'rgba(255,255,255,0.5)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.85rem' }}>
                        ✉️ البريد الإلكتروني
                    </button>
                </div>

                {/* Phone Auth — Send OTP */}
                {method === 'phone' && !otpSent && (
                    <div>
                        <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.82rem', display: 'block', marginBottom: 6 }}>رقم الجوال (سعودي)</label>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <div style={{ padding: '14px 12px', borderRadius: 12, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#c6a75e', fontWeight: 800, fontFamily: 'Inter, sans-serif', fontSize: '0.9rem', whiteSpace: 'nowrap' }}>+966</div>
                            <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" placeholder="5XXXXXXXX" dir="ltr"
                                style={{ flex: 1, padding: '14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: '1rem', outline: 'none', fontFamily: 'Inter, sans-serif' }} />
                        </div>
                        <button onClick={handlePhoneSubmit} disabled={loading} style={{ width: '100%', padding: '14px', borderRadius: 14, border: 'none', background: 'linear-gradient(135deg, #c6a75e, #d4b96e)', color: '#1a1a1a', fontWeight: 800, fontSize: '1rem', cursor: 'pointer', fontFamily: 'inherit', marginTop: 16, opacity: loading ? 0.6 : 1 }}>
                            {loading ? '⏳ جاري الإرسال...' : 'إرسال رمز التحقق'}
                        </button>
                    </div>
                )}

                {/* Phone Auth — Verify OTP */}
                {method === 'phone' && otpSent && (
                    <div>
                        <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.82rem', display: 'block', marginBottom: 6 }}>رمز التحقق (6 أرقام)</label>
                        <input value={otp} onChange={(e) => setOtp(e.target.value)} type="text" placeholder="000000" dir="ltr" maxLength={6}
                            style={{ width: '100%', padding: '14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: '1.5rem', textAlign: 'center', letterSpacing: '8px', outline: 'none', fontFamily: 'Inter, sans-serif' }} />
                        <button onClick={handleOtpVerify} disabled={loading || otp.length < 4} style={{ width: '100%', padding: '14px', borderRadius: 14, border: 'none', background: 'linear-gradient(135deg, #c6a75e, #d4b96e)', color: '#1a1a1a', fontWeight: 800, fontSize: '1rem', cursor: 'pointer', fontFamily: 'inherit', marginTop: 16, opacity: (loading || otp.length < 4) ? 0.6 : 1 }}>
                            {loading ? '⏳ جاري التحقق...' : 'تأكيد الرمز'}
                        </button>
                        <button onClick={() => { setOtpSent(false); setOtp(''); setError(''); }} style={{ width: '100%', padding: '10px', background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontFamily: 'inherit', marginTop: 8, fontSize: '0.85rem' }}>
                            ← تغيير الرقم
                        </button>
                    </div>
                )}

                {/* Email Auth */}
                {method === 'email' && (
                    <div>
                        {tab === 'register' && (
                            <>
                                <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.82rem', display: 'block', marginBottom: 6 }}>الاسم الكامل</label>
                                <input value={name} onChange={(e) => setName(e.target.value)} type="text" placeholder="محمد أحمد"
                                    style={{ width: '100%', padding: '14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: '1rem', outline: 'none', fontFamily: 'inherit', marginBottom: 14 }} />
                            </>
                        )}
                        <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.82rem', display: 'block', marginBottom: 6 }}>البريد الإلكتروني</label>
                        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="email@example.com" dir="ltr"
                            style={{ width: '100%', padding: '14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: '1rem', outline: 'none', fontFamily: 'Inter, sans-serif', marginBottom: 14 }} />
                        <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.82rem', display: 'block', marginBottom: 6 }}>كلمة المرور</label>
                        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="••••••••" dir="ltr"
                            style={{ width: '100%', padding: '14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: '1rem', outline: 'none', fontFamily: 'Inter, sans-serif' }} />
                        <button onClick={handleEmailSubmit} disabled={loading} style={{ width: '100%', padding: '14px', borderRadius: 14, border: 'none', background: 'linear-gradient(135deg, #c6a75e, #d4b96e)', color: '#1a1a1a', fontWeight: 800, fontSize: '1rem', cursor: 'pointer', fontFamily: 'inherit', marginTop: 16, opacity: loading ? 0.6 : 1 }}>
                            {loading ? '⏳ جاري المعالجة...' : tab === 'login' ? 'تسجيل الدخول' : 'إنشاء حساب جديد'}
                        </button>
                    </div>
                )}
            </div>

            {/* Trust Badges */}
            <div style={{ display: 'flex', gap: 24, justifyContent: 'center', flexWrap: 'wrap', marginTop: 32 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.4)', fontSize: '0.78rem' }}>
                    <span>🔒</span> اتصال مشفّر SSL
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.4)', fontSize: '0.78rem' }}>
                    <span>🛡️</span> حماية البيانات PDPA
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.4)', fontSize: '0.78rem' }}>
                    <span>✅</span> مرخّصة في السعودية
                </div>
            </div>

            {/* Footer */}
            <div style={{ marginTop: 40, textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '0.75rem' }}>
                <p>بالتسجيل، أنت توافق على <Link href="/terms" style={{ color: '#c6a75e' }}>الشروط والأحكام</Link> و<Link href="/privacy" style={{ color: '#c6a75e' }}>سياسة الخصوصية</Link></p>
                <p style={{ marginTop: 8 }}>📞 الدعم: <a href="tel:+966570002169" style={{ color: '#c6a75e' }}>0570002169</a> · <a href="mailto:info@aljwharah.ai" style={{ color: '#c6a75e' }}>info@aljwharah.ai</a></p>
            </div>
        </div>
    );
}
