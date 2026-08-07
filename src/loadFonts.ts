/**
 * Script fonts from /public/fonts (same files used for stroke outlines).
 * Variable Devanagari needs both format hints for iOS Safari.
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
  font-family: 'Muktam Siddham';
  font-style: normal;
  font-display: swap;
  font-weight: 400;
  src: url('${base}fonts/Muktamsiddham.otf') format('opentype');
  unicode-range: U+11580-115FF;
}
`
document.head.appendChild(style)
