/**
 * Script fonts from /public/fonts (same files used for stroke outlines).
 * Variable Devanagari needs both format hints for iOS Safari.
 *
 * Muktamsiddham: Siddhaṃ shapes on Devanagari codepoints (not U+11580+).
 * Noto Sans Siddham: Unicode Siddham block (U+11580+).
 */
const base = import.meta.env.BASE_URL

const style = document.createElement('style')
style.textContent = `
@font-face {
  font-family: 'Noto Sans Devanagari';
  font-style: normal;
  font-display: swap;
  font-weight: 100 900;
  src:
    url('${base}fonts/NotoSansDevanagari.ttf') format('truetype-variations'),
    url('${base}fonts/NotoSansDevanagari.ttf') format('truetype');
}
@font-face {
  font-family: 'Tiro Devanagari Sanskrit';
  font-style: normal;
  font-display: swap;
  font-weight: 400;
  src: url('${base}fonts/TiroDevanagariSanskrit-Regular.ttf') format('truetype');
}
@font-face {
  font-family: 'Muktamsiddham';
  font-style: normal;
  font-display: swap;
  font-weight: 400;
  src: url('${base}fonts/Muktamsiddham.otf') format('opentype');
}
@font-face {
  font-family: 'Noto Sans Siddham';
  font-style: normal;
  font-display: swap;
  font-weight: 400;
  src: url('${base}fonts/NotoSansSiddham-Regular.ttf') format('truetype');
}
`
document.head.appendChild(style)
