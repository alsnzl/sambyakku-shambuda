/** Load public/fonts with Vite BASE_URL so GH Pages + Capacitor both resolve. */
const base = import.meta.env.BASE_URL

const style = document.createElement('style')
style.textContent = `
@font-face {
  font-family: 'Noto Sans Devanagari';
  font-style: normal;
  font-display: swap;
  font-weight: 400 700;
  src: url('${base}fonts/NotoSansDevanagari.ttf') format('truetype');
}
@font-face {
  font-family: 'Noto Sans Siddham';
  font-style: normal;
  font-display: swap;
  font-weight: 400;
  src: url('${base}fonts/NotoSansSiddham-Regular.ttf') format('truetype');
  unicode-range: U+11580-115FF;
}
`
document.head.appendChild(style)
