/* DogCare — ícones e gráficos em SVG puro. */
'use strict';

const ICONS = {
  home: '<path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z"/>',
  bowl: '<path d="M3 11h18a9 9 0 0 1-18 0z"/><path d="M8 7c0-1.5 1-2 1-3M12 7c0-1.5 1-2 1-3M16 7c0-1.5 1-2 1-3"/>',
  health: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/><path d="M9 11h2V9h2v2h2"/>',
  chart: '<path d="M4 19h16"/><path d="M7 15l4-5 3 3 4-6"/>',
  spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  chev: '<path d="M9 6l6 6-6 6"/>',
  back: '<path d="M15 6l-6 6 6 6"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  drop: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
  paw: '<circle cx="7" cy="10" r="1.6"/><circle cx="10.5" cy="6.5" r="1.6"/><circle cx="14.5" cy="6.5" r="1.6"/><circle cx="18" cy="10" r="1.6"/><path d="M12 12c-2.6 0-5 2.6-5 4.8 0 1.4 1 2.2 2.3 2.2 1.2 0 1.6-.6 2.7-.6s1.5.6 2.7.6c1.3 0 2.3-.8 2.3-2.2 0-2.2-2.4-4.8-5-4.8z"/>',
  scale: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M9 9.5a4 4 0 0 1 6 0M12 9.5l1.2-1.7"/>',
  alert: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17.5v.01"/>',
  syringe: '<path d="M17 3l4 4M19 5l-9.5 9.5M14 6l4 4M8 12l4 4M10.5 13.5L5 19M3 21l2-2"/>',
  pill: '<rect x="3" y="8.5" width="18" height="7" rx="3.5" transform="rotate(-45 12 12)"/><path d="M9.5 9.5l5 5"/>',
  bug: '<rect x="8" y="7" width="8" height="12" rx="4"/><path d="M12 7v12M8 11H4M8 15H4M16 11h4M16 15h4M9 7l-2-3M15 7l2-3"/>',
  doc: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>',
  steth: '<path d="M6 3v6a4 4 0 0 0 8 0V3"/><path d="M10 13v2a5 5 0 0 0 10 0v-2"/><circle cx="20" cy="11" r="2"/>',
  cam: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  send: '<path d="M4 12l16-8-6 16-2.5-6.5z"/>',
  team: '<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14a5 5 0 0 1 5 5"/>',
  down: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  up: '<path d="M12 20V9M7 14l5-5 5 5M5 4h14"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  cpu: '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>',
  dog: '<path d="M5 9c-1 0-2 1.5-2 4s1 4 2 3.5M19 9c1 0 2 1.5 2 4s-1 4-2 3.5"/><path d="M7 7.5C8 5.5 10 5 12 5s4 .5 5 2.5c.7 1.5 1 3.5 1 5.5 0 4-2.7 6-6 6s-6-2-6-6c0-2 .3-4 1-5.5z"/><path d="M10 11v.01M14 11v.01M11 15h2"/>',
  poop: '<path d="M7 20h10a3 3 0 0 0 0-6 3 3 0 0 0-2-5h-.5A2.5 2.5 0 0 0 12 5c0 1.5-2 2-3 3.5A3 3 0 0 0 7 14a3 3 0 0 0 0 6z"/>',
  note: '<path d="M5 4h14v16H5z"/><path d="M9 9h6M9 13h6M9 17h3"/>',
  star: '<path d="M12 4l2.4 5 5.6.6-4.2 3.8 1.2 5.5L12 16l-5 2.9 1.2-5.5L4 9.6 9.6 9z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.01"/>',
};
const icon = (n, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24">${ICONS[n] || ''}</svg>`;

function ringSvg(pct, color = 'var(--accent)') {
  const r = 54, c = 2 * Math.PI * r, p = clamp(pct, 0, 1.5);
  const over = pct > 1.05;
  return `<svg viewBox="0 0 132 132">
    <circle cx="66" cy="66" r="${r}" fill="none" stroke="var(--surface-2)" stroke-width="11"/>
    <circle cx="66" cy="66" r="${r}" fill="none" stroke="${over ? 'var(--warn)' : color}" stroke-width="11" stroke-linecap="round"
      stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - Math.min(p, 1))}" style="transition:stroke-dashoffset .6s ease"/>
  </svg>`;
}

/* gráfico de linha com faixa-alvo opcional */
function lineChart(points, { band = null, h = 170, unit = '', dec = 1, color = 'var(--accent)' } = {}) {
  const W = 340, H = h, L = 34, R = 10, T = 12, B = 22;
  if (!points.length) return `<div class="empty">Sem dados ainda</div>`;
  const xs = points.map(p => p.t), ys = points.map(p => p.y);
  let x0 = Math.min(...xs), x1 = Math.max(...xs);
  if (x1 - x0 < 7 * DAY) { x0 -= 3 * DAY; x1 += 3 * DAY; }
  let y0 = Math.min(...ys, band ? band[0] : Infinity), y1 = Math.max(...ys, band ? band[1] : -Infinity);
  const padY = Math.max((y1 - y0) * 0.15, 0.5); y0 -= padY; y1 += padY;
  const X = t => L + (t - x0) / (x1 - x0) * (W - L - R);
  const Y = v => T + (1 - (v - y0) / (y1 - y0)) * (H - T - B);
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}">`;
  for (let i = 0; i <= 3; i++) {
    const v = y0 + (y1 - y0) * i / 3, y = Y(v);
    s += `<line x1="${L}" x2="${W - R}" y1="${y}" y2="${y}" stroke="var(--line)" stroke-width="1"/>`;
    s += `<text x="${L - 6}" y="${y + 3}" text-anchor="end">${nf(v, y1 - y0 < 5 ? 1 : 0)}</text>`;
  }
  if (band) s += `<rect x="${L}" y="${Y(band[1])}" width="${W - L - R}" height="${Math.max(0, Y(band[0]) - Y(band[1]))}" fill="var(--good)" opacity=".12" rx="4"/>`;
  const ticks = 4;
  for (let i = 0; i <= ticks; i++) {
    const t = x0 + (x1 - x0) * i / ticks;
    s += `<text x="${X(t)}" y="${H - 6}" text-anchor="${i === 0 ? 'start' : i === ticks ? 'end' : 'middle'}">${fmtShort(t)}</text>`;
  }
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${X(p.t).toFixed(1)},${Y(p.y).toFixed(1)}`).join('');
  const area = path + `L${X(points[points.length - 1].t).toFixed(1)},${H - B}L${X(points[0].t).toFixed(1)},${H - B}Z`;
  s += `<defs><linearGradient id="lg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".18"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>`;
  if (points.length > 1) s += `<path d="${area}" fill="url(#lg)"/><path d="${path}" fill="none" stroke="${color}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>`;
  points.forEach((p, i) => {
    const last = i === points.length - 1;
    s += `<circle cx="${X(p.t)}" cy="${Y(p.y)}" r="${last ? 4.5 : 2.6}" fill="${last ? color : 'var(--surface)'}" stroke="${color}" stroke-width="2"/>`;
  });
  const lp = points[points.length - 1];
  s += `<text x="${Math.min(X(lp.t), W - R - 4)}" y="${Y(lp.y) - 10}" text-anchor="end" style="fill:var(--ink);font-weight:600;font-size:11px">${nf(lp.y, dec)}${unit}</text>`;
  return s + '</svg>';
}

