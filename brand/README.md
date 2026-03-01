# Aljwharah Assets — Brand Kit (مجلد الهوية)

هذا المجلد يحتوي على:
- الشعار (PNG)
- أيقونات SVG (Outline 24px) + أيقونات تسجيل (Google/Apple)
- Favicons
- `tokens.json` (ألوان/خطوط/زوايا/أسلوب الأيقونات)
- تعليمات الاستخدام

---

## 1) الألوان (Tokens)
الملف: `tokens.json`

**Primary:** #0F3D2E  
**Gold:** #C6A75E  
**Charcoal:** #1C1C1C

اقتراح CSS Variables:

```css
:root {
  --aa-primary: #0F3D2E;
  --aa-primary-hover: #0B2E22;
  --aa-gold: #C6A75E;
  --aa-charcoal: #1C1C1C;
  --aa-muted: #6B7280;
  --aa-bg: #FFFFFF;
  --aa-surface: #F7F7F8;
  --aa-border: #E5E7EB;
}
```

---

## 2) الشعار
المجلد: `logo/`

- `aljwharah-assets_primary_darkbg.png` : النسخة الأساسية
- `aljwharah-assets_mark.png` : الرمز/العلامة (للـ favicon و Badge)

---

## 3) الأيقونات (SVG)
المجلد: `icons/outline/24/`

كل الأيقونات:
- **24x24**
- **stroke-width=2**
- تستخدم **currentColor** للتلوين عبر CSS

### أيقونات زر الذكاء
- `ai-sparkles.svg`
- `ai-wand.svg`

### أيقونات تسجيل/دخول
- `login.svg`, `signup.svg`, `user.svg`
- `mail.svg`, `phone.svg`, `lock.svg`, `otp.svg`

### أيقونات السوق
- `brand-tag.svg` (علامة)
- `factory.svg` (مصنع)
- `store.svg` (متجر)
- `auction-gavel.svg` (مزاد)
- `shield-check.svg` (موثق)
- `escrow-lock.svg` (إسكرو)
- `file-check.svg` (مستندات)
- `handshake.svg` (صفقة)

### أيقونات واجهة عامة
- `search.svg`, `filter.svg`, `sort.svg`
- `heart.svg`, `bell.svg`
- `message.svg`, `compare.svg`
- `chart.svg`

---

## 4) أيقونات مزودي تسجيل الدخول
المجلد: `icons/social/24/`
- `google.svg`
- `apple.svg`

---

## 5) مثال استخدام في React
> **ملاحظة:** مثال عام، حسب إعداد مشروعك (Vite/Next) قد تختلف طريقة استيراد SVG.

```jsx
import SparklesUrl from "./icons/outline/24/ai-sparkles.svg";

export default function AiButton() {
  return (
    <button className="btn-primary">
      <img src={SparklesUrl} alt="AI" style={{ width: 18, height: 18 }} />
      زر الذكاء
    </button>
  );
}
```

---

## 6) Favicons
المجلد: `favicon/`
- `favicon.ico`
- `favicon-16.png`, `favicon-32.png`, ... إلخ
