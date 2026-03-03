# Aljwharah Brand Kit (Professional)

This directory contains the approved visual identity assets for Aljwharah.

## Directory Map

- `logo/`
  - `aljwharah-assets_mark.png`
  - `logo-info.txt`
- `icons/`
  - `brand.svg`
  - `factory.svg`
  - `outline/24/*.svg`
  - `social/24/apple.svg`
- `favicon/`
  - `favicon-64.png`
  - `favicon-128.png`
  - `favicon-256.png`

## Color System

- Primary: `#0F3D2E`
- Gold Accent: `#C6A75E`
- Charcoal: `#1C1C1C`

## Icon Standards

- Size baseline: `24x24`
- Stroke style: outline, consistent line weight
- Coloring: `currentColor` (theme-controlled from CSS)

## Recommended CSS Variables

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

## Usage Rules

- Keep logo aspect ratio fixed.
- Use high-contrast placement for brand mark.
- Do not re-color brand assets outside token palette.
- Prefer SVG assets in product UI.
