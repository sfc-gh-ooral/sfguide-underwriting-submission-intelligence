// Checks the DESIGN.md color tokens against WCAG AA (4.5:1 text, 3:1 large text / UI).
const L = (hex) => { const c = hex.match(/\w\w/g).map((x) => parseInt(x, 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a, b) => { const [x, y] = [L(a), L(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const mix = (a, b, t) => '#' + a.match(/\w\w/g).map((x, i) => Math.round(parseInt(x, 16) * t + parseInt(b.match(/\w\w/g)[i], 16) * (1 - t)).toString(16).padStart(2, '0')).join('');
const themes = {
  light: { paper: '#F6F2EA', sheet: '#FFFDF8', sheet2: '#EFE9DD', ink: '#0F2A3A', ink2: '#3D5160', ink3: '#56656F', saffronInk: '#8A5A0B', sea: '#1F6F66', amber: '#8F5400', rust: '#A3341F', ai: '#4B3FA0', marine: '#0F2A3A' },
  dark: { paper: '#0E1A21', sheet: '#14242D', sheet2: '#1B2F3A', ink: '#ECE6DA', ink2: '#B5C1C8', ink3: '#8EA0AA', saffronInk: '#F0C374', sea: '#5CC2B4', amber: '#F2B45A', rust: '#F08A73', ai: '#ABA2F2', marine: '#0A151B' },
};
let fail = 0;
for (const [name, t] of Object.entries(themes)) {
  for (const bg of ['paper', 'sheet', 'sheet2']) for (const fg of ['ink', 'ink2', 'ink3', 'saffronInk', 'sea', 'amber', 'rust', 'ai']) {
    const r = ratio(t[fg], t[bg]); if (r < 4.5) { fail++; console.log(`FAIL ${name} ${fg} on ${bg}: ${r.toFixed(2)}`); }
  }
  // Status pills: text on a 12% tint of the same color over the sheet.
  for (const fg of ['sea', 'amber', 'rust', 'ai', 'saffronInk']) { const r = ratio(t[fg], mix(t[fg], t.sheet, 0.12)); if (r < 4.5) { fail++; console.log(`FAIL ${name} pill ${fg}: ${r.toFixed(2)}`); } }
  // Top bar text.
  for (const fg of ['#F6F2EA', '#C9D3D8']) { const r = ratio(fg, t.marine); if (r < 4.5) { fail++; console.log(`FAIL ${name} topbar ${fg}: ${r.toFixed(2)}`); } }
}
// Primary button: paper text on sea (light), ink on sea (dark).
for (const [fg, bg] of [['#FFFDF8', '#1F6F66'], ['#0E1A21', '#5CC2B4'], ['#0F2A3A', '#E0A33A']]) { const r = ratio(fg, bg); if (r < 4.5) { fail++; console.log(`FAIL button ${fg} on ${bg}: ${r.toFixed(2)}`); } }
console.log(fail ? `${fail} pairs below AA` : 'All token pairs meet WCAG AA');
process.exit(fail ? 1 : 0);