/* barras com linha de meta */
function barChart(values, labels, { target = null, h = 150, color = 'var(--accent)', highlightLast = true } = {}) {
  const W = 340, H = h, L = 6, R = 6, T = 16, B = 22;
  const max = Math.max(...values, target || 0, 1) * 1.12;
  const n = values.length, gap = 8, bw = (W - L - R - gap * (n - 1)) / n;
  const Y = v => T + (1 - v / max) * (H - T - B);
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}">`;
  values.forEach((v, i) => {
    const x = L + i * (bw + gap), y = Y(v), last = highlightLast && i === n - 1;
    const over = target && v > target * 1.1;
    s += `<rect x="${x}" y="${y}" width="${bw}" height="${Math.max(0, H - B - y)}" rx="${Math.min(6, bw / 2)}" fill="${over ? 'var(--warn)' : color}" opacity="${last ? 1 : .55}"/>`;
    s += `<text x="${x + bw / 2}" y="${H - 6}" text-anchor="middle">${labels[i]}</text>`;
    if (v > 0 && n <= 8) s += `<text x="${x + bw / 2}" y="${y - 4}" text-anchor="middle" style="font-size:9px">${nf(v)}</text>`;
  });
  if (target) s += `<line x1="${L}" x2="${W - R}" y1="${Y(target)}" y2="${Y(target)}" stroke="var(--ink)" stroke-dasharray="4 4" stroke-width="1.2" opacity=".5"/>`;
  return s + '</svg>';
}

/* radar 0–5 */
function radarChart(axes, series) {
  const W = 340, H = 290, cx = W / 2, cy = H / 2 + 4, R = 96, n = axes.length;
  const P = (i, v) => { const a = -Math.PI / 2 + i * 2 * Math.PI / n; return [cx + Math.cos(a) * R * v / 5, cy + Math.sin(a) * R * v / 5]; };
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}">`;
  for (let k = 1; k <= 5; k++) {
    s += `<polygon points="${axes.map((_, i) => P(i, k).join(',')).join(' ')}" fill="none" stroke="var(--line)" stroke-width="1"/>`;
  }
  axes.forEach((a, i) => {
    const [x, y] = P(i, 5);
    s += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="var(--line)"/>`;
    const [lx, ly] = P(i, 6.15);
    s += `<text x="${lx}" y="${ly + 3}" text-anchor="${Math.abs(lx - cx) < 8 ? 'middle' : lx > cx ? 'start' : 'end'}" style="font-size:11px;fill:var(--ink-2)">${a[1]}</text>`;
  });
  series.forEach(se => {
    const pts = axes.map((a, i) => P(i, se.values[a[0]] ?? 0).join(',')).join(' ');
    s += `<polygon points="${pts}" fill="${se.color}" fill-opacity="${se.fill}" stroke="${se.color}" stroke-width="${se.width || 2}" stroke-linejoin="round" ${se.dash ? 'stroke-dasharray="4 4"' : ''}/>`;
    if (!se.dash) axes.forEach((a, i) => { const [x, y] = P(i, se.values[a[0]] ?? 0); s += `<circle cx="${x}" cy="${y}" r="3" fill="${se.color}"/>`; });
  });
  return s + '</svg>';
}
