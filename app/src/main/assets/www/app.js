/* DogCare — interface. */
'use strict';

const $ = s => document.querySelector(s);
const DC = window.DC = {};
let nav = { tab: 'hoje', stack: [] };
let F = {};                 // estado do formulário do sheet aberto
let sheetEl = null;
let aiState = { state: 'none', model: '' };
const pendingAi = {};
const photoCache = {};
let lastViewKey = '';
let foodQuery = '';
const WD = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

const photo = id => { if (!id) return ''; if (!(id in photoCache)) photoCache[id] = Native.getPhoto(id) || ''; return photoCache[id]; };
const avatar = (d, cls = '') => {
  const p = d && photo(d.photoId);
  return `<div class="avatar ${cls}" ${p ? `style="background-image:url('${p}')"` : ''}>${p ? '' : esc((d && d.name || '?')[0].toUpperCase())}</div>`;
};
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2400);
}
DC.toast = toast;

/* ---------------- tema ---------------- */
let lastDark = null;
function applyTheme() {
  const m = S.settings.theme;
  const dark = m === 'dark' || (m === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  if (dark === lastDark) return;
  lastDark = dark;
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  Native.setBars(dark, dark ? '#121110' : '#F6F3EE');
}
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { lastDark = null; applyTheme(); });

/* ---------------- render ---------------- */
function render() {
  applyTheme();
  const d = dog();
  const app = $('#app');
  if (!d) { app.innerHTML = welcomeView(); lastViewKey = 'welcome'; return; }
  const sub = nav.stack[nav.stack.length - 1];
  const key = sub ? 'sub:' + sub.v : 'tab:' + nav.tab;
  const prevMain = $('#main');
  const scroll = prevMain && key === lastViewKey ? prevMain.scrollTop : 0;
  const body = sub ? SUB[sub.v](d, sub) : TABS[nav.tab](d);
  app.innerHTML = `${sub ? subHeader(sub) : header(d)}
    <div id="main" class="${key !== lastViewKey ? 'fade' : ''}" ${nav.tab === 'ia' && !sub ? 'style="padding-bottom:170px"' : ''}>${body}</div>
    ${sub ? '' : tabsNav()}
    ${!sub && nav.tab === 'ia' ? composer() : ''}`;
  const m = $('#main'); if (m) m.scrollTop = scroll;
  if (!sub && nav.tab === 'ia' && key !== lastViewKey && m) m.scrollTop = m.scrollHeight;
  lastViewKey = key;
}
const rerender = () => render();

function header(d) {
  const bits = [ageLabel(d.birth), d.breed].filter(Boolean).join(' · ');
  return `<div class="top">
    <button class="who" data-a="dogMenu">${avatar(d)}<div class="grow"><div class="name">${esc(d.name)}</div><div class="sub">${esc(bits || 'Toque para editar o perfil')}</div></div></button>
    <button class="icon-btn" data-a="go" data-v="ajustes">${icon('gear')}</button>
  </div>`;
}
const SUB_TITLES = { ajustes: 'Ajustes', equipe: 'Equipe de cuidado', caes: 'Cães', ia: 'IA local' };
function subHeader(sub) {
  return `<div class="top"><button class="icon-btn" data-a="back">${icon('back')}</button><div class="grow name">${SUB_TITLES[sub.v] || ''}</div></div>`;
}
function tabsNav() {
  const t = [['hoje', 'home', 'Hoje'], ['comida', 'bowl', 'Comida'], ['saude', 'health', 'Saúde'], ['evolucao', 'chart', 'Evolução'], ['ia', 'spark', 'Assistente']];
  return `<nav class="tabs">${t.map(([k, i, l]) => `<button class="${nav.tab === k ? 'on' : ''}" data-a="tab" data-v="${k}">${icon(i)}<span>${l}</span></button>`).join('')}</nav>`;
}

/* ---------------- boas-vindas ---------------- */
function welcomeView() {
  return `<div id="main"><div class="welcome fade">
    <div class="avatar lg" style="background:var(--accent);color:var(--accent-ink)">${icon('dog')}</div>
    <h1>Cuidado diário,<br>sem complicação.</h1>
    <p>Alimentação, saúde, vacinas e evolução do seu cão em um só lugar. Tudo fica no seu celular, sem conta e sem servidor.</p>
    <button class="btn accent" data-a="dogForm">Cadastrar meu cão</button>
    <button class="btn ghost mt" data-a="import">Restaurar um backup</button>
  </div></div>`;
}

/* ================= HOJE ================= */
function entryInfo(e) {
  switch (e.type) {
    case 'meal': { const f = foodById(e.foodId); return { ic: 'bowl', cls: 'accent', t: f ? f.name : (e.name || 'Refeição'), s: `${nf(e.g)} g · ${nf(kcalOf(e))} kcal` }; }
    case 'water': return { ic: 'drop', cls: '', t: 'Água', s: `${nf(e.ml)} ml` };
    case 'walk': return { ic: 'paw', cls: 'good', t: 'Passeio', s: `${nf(e.min)} min · ${e.intensity || 'leve'}` };
    case 'potty': return { ic: 'poop', cls: '', t: [e.pee && 'Xixi', e.poo && 'Cocô'].filter(Boolean).join(' e ') || 'Banheiro', s: e.poo ? `fezes ${e.stool || 'normais'}` : '' };
    case 'weight': return { ic: 'scale', cls: '', t: 'Peso', s: `${nf(e.kg, 1)} kg${e.bcs ? ` · escore ${e.bcs}/9` : ''}` };
    case 'symptom': return { ic: 'alert', cls: 'bad', t: symName(e.sym), s: [['', 'leve', 'moderado', 'forte'][e.level || 2], e.notes].filter(Boolean).join(' · ') };
    case 'dose': { const m = S.care.find(c => c.id === e.medId); return { ic: 'pill', cls: 'good', t: m ? m.name : 'Remédio', s: e.slot ? `dose das ${e.slot}` : 'dose dada' }; }
    case 'note': return { ic: 'note', cls: '', t: 'Anotação', s: e.text };
    default: return { ic: 'note', cls: '', t: e.type, s: '' };
  }
}
function entryRow(e, showDay) {
  const i = entryInfo(e);
  return `<button class="item" data-a="entry" data-v="${e.id}"><div class="ic ${i.cls}">${icon(i.ic, 'sm')}</div>
    <div class="grow"><div class="t">${esc(i.t)}</div><div class="s">${esc(i.s)}</div></div>
    <div class="end tiny muted">${showDay ? relDay(e.t) + ' · ' : ''}${hhmm(e.t)}</div></button>`;
}
function insightList(list) {
  return `<div class="list">${list.map(x => `<div class="insight"><div class="dot ${x.lvl === 'info' ? '' : x.lvl}"></div><p>${esc(x.text)}</p></div>`).join('')}</div>`;
}

const TABS = {};
TABS.hoje = d => {
  const today = dayKey(Date.now());
  const en = energy(d);
  const kcal = kcalOnDay(d, today);
  const mf = mainFood();
  const water = sumOnDay(d, 'water', 'ml', today), wt = waterTarget(d);
  const walk = sumOnDay(d, 'walk', 'min', today), wk = walkTarget(d);
  const w = latestWeight(d);
  const lastW = entriesOf(d.id, 'weight').sort((a, b) => b.t - a.t)[0];
  const hr = new Date().getHours();
  const hello = hr < 5 ? 'Boa noite' : hr < 12 ? 'Bom dia' : hr < 18 ? 'Boa tarde' : 'Boa noite';
  const left = en ? en.mer - kcal : 0;

  let h = `<div class="card"><div class="hero">
      <div class="ring">${ringSvg(en ? kcal / en.mer : 0)}<div class="lbl"><b class="num">${nf(kcal)}</b><span>de ${en ? nf(en.mer) : '–'} kcal</span></div></div>
      <div class="grow">
        <div class="small muted">${hello}</div>
        <div class="strong" style="font-size:17px;line-height:1.3;margin:2px 0 6px">${!en ? 'Registre o peso para calcular a meta' : left > 0 ? `Faltam ${nf(left)} kcal` : `Meta do dia atingida`}</div>
        <div class="small muted">${en && left > 0 && mf ? `≈ ${nf(left / mf.kcal100 * 100)} g de ${esc(mf.name.toLowerCase())}` : en ? `${nf(kcal - en.mer)} kcal acima` : ''}</div>
        <button class="btn sm accent mt" data-a="sheet" data-v="meal">${icon('plus', 'sm')} Refeição</button>
      </div></div></div>`;

  h += `<div class="grid3">
    <button class="stat" data-a="sheet" data-v="water" style="text-align:left"><div class="k">Água</div><div class="v num">${nf(water)}<small>ml</small></div><div class="bar"><i style="width:${wt ? clamp(water / wt * 100, 0, 100) : 0}%;background:#4C8DB5"></i></div></button>
    <button class="stat" data-a="sheet" data-v="walk" style="text-align:left"><div class="k">Passeio</div><div class="v num">${nf(walk)}<small>min</small></div><div class="bar"><i style="width:${clamp(walk / wk * 100, 0, 100)}%;background:var(--good)"></i></div></button>
    <button class="stat" data-a="sheet" data-v="weight" style="text-align:left"><div class="k">Peso</div><div class="v num">${w ? nf(w, 1) : '–'}<small>kg</small></div><div class="tiny muted" style="margin-top:7px">${lastW ? relDay(lastW.t) : 'registrar'}</div></button>
  </div>`;

  h += `<div class="mt"><button class="voice" data-a="voice"><div class="mic">${icon('mic')}</div><div><div class="t1">Registrar por voz</div><div class="t2">"Comeu 120 g de ração e passeou meia hora"</div></div></button></div>`;

  h += `<h2 class="sec">Registrar</h2><div class="chips">
    ${[['meal', 'bowl', 'Refeição'], ['treat', 'star', 'Petisco'], ['water', 'drop', 'Água'], ['walk', 'paw', 'Passeio'], ['potty', 'poop', 'Banheiro'], ['weight', 'scale', 'Peso'], ['symptom', 'alert', 'Sintoma'], ['note', 'note', 'Anotação']]
      .map(([v, i, l]) => `<button class="chip" data-a="sheet" data-v="${v}">${icon(i, 'sm')}${l}</button>`).join('')}
  </div>`;

  const doses = dosesOn(d, Date.now());
  if (doses.length) {
    h += `<h2 class="sec">Remédios de hoje</h2><div class="list">${doses.map(x => `
      <button class="item" data-a="toggleDose" data-v="${x.med.id}|${x.time}">
        <div class="check ${x.done ? 'on' : ''}">${icon('check', 'sm')}</div>
        <div class="grow"><div class="t">${esc(x.med.name)}</div><div class="s">${esc(x.med.dose || '')}</div></div>
        <div class="end num strong">${x.time}</div></button>`).join('')}</div>`;
  }

  const ins = insights(d).slice(0, 4);
  if (ins.length) h += `<h2 class="sec">Atenção</h2>${insightList(ins)}`;

  const due = dueItems(d, 30);
  if (due.length) {
    h += `<h2 class="sec">Próximos cuidados</h2><div class="list">${due.map(x => {
      const cls = x.days < 0 ? 'bad' : x.days <= 7 ? 'warn' : 'good';
      return `<button class="item" data-a="tab" data-v="saude"><div class="ic ${cls}">${icon(x.kind === 'vaccine' ? 'syringe' : 'bug', 'sm')}</div>
        <div class="grow"><div class="t">${esc(x.name)}</div><div class="s">${fmtDate(x.next)}</div></div><span class="pill ${cls}">${x.days < 0 ? 'atrasada' : relDay(x.next)}</span></button>`;
    }).join('')}</div>`;
  }

  const todays = S.entries.filter(e => e.dogId === d.id && dayKey(e.t) === today).sort((a, b) => b.t - a.t);
  h += `<h2 class="sec">Linha do tempo</h2><div class="list">${todays.length ? todays.map(e => entryRow(e)).join('') : '<div class="empty">Nada registrado hoje ainda.</div>'}</div>`;

  const tip = TIPS[Math.floor(Date.now() / DAY) % TIPS.length];
  h += `<h2 class="sec">Dica do dia</h2><div class="card tint"><div class="row" style="align-items:flex-start">${icon('sun')}<div class="grow small" style="color:var(--ink)">${esc(tip)}</div></div></div>`;
  return h;
};

/* ================= COMIDA ================= */
TABS.comida = d => {
  const en = energy(d);
  const mf = mainFood();
  const keys = lastDays(7);
  const vals = keys.map(k => Math.round(kcalOnDay(d, k)));
  const filled = vals.slice(0, 6).filter(v => v > 0);
  const avg = filled.length ? filled.reduce((a, b) => a + b, 0) / filled.length : 0;
  const ts = treatShare(d);
  let h = `<h1 class="page">Alimentação</h1>`;
  h += `<div class="card">
    <div class="row between"><div class="small muted">Meta diária</div><button class="link" data-a="sheet" data-v="factor">Ajustar</button></div>
    <div class="row" style="align-items:baseline;gap:6px;margin:4px 0 2px"><span class="num" style="font-size:40px;font-weight:600;letter-spacing:-.03em">${en ? nf(en.mer) : '–'}</span><span class="muted">kcal/dia</span></div>
    ${en ? `<div class="small muted">${esc(en.label)} · RER ${nf(en.rer)} × ${nf(en.factor, 1)}${en.calcW !== en.weight ? ` · sobre ${nf(en.calcW, 1)} kg` : ''}</div>` : '<div class="small muted">Registre o peso para calcular.</div>'}
    ${en && mf ? `<div class="grid2 mt2">
      <div><div class="tiny muted">${esc(mf.name)}</div><div class="strong num" style="font-size:20px">${nf(en.mer / mf.kcal100 * 100)} g/dia</div></div>
      <div><div class="tiny muted">Em 2 refeições</div><div class="strong num" style="font-size:20px">${nf(en.mer / mf.kcal100 * 50)} g cada</div></div>
    </div>` : ''}
    <div class="tiny muted mt">Estimativa pela fórmula de energia em repouso (70 × peso^0,75) × fator de vida. Ajuste com seu veterinário conforme o escore corporal.</div>
  </div>`;

  h += `<h2 class="sec">Últimos 7 dias</h2><div class="card">
    ${barChart(vals, keys.map(k => WD[new Date(parseDay(k)).getDay()]), { target: en ? en.mer : null })}
    <div class="grid2 mt"><div><div class="tiny muted">Média</div><div class="strong num">${avg ? nf(avg) + ' kcal' : '–'}</div></div>
    <div><div class="tiny muted">Petiscos</div><div class="strong num" style="color:${ts > 0.1 ? 'var(--warn)' : 'inherit'}">${nf(ts * 100)}% <span class="tiny muted">(até 10%)</span></div></div></div>
  </div>`;

  const r = foodQuery ? foodCheck(foodQuery) : null;
  h += `<h2 class="sec">Pode ou não pode?</h2>
    <div class="field" style="margin-bottom:10px"><input id="fq" placeholder="Ex.: uva, cenoura, queijo…" value="${esc(foodQuery)}" data-in="foodq" autocomplete="off"></div>
    <div id="fqr">${r ? foodResult(r) : ''}</div>`;

  h += `<h2 class="sec">Alimentos <button data-a="sheet" data-v="food">Adicionar</button></h2><div class="list">
    ${[...S.foods].sort((a, b) => (b.main - a.main) || a.name.localeCompare(b.name)).map(f => `
      <button class="item" data-a="foodEdit" data-v="${f.id}"><div class="ic ${f.main ? 'accent' : ''}">${icon(f.kind === 'petisco' ? 'star' : 'bowl', 'sm')}</div>
      <div class="grow"><div class="t">${esc(f.name)}</div><div class="s">${(FOOD_KINDS.find(k => k[0] === f.kind) || [0, ''])[1]} · ${nf(f.kcal100)} kcal/100 g${f.unitG ? ` · ${nf(f.unitG)} g/un` : ''}</div></div>
      ${f.main ? '<span class="pill accent">principal</span>' : icon('chev', 'sm')}</button>`).join('')}
  </div>
  <div class="tiny muted" style="padding:0 6px">Na embalagem, procure "energia metabolizável" em kcal/kg e divida por 10 para ter kcal por 100 g.</div>`;
  return h;
};
function foodResult(r) {
  const map = { bad: ['bad', 'Não pode'], warn: ['warn', 'Evite'], good: ['good', 'Pode'], unknown: ['', 'Não sei'] };
  const [cls, lbl] = map[r.lvl];
  return `<div class="alert ${cls || 'warn'}" style="${cls ? '' : 'background:var(--surface-2);color:var(--ink-2)'}">${icon(r.lvl === 'good' ? 'check' : r.lvl === 'unknown' ? 'info' : 'alert')}
    <div class="body"><b>${lbl}: ${esc(r.t)}</b>${esc(r.d)}${r.lvl === 'bad' ? '<br><br>Se ele já comeu, ligue para o veterinário agora, mesmo sem sintomas.' : ''}</div></div>`;
}

/* ================= SAÚDE ================= */
TABS.saude = d => {
  let h = `<h1 class="page">Saúde</h1>`;
  h += `<button class="alert bad" data-a="sheet" data-v="redflags" style="width:100%;text-align:left">${icon('alert')}<div class="body"><b>Sinais de emergência</b>Quando ir ao veterinário na hora</div></button>`;

  const careRows = (kind, defs) => defs.map(def => {
    const rec = lastCare(d.id, kind, def.id);
    const st = careStatus(rec);
    return `<button class="item" data-a="care" data-v="${kind}|${def.id}"><div class="ic ${st.cls}">${icon(kind === 'vaccine' ? 'syringe' : 'bug', 'sm')}</div>
      <div class="grow"><div class="t">${esc(def.name)}</div><div class="s">${rec ? `última ${fmtDate(parseDay(rec.date))}${rec.next ? ` · próxima ${fmtShort(parseDay(rec.next))}` : ''}` : 'toque para registrar'}</div></div>
      <span class="pill ${st.cls}">${st.label}</span></button>`;
  }).join('');
  const others = careOf(d.id, 'vaccine').filter(c => c.type === 'outra');
  h += `<h2 class="sec">Vacinas <button data-a="care" data-v="vaccine|outra">Outra</button></h2><div class="list">${careRows('vaccine', VACCINES)}
    ${others.map(c => `<button class="item" data-a="careRec" data-v="${c.id}"><div class="ic ${careStatus(c).cls}">${icon('syringe', 'sm')}</div><div class="grow"><div class="t">${esc(c.name)}</div><div class="s">${fmtDate(parseDay(c.date))}</div></div><span class="pill ${careStatus(c).cls}">${careStatus(c).label}</span></button>`).join('')}</div>`;
  h += `<div class="tiny muted" style="padding:0 6px 4px">Filhotes seguem um protocolo de doses a cada 3–4 semanas até cerca de 16 semanas. Confirme o calendário com o veterinário.</div>`;
  h += `<h2 class="sec">Antiparasitários</h2><div class="list">${careRows('parasite', PARASITES)}</div>`;

  const meds = careOf(d.id, 'med');
  h += `<h2 class="sec">Remédios <button data-a="sheet" data-v="med">Adicionar</button></h2><div class="list">${meds.length ? meds.map(m => {
    const active = medActiveOn(m, Date.now()) || (m.start && dayKey(Date.now()) < m.start);
    const ended = m.end && dayKey(Date.now()) > m.end;
    return `<button class="item" data-a="medEdit" data-v="${m.id}"><div class="ic ${ended || m.paused ? '' : 'good'}">${icon('pill', 'sm')}</div>
      <div class="grow"><div class="t">${esc(m.name)}</div><div class="s">${esc([m.dose, (m.times || []).join(', '), m.every > 1 ? `a cada ${m.every} dias` : ''].filter(Boolean).join(' · '))}</div></div>
      <span class="pill ${ended || m.paused ? '' : 'good'}">${ended ? 'encerrado' : m.paused ? 'pausado' : active ? 'em uso' : 'agendado'}</span></button>`;
  }).join('') : '<div class="empty">Nenhum remédio cadastrado. Os horários viram lembretes.</div>'}</div>`;

  const sy = entriesOf(d.id, 'symptom').filter(e => Date.now() - e.t < 30 * DAY).sort((a, b) => b.t - a.t);
  h += `<h2 class="sec">Sintomas · 30 dias <button data-a="sheet" data-v="symptom">Registrar</button></h2><div class="list">${sy.length ? sy.map(e => entryRow(e, true)).join('') : '<div class="empty">Nenhum sintoma registrado.</div>'}</div>`;

  const visits = careOf(d.id, 'visit').sort((a, b) => b.date.localeCompare(a.date));
  h += `<h2 class="sec">Consultas e exames <button data-a="sheet" data-v="visit">Adicionar</button></h2><div class="list">${visits.length ? visits.map(v => `
    <button class="item" data-a="visitEdit" data-v="${v.id}"><div class="ic">${icon('steth', 'sm')}</div><div class="grow"><div class="t">${esc(v.reason || 'Consulta')}</div><div class="s">${fmtDate(parseDay(v.date))}${v.vet ? ' · ' + esc(v.vet) : ''}</div></div>${(v.photoIds || []).length ? `<span class="pill">${v.photoIds.length} foto${v.photoIds.length > 1 ? 's' : ''}</span>` : icon('chev', 'sm')}</button>`).join('') : '<div class="empty">Nenhuma consulta registrada.</div>'}</div>`;

  const docs = careOf(d.id, 'doc').sort((a, b) => b.date.localeCompare(a.date));
  h += `<h2 class="sec">Documentos <button data-a="sheet" data-v="doc">Adicionar</button></h2>`;
  h += docs.length ? `<div class="photos">${docs.map(x => `<button class="ph" data-a="docView" data-v="${x.id}" style="background-image:url('${photo(x.photoId)}')"><span>${esc(x.label || fmtShort(parseDay(x.date)))}</span></button>`).join('')}</div>`
    : `<div class="list"><div class="empty">Fotos de receitas, exames e da carteira de vacinação.</div></div>`;
  return h;
};

/* ================= EVOLUÇÃO ================= */
TABS.evolucao = d => {
  let h = `<h1 class="page">Evolução</h1>`;
  const pts = weightSeries(d).filter(p => Date.now() - p.t < 400 * DAY);
  const w = latestWeight(d), wc = weightChange(d, 30);
  const band = d.idealWeight && !isPuppy(d) ? [d.idealWeight * 0.95, d.idealWeight * 1.05] : null;
  h += `<div class="card"><div class="row between"><div><div class="small muted">Peso</div>
      <div class="row" style="align-items:baseline;gap:6px"><span class="num" style="font-size:34px;font-weight:600;letter-spacing:-.03em">${w ? nf(w, 1) : '–'}</span><span class="muted">kg</span>
      ${wc ? `<span class="pill ${Math.abs(wc.pct) >= 5 && !isPuppy(d) ? 'warn' : ''}">${wc.kg >= 0 ? '+' : ''}${nf(wc.kg, 1)} kg em ${wc.days} d</span>` : ''}</div></div>
      <button class="btn sm ghost" data-a="sheet" data-v="weight">${icon('plus', 'sm')} Pesar</button></div>
    <div class="mt">${lineChart(pts, { band, unit: ' kg' })}</div>
    ${band ? `<div class="legend"><span><i style="background:var(--good);opacity:.35"></i>faixa do peso ideal (${nf(d.idealWeight, 1)} kg ± 5%)</span></div>` : `<div class="tiny muted mt">${isPuppy(d) ? 'Em crescimento: o esperado é o peso subir de forma constante.' : 'Defina o peso ideal no perfil para ver a faixa-alvo.'}</div>`}
  </div>`;

  const lastB = entriesOf(d.id, 'weight').filter(e => e.bcs).sort((a, b) => b.t - a.t)[0];
  h += `<div class="card"><div class="row between"><div><div class="small muted">Escore de condição corporal</div>
    <div class="strong" style="font-size:18px">${lastB ? `${lastB.bcs}/9 · ${BCS[lastB.bcs]}` : 'Ainda não avaliado'}</div></div>
    ${lastB ? `<span class="pill ${lastB.bcs >= 4 && lastB.bcs <= 5 ? 'good' : 'warn'}">${relDay(lastB.t)}</span>` : ''}</div>
    <div class="row mt" style="gap:4px">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<div style="flex:1;height:8px;border-radius:4px;background:${lastB && lastB.bcs === n ? 'var(--accent)' : n >= 4 && n <= 5 ? 'var(--good-soft)' : 'var(--surface-2)'}"></div>`).join('')}</div>
    <div class="tiny muted mt">Ideal é 4–5: costelas fáceis de sentir sem apertar e cintura visível de cima. Registre junto com o peso.</div></div>`;

  // radar
  const mine = S.radar.filter(r => r.dogId === d.id).sort((a, b) => b.month.localeCompare(a.month));
  const cur = mine.find(r => r.month === monthKey(Date.now()));
  const prev = mine.find(r => r.month < monthKey(Date.now()));
  const series = [];
  if (prev) series.push({ values: prev.scores, color: 'var(--muted)', fill: 0.06, dash: true, width: 1.5 });
  if (cur) series.push({ values: cur.scores, color: 'var(--accent)', fill: 0.18 });
  h += `<h2 class="sec">Bem-estar mensal <button data-a="sheet" data-v="radar">${cur ? 'Editar' : 'Avaliar'}</button></h2><div class="card">
    ${series.length ? radarChart(RADAR_AXES, series) : `<div class="empty">Avalie de 0 a 5 como ${esc(d.name)} está em energia, apetite, pelagem, mobilidade, digestão, sono e humor. Uma vez por mês basta.</div>`}
    ${series.length ? `<div class="legend" style="justify-content:center">${cur ? `<span><i style="background:var(--accent)"></i>${monthLabel(cur.month)}</span>` : ''}${prev ? `<span><i style="background:var(--muted)"></i>${monthLabel(prev.month)}</span>` : ''}</div>` : ''}
  </div>`;

  // atividade
  const weeks = [];
  for (let i = 7; i >= 0; i--) {
    const end = addDays(startOfDay(Date.now()), -i * 7);
    let s = 0; for (let k = 0; k < 7; k++) s += sumOnDay(d, 'walk', 'min', dayKey(addDays(end, -k)));
    weeks.push({ v: Math.round(s / 7), l: fmtShort(addDays(end, -6)).split(' ')[0] });
  }
  h += `<h2 class="sec">Passeio · média por dia</h2><div class="card">${barChart(weeks.map(x => x.v), weeks.map(x => x.l), { target: walkTarget(d), color: 'var(--good)' })}
    <div class="tiny muted mt">Linha tracejada: referência de ~${walkTarget(d)} min/dia para o porte e a idade. Cada cão é diferente.</div></div>`;

  // marcos
  const sk = S.skills[d.id] || {};
  SKILLS.forEach(g => {
    const done = g.items.reduce((a, it) => a + (sk[it[0]] || 0), 0), max = g.items.length * 5;
    h += `<h2 class="sec">${g.g} <span class="pill">${Math.round(done / max * 100)}%</span></h2><div class="list">${g.items.map(([id, name]) => `
      <div class="item" style="flex-direction:column;align-items:stretch;gap:8px">
        <div class="row between"><div class="t">${name}</div><div class="tiny muted">${LEVELS[sk[id] || 0]}</div></div>
        <div class="levels">${[0, 1, 2, 3, 4, 5].map(n => `<button class="${(sk[id] || 0) >= n && n > 0 ? 'on' : ''}" data-a="skill" data-v="${id}|${n}">${n}</button>`).join('')}</div>
      </div>`).join('')}</div>`;
  });
  return h;
};
const monthLabel = mk => { const [y, m] = mk.split('-').map(Number); return `${MONTHS[m - 1]} ${y}`; };

/* ================= ASSISTENTE ================= */
TABS.ia = d => {
  let h = `<h1 class="page">Assistente</h1>`;
  const st = aiState.state;
  h += `<button class="card flat row" data-a="go" data-v="ia" style="width:100%;text-align:left">
    <div class="item ic ${st === 'ready' ? 'good' : st === 'error' ? 'bad' : ''}" style="padding:0;min-height:0;width:36px">${icon('cpu', 'sm')}</div>
    <div class="grow"><div class="strong">${st === 'ready' ? 'IA local ativa' : st === 'loading' ? 'Carregando IA local…' : st === 'error' ? 'IA local com erro' : 'Modo sem IA'}</div>
    <div class="small muted">${st === 'ready' ? esc(aiState.model) + ' · roda no aparelho' : st === 'error' ? 'Toque para ver detalhes' : 'Respostas a partir dos seus registros. Toque para ativar a IA.'}</div></div>${icon('chev', 'sm')}</button>`;
  const msgs = S.chat.filter(m => m.dogId === d.id).slice(-40);
  if (!msgs.length) {
    h += `<p class="muted small" style="margin:18px 4px 12px">Pergunte sobre alimentação, peso, cuidados ou comportamento de ${esc(d.name)}. O assistente usa os registros do app e nunca substitui o veterinário.</p>
      <div class="suggest">${['Como está a alimentação esta semana?', 'O que vence nos próximos dias?', `${d.name} está no peso certo?`, 'Ideias de atividade para hoje', 'Pode comer manga?']
        .map(q => `<button data-a="ask" data-v="${esc(q)}">${esc(q)}</button>`).join('')}</div>`;
  } else {
    h += `<div class="chat mt2">${msgs.map(m => `<div class="msg ${m.role === 'user' ? 'me' : 'ai'} ${m.think ? 'think' : ''}">${esc(m.text)}</div>`).join('')}</div>
      <div class="center mt"><button class="link small" data-a="clearChat">Limpar conversa</button></div>`;
  }
  return h;
};
function composer() {
  return `<div class="composer"><input id="ask" placeholder="Pergunte algo…" enterkeyhint="send" autocomplete="off"><button data-a="send">${icon('send')}</button></div>`;
}

/* ================= SUBTELAS ================= */
const SUB = {};
SUB.ajustes = d => {
  const set = S.settings;
  let h = `<h2 class="sec">Cães</h2><div class="list">${S.dogs.map(x => `
    <button class="item" data-a="switchDog" data-v="${x.id}">${avatar(x)}<div class="grow"><div class="t">${esc(x.name)}</div><div class="s">${esc(ageLabel(x.birth) || '')}</div></div>
    ${x.id === d.id ? '<span class="pill accent">ativo</span>' : ''}</button>`).join('')}
    <button class="item" data-a="dogForm"><div class="ic">${icon('plus', 'sm')}</div><div class="grow t">Adicionar cão</div></button></div>`;
  h += `<h2 class="sec">Geral</h2><div class="list">
    <button class="item" data-a="dogForm" data-v="${d.id}"><div class="ic">${icon('dog', 'sm')}</div><div class="grow"><div class="t">Perfil de ${esc(d.name)}</div><div class="s">peso ideal, porte, objetivo</div></div>${icon('chev', 'sm')}</button>
    <button class="item" data-a="go" data-v="equipe"><div class="ic">${icon('team', 'sm')}</div><div class="grow"><div class="t">Equipe de cuidado</div><div class="s">veterinário, clínica 24 h, banho e tosa</div></div>${icon('chev', 'sm')}</button>
    <button class="item" data-a="go" data-v="ia"><div class="ic">${icon('cpu', 'sm')}</div><div class="grow"><div class="t">IA local</div><div class="s">${aiState.state === 'ready' ? 'ativa' : 'desativada'}</div></div>${icon('chev', 'sm')}</button>
  </div>`;
  h += `<h2 class="sec">Aparência</h2><div class="seg">${[['auto', 'Automático'], ['light', 'Claro'], ['dark', 'Escuro']].map(([v, l]) => `<button class="${set.theme === v ? 'on' : ''}" data-a="theme" data-v="${v}">${l}</button>`).join('')}</div>`;
  h += `<h2 class="sec">Lembretes</h2><div class="list">
    <button class="item" data-a="toggleNotif"><div class="ic">${icon('bell', 'sm')}</div><div class="grow"><div class="t">Notificações</div><div class="s">vacinas, antiparasitários e remédios</div></div><div class="check ${set.notif ? 'on' : ''}">${icon('check', 'sm')}</div></button>
    <div class="item"><div class="ic">${icon('sun', 'sm')}</div><div class="grow"><div class="t">Horário dos avisos de vencimento</div></div>
      <select data-in="remHour" style="border:0;background:var(--surface-2);border-radius:10px;padding:8px">${Array.from({ length: 15 }, (_, i) => i + 7).map(h => `<option value="${h}" ${set.reminderHour === h ? 'selected' : ''}>${pad(h)}:00</option>`).join('')}</select></div>
  </div>`;
  h += `<h2 class="sec">Backup e sincronização</h2><div class="list">
    <button class="item" data-a="export"><div class="ic">${icon('up', 'sm')}</div><div class="grow"><div class="t">Exportar backup</div><div class="s">arquivo .json com tudo, inclusive fotos</div></div></button>
    <button class="item" data-a="import"><div class="ic">${icon('down', 'sm')}</div><div class="grow"><div class="t">Importar backup</div><div class="s">de outro celular: mesclar ou substituir</div></div></button>
  </div>
  <div class="tiny muted" style="padding:0 6px">Para usar em dois celulares, exporte em um, envie o arquivo (WhatsApp, Drive) e importe no outro com "Mesclar".</div>`;
  h += `<h2 class="sec">Sobre</h2><div class="card flat small">
    <div class="strong">DogCare ${esc(Native.version())}</div>
    <div class="muted mt">Sem conta, sem servidor e sem internet: os dados ficam só neste aparelho. As orientações são gerais e não substituem o veterinário.</div></div>`;
  h += `<div class="mt2"><button class="btn danger" data-a="deleteDog" data-v="${d.id}">Excluir ${esc(d.name)} e todos os registros</button></div>`;
  return h;
};

SUB.equipe = () => {
  let h = `<p class="muted small" style="margin:6px 4px 14px">Contatos de quem cuida junto. Ficam a um toque em emergências.</p>`;
  h += `<div class="list">${S.team.length ? S.team.map(m => `
    <div class="item"><div class="ic ${m.role === 'Clínica 24 h' ? 'bad' : 'accent'}">${icon(m.role === 'Veterinário' || m.role === 'Clínica 24 h' ? 'steth' : 'team', 'sm')}</div>
      <button class="grow" style="text-align:left" data-a="teamEdit" data-v="${m.id}"><div class="t">${esc(m.name)}</div><div class="s">${esc(m.role)}${m.phone ? ' · ' + esc(m.phone) : ''}</div></button>
      ${m.phone ? `<button class="icon-btn" data-a="call" data-v="${esc(m.phone)}">${icon('phone', 'sm')}</button><button class="icon-btn" data-a="wa" data-v="${esc(m.phone)}">${icon('chat', 'sm')}</button>` : ''}
    </div>`).join('') : '<div class="empty">Ninguém cadastrado ainda.</div>'}</div>`;
  h += `<div class="mt"><button class="btn" data-a="teamEdit">Adicionar contato</button></div>`;
  return h;
};

SUB.ia = () => {
  const st = aiState.state;
  let h = `<div class="card"><div class="row">${icon('cpu')}<div class="grow"><div class="strong">${st === 'ready' ? 'Ativa' : st === 'loading' ? 'Carregando…' : st === 'error' ? 'Não foi possível carregar' : 'Desativada'}</div>
    <div class="small muted">${st === 'ready' || st === 'loading' || st === 'error' ? esc(aiState.model) : 'O app funciona normalmente sem IA.'}</div></div></div>
    ${st === 'error' ? `<div class="alert warn mt" style="margin-bottom:0">${icon('alert')}<div class="body small">${esc(aiState.error || 'Erro desconhecido')}<br>Confira se o arquivo é um modelo Gemma para MediaPipe (.task) compatível.</div></div>` : ''}
    <div id="aiprog"></div>
    <div class="btns">${st === 'ready' || st === 'error' ? `<button class="btn ghost" data-a="aiRemove">Remover</button>` : ''}<button class="btn accent" data-a="aiPick">${st === 'ready' ? 'Trocar modelo' : 'Importar modelo'}</button></div></div>`;
  h += `<h2 class="sec">Como ativar</h2><div class="card flat small">
    <p style="margin-top:0">A IA roda inteira no celular, sem internet. Use um modelo Gemma no formato do MediaPipe (arquivo <b>.task</b>), como Gemma 3 1B ou Gemma 3n E2B/E4B.</p>
    <p><b>Opção 1.</b> Toque em "Importar modelo" e escolha o arquivo baixado. O app faz uma cópia; depois você pode apagar o original.</p>
    <p style="margin-bottom:0"><b>Opção 2.</b> Copie o arquivo pelo computador para<br><span class="tiny" style="user-select:text;-webkit-user-select:text;word-break:break-all">${esc(Native.aiModelFolder())}</span><br>e reabra o app: ele detecta sozinho.</p></div>
  <div class="tiny muted" style="padding:0 6px">O assistente usa um resumo dos registros do cão ativo. Ele não dá diagnósticos nem doses e sempre indica o veterinário em caso de dúvida.</div>`;
  return h;
};

/* ================= SHEETS ================= */
function openSheet(html, onMount) {
  closeSheet(true);
  document.body.classList.add('sheet-open');
  const scrim = document.createElement('div'); scrim.className = 'scrim'; scrim.dataset.a = 'closeSheet';
  const sh = document.createElement('div'); sh.className = 'sheet';
  sh.innerHTML = `<div class="grab"></div>${html}`;
  document.body.append(scrim, sh);
  sheetEl = { scrim, sh };
  requestAnimationFrame(() => { scrim.classList.add('show'); sh.classList.add('show'); });
  if (onMount) onMount(sh);
}
function closeSheet(instant) {
  if (!sheetEl) return;
  const { scrim, sh } = sheetEl; sheetEl = null;
  document.body.classList.remove('sheet-open');
  if (instant) { scrim.remove(); sh.remove(); return; }
  scrim.classList.remove('show'); sh.classList.remove('show');
  setTimeout(() => { scrim.remove(); sh.remove(); }, 260);
}
const fld = (label, input, hint) => `<div class="field"><label>${label}</label>${input}${hint ? `<div class="hint">${hint}</div>` : ''}</div>`;
const opts = (name, list, val) => `<div class="opts" data-group="${name}">${list.map(([v, l]) => `<button class="${String(val) === String(v) ? 'on' : ''}" data-a="opt" data-v="${name}|${v}">${l}</button>`).join('')}</div>`;
const val = id => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
const numv = id => { const v = parseFloat(val(id).replace(',', '.')); return isNaN(v) ? null : v; };
const nowLocal = (t = Date.now()) => { const d = new Date(t); return `${dayKey(t)}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const whenField = t => fld('Quando', `<input id="f_when" type="datetime-local" value="${nowLocal(t)}">`);
const whenVal = () => { const v = val('f_when'); const t = v ? new Date(v).getTime() : Date.now(); return isNaN(t) ? Date.now() : t; };
const saveBar = (label = 'Salvar', extra = '') => `<div class="btns">${extra}<button class="btn accent" data-a="saveSheet">${label}</button></div>`;

function addEntry(e) {
  const d = dog();
  S.entries.push(Object.assign({ id: uid(), dogId: d.id, t: Date.now() }, e));
  save();
}

const SHEETS = {};
SHEETS.meal = (pre = {}) => {
  const isTreat = pre.treat;
  const list = [...S.foods].filter(f => isTreat ? f.kind === 'petisco' || f.kind === 'natural' : true).sort((a, b) => (b.main - a.main) || (a.kind === 'petisco') - (b.kind === 'petisco'));
  const f0 = foodById(pre.foodId) || (isTreat ? list.find(f => f.kind === 'petisco') : mainFood()) || list[0];
  F = { save: 'meal', food: f0 && f0.id, editId: pre.id };
  const en = energy(dog());
  return [`<h3>${isTreat ? 'Petisco' : 'Refeição'}</h3><p class="lead">${en ? `Meta de hoje: ${nf(en.mer)} kcal` : ''}</p>
    ${fld('Alimento', `<div class="opts" data-group="food">${list.map(f => `<button class="${f.id === F.food ? 'on' : ''}" data-a="opt" data-v="food|${f.id}">${esc(f.name)}</button>`).join('')}<button data-a="sheet" data-v="food">+ novo</button></div>`)}
    <div class="big-input"><input id="f_g" type="number" inputmode="decimal" value="${pre.g || ''}" placeholder="0" data-in="mealCalc"><span>g</span></div>
    <div class="quick" id="f_quick"></div>
    <div class="center strong" id="f_kcal" style="margin:-6px 0 16px;color:var(--accent)"></div>
    ${whenField(pre.t)}${saveBar()}`, () => mealCalc()];
};
function mealCalc() {
  const f = foodById(F.food); if (!f) return;
  const q = $('#f_quick');
  if (q && q.dataset.food !== f.id) {
    q.dataset.food = f.id;
    const en = energy(dog());
    const opts = f.unitG ? [1, 2, 3, 5].map(n => [n * f.unitG, `${n} un`]) :
      (f.kind === 'seca' && en ? [[Math.round(en.mer / f.kcal100 * 50 / 5) * 5, '½ do dia'], [Math.round(en.mer / f.kcal100 * 100 / 5) * 5, 'dia inteiro']] : []).concat([[50, '50 g'], [100, '100 g']]);
    q.innerHTML = opts.map(([g, l]) => `<button data-a="setG" data-v="${g}">${l}</button>`).join('');
  }
  const g = numv('f_g');
  $('#f_kcal').textContent = g ? `${nf(f.kcal100 * g / 100)} kcal` : '';
}
SHEETS.treat = () => SHEETS.meal({ treat: true });
SHEETS.water = () => { F = { save: 'water' }; const wt = waterTarget(dog()); return [`<h3>Água</h3><p class="lead">${wt ? `Referência: cerca de ${nf(wt)} ml por dia` : ''}</p>
  <div class="big-input"><input id="f_ml" type="number" inputmode="numeric" placeholder="0"><span>ml</span></div>
  <div class="quick">${[100, 250, 500, 1000].map(v => `<button data-a="setV" data-v="f_ml|${v}">${v} ml</button>`).join('')}</div>${whenField()}${saveBar()}`]; };
SHEETS.walk = () => { F = { save: 'walk', intensity: 'leve' }; return [`<h3>Passeio</h3><p class="lead">Referência para ${esc(dog().name)}: ~${walkTarget(dog())} min por dia</p>
  <div class="big-input"><input id="f_min" type="number" inputmode="numeric" placeholder="0"><span>min</span></div>
  <div class="quick">${[15, 30, 45, 60].map(v => `<button data-a="setV" data-v="f_min|${v}">${v} min</button>`).join('')}</div>
  ${fld('Intensidade', opts('intensity', [['leve', 'Leve'], ['moderada', 'Moderada'], ['intensa', 'Intensa']], 'leve'))}${whenField()}${saveBar()}`]; };
SHEETS.potty = () => { F = { save: 'potty', pee: 'sim', poo: 'nao', stool: 'normal' }; return [`<h3>Banheiro</h3><p class="lead">Mudanças no xixi ou nas fezes são sinais importantes.</p>
  ${fld('Xixi', opts('pee', [['sim', 'Sim'], ['nao', 'Não']], 'sim'))}
  ${fld('Cocô', opts('poo', [['sim', 'Sim'], ['nao', 'Não']], 'nao'))}
  ${fld('Consistência das fezes', opts('stool', [['normal', 'Normal'], ['mole', 'Mole'], ['dura', 'Dura'], ['diarreia', 'Diarreia']], 'normal'))}
  ${whenField()}${saveBar()}`]; };
SHEETS.weight = () => { F = { save: 'weight', bcs: '' }; const w = latestWeight(dog()); return [`<h3>Peso</h3><p class="lead">${w ? `Último: ${nf(w, 1)} kg` : 'Pese sempre na mesma balança, de preferência em jejum.'}</p>
  <div class="big-input"><input id="f_kg" type="number" inputmode="decimal" step="0.1" placeholder="${w ? nf(w, 1).replace(',', '.') : '0'}"><span>kg</span></div>
  <div class="hint small muted center" style="margin:-8px 0 14px">Dica: pese você no colo com ele e desconte seu peso.</div>
  ${fld('Escore corporal (opcional)', `<div class="levels">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button data-a="optLvl" data-v="bcs|${n}">${n}</button>`).join('')}</div>`, '1–3 magro · 4–5 ideal · 6–7 acima · 8–9 obeso')}
  ${whenField()}${saveBar()}`]; };
SHEETS.symptom = () => { F = { save: 'symptom', sym: 'vomito', level: '2' }; return [`<h3>Sintoma</h3><p class="lead">Anote o que viu. Em sinais de emergência, procure atendimento na hora.</p>
  ${fld('O que aconteceu', opts('sym', SYMPTOMS, 'vomito'))}
  ${fld('Intensidade', opts('level', [['1', 'Leve'], ['2', 'Moderado'], ['3', 'Forte']], '2'))}
  ${fld('Detalhes', `<textarea id="f_notes" placeholder="Quantas vezes, como estava, o que comeu antes…"></textarea>`)}
  ${whenField()}${saveBar()}`]; };
SHEETS.note = () => { F = { save: 'note' }; return [`<h3>Anotação</h3>${fld('Texto', '<textarea id="f_notes" placeholder="Comportamento, adestramento, observações…"></textarea>')}${whenField()}${saveBar()}`]; };

SHEETS.food = (f = null) => {
  F = { save: 'food', editId: f && f.id, kind: f ? f.kind : 'seca', main: f ? (f.main ? 'sim' : 'nao') : 'nao' };
  return [`<h3>${f ? 'Editar alimento' : 'Novo alimento'}</h3><p class="lead">Use os dados da embalagem para mais precisão.</p>
    ${fld('Nome', `<input id="f_name" value="${esc(f ? f.name : '')}" placeholder="Ex.: Premier Adulto Médio">`)}
    ${fld('Tipo', opts('kind', FOOD_KINDS, F.kind))}
    ${fld('Calorias por 100 g', `<input id="f_kcal" type="number" inputmode="decimal" value="${f ? f.kcal100 : ''}" placeholder="Ex.: 380">`, 'Embalagem em kcal/kg? Divida por 10: 3.800 kcal/kg = 380.')}
    ${fld('Peso de uma unidade (g)', `<input id="f_unit" type="number" inputmode="decimal" value="${f && f.unitG ? f.unitG : ''}" placeholder="opcional, para petiscos e sachês">`)}
    ${fld('Alimento principal', opts('main', [['sim', 'Sim'], ['nao', 'Não']], F.main), 'Usado na meta em gramas e no registro por voz.')}
    ${saveBar('Salvar', f ? `<button class="btn ghost" data-a="delFood" data-v="${f.id}">Excluir</button>` : '')}`];
};
SHEETS.factor = () => {
  const d = dog(); F = { save: 'factor', factor: d.factor || 'auto' };
  return [`<h3>Fator de energia</h3><p class="lead">O automático usa idade, castração, objetivo e atividade do perfil.</p>
    <div class="list">${FACTORS.map(([k, l, v]) => `<button class="item" data-a="opt1" data-v="factor|${k}"><div class="grow"><div class="t">${l}</div></div><span class="muted small">${v ? '× ' + nf(v, 1) : ''}</span><div class="check ${F.factor === k ? 'on' : ''}" data-chk="${k}">${icon('check', 'sm')}</div></button>`).join('')}</div>
    ${saveBar()}`];
};
SHEETS.care = (kind, type, rec) => {
  const defs = kind === 'vaccine' ? VACCINES : PARASITES;
  const def = defs.find(x => x.id === type) || { id: 'outra', name: rec ? rec.name : '', days: 365 };
  const last = rec || lastCare(dog().id, kind, type);
  const interval = (last && last.interval) || def.days;
  F = { save: 'care', kind, type, interval: String(interval), editId: rec && rec.id };
  const today = dayKey(Date.now());
  const hist = careOf(dog().id, kind).filter(c => c.type === type && type !== 'outra').sort((a, b) => b.date.localeCompare(a.date));
  return [`<h3>${type === 'outra' && !rec ? 'Outra vacina' : esc(def.name)}</h3><p class="lead">${rec ? 'Editar registro' : 'Registrar aplicação'}</p>
    ${type === 'outra' ? fld('Nome', `<input id="f_name" value="${esc(rec ? rec.name : '')}" placeholder="Ex.: Tosse dos canis intranasal">`) : ''}
    ${kind === 'parasite' ? fld('Produto', `<input id="f_product" value="${esc(rec ? rec.product || '' : last ? last.product || '' : '')}" placeholder="Ex.: Bravecto, Drontal">`) : ''}
    ${fld('Data da aplicação', `<input id="f_date" type="date" value="${rec ? rec.date : today}" data-in="careNext">`)}
    ${fld('Repetir a cada', opts('interval', kind === 'vaccine' ? [['365', '1 ano'], ['180', '6 meses'], ['21', '21 dias'], ['0', 'Não repete']] : [['30', '30 dias'], ['84', '12 semanas'], ['90', '3 meses'], ['120', '4 meses'], ['180', '6 meses']], F.interval))}
    ${fld('Próxima dose', `<input id="f_next" type="date" value="${rec ? rec.next || '' : ''}">`, 'Calculada automaticamente; ajuste se o veterinário indicar outra data.')}
    ${fld('Veterinário / observações', `<input id="f_notes" value="${esc(rec ? rec.notes || '' : '')}" placeholder="opcional">`)}
    ${saveBar('Salvar', rec ? `<button class="btn ghost" data-a="delCare" data-v="${rec.id}">Excluir</button>` : '')}
    ${hist.length ? `<h2 class="sec">Histórico</h2><div class="list">${hist.map(c => `<button class="item" data-a="careRec" data-v="${c.id}"><div class="grow"><div class="t">${fmtDate(parseDay(c.date))}</div><div class="s">${esc([c.product, c.notes].filter(Boolean).join(' · '))}</div></div>${icon('chev', 'sm')}</button>`).join('')}</div>` : ''}`,
  () => { if (!rec) careNext(); }];
};
function careNext() {
  const dt = val('f_date'); const n = parseInt(F.interval, 10);
  const el = document.getElementById('f_next');
  if (el && dt) el.value = n ? dayKey(addDays(parseDay(dt), n)) : '';
}
SHEETS.med = (m = null) => {
  F = { save: 'med', editId: m && m.id, every: String(m ? m.every || 1 : 1), photo: null, photoId: m && m.photoId };
  return [`<h3>${m ? esc(m.name) : 'Novo remédio'}</h3><p class="lead">Use exatamente a dose e os horários da receita.</p>
    ${fld('Nome', `<input id="f_name" value="${esc(m ? m.name : '')}" placeholder="Ex.: Apoquel 5,4 mg">`)}
    ${fld('Dose', `<input id="f_dose" value="${esc(m ? m.dose || '' : '')}" placeholder="Ex.: 1 comprimido">`)}
    ${fld('Horários', `<input id="f_times" value="${esc(m ? (m.times || []).join(', ') : '08:00')}" placeholder="08:00, 20:00">`, 'Separe por vírgula. Cada horário vira um lembrete.')}
    ${fld('Frequência', opts('every', [['1', 'Todo dia'], ['2', 'Dia sim, dia não'], ['7', 'Semanal'], ['30', 'Mensal']], F.every))}
    <div class="grid2">${fld('Início', `<input id="f_start" type="date" value="${m ? m.start || '' : dayKey(Date.now())}">`)}${fld('Fim', `<input id="f_end" type="date" value="${m ? m.end || '' : ''}">`)}</div>
    ${fld('Observações', `<input id="f_notes" value="${esc(m ? m.notes || '' : '')}" placeholder="com comida, em jejum…">`)}
    ${fld('Foto da receita', photoPicker(m && m.photoId))}
    ${m ? fld('Situação', opts('paused', [['nao', 'Em uso'], ['sim', 'Pausado']], m.paused ? 'sim' : 'nao')) : ''}
    ${saveBar('Salvar', m ? `<button class="btn ghost" data-a="delCareId" data-v="${m.id}">Excluir</button>` : '')}`];
};
SHEETS.visit = (v = null) => {
  F = { save: 'visit', editId: v && v.id, photos: [] };
  const ex = (v && v.photoIds) || [];
  return [`<h3>${v ? 'Consulta' : 'Nova consulta ou exame'}</h3><p class="lead">Guarde o que o veterinário disse enquanto está fresco.</p>
    ${fld('Data', `<input id="f_date" type="date" value="${v ? v.date : dayKey(Date.now())}">`)}
    ${fld('Motivo', `<input id="f_reason" value="${esc(v ? v.reason || '' : '')}" placeholder="Check-up, vacina, exame de sangue…">`)}
    ${fld('Veterinário / clínica', `<input id="f_vet" value="${esc(v ? v.vet || '' : '')}">`)}
    ${fld('Anotações', `<textarea id="f_notes" placeholder="Diagnóstico, orientações, retorno…">${esc(v ? v.notes || '' : '')}</textarea>`)}
    ${ex.length ? `<div class="photos" style="margin-bottom:14px">${ex.map(id => `<button class="ph" data-a="photoView" data-v="${id}" style="background-image:url('${photo(id)}')"></button>`).join('')}</div>` : ''}
    ${fld('Adicionar fotos', `<input type="file" accept="image/*" multiple data-in="photosAdd" style="padding:10px"><div class="tiny muted" id="f_pcount"></div>`)}
    ${saveBar('Salvar', v ? `<button class="btn ghost" data-a="delCareId" data-v="${v.id}">Excluir</button>` : '')}`];
};
SHEETS.doc = () => {
  F = { save: 'doc', photo: null };
  return [`<h3>Documento</h3><p class="lead">Receita, exame, carteira de vacinação.</p>
    ${fld('Foto', photoPicker())}
    ${fld('Descrição', '<input id="f_label" placeholder="Ex.: Hemograma março">')}
    ${fld('Data', `<input id="f_date" type="date" value="${dayKey(Date.now())}">`)}${saveBar()}`];
};
function photoPicker(existing) {
  const p = existing ? photo(existing) : '';
  return `<label class="ph" style="display:block;height:150px;border-radius:16px;border:1.5px dashed var(--line);background:var(--surface) center/cover ${p ? `url('${p}')` : ''};position:relative" id="f_pp">
    <span style="position:absolute;inset:0;display:grid;place-items:center;color:var(--muted)" id="f_ppl">${p ? '' : icon('cam')}</span>
    <input type="file" accept="image/*" data-in="photoOne" style="display:none"></label>`;
}
SHEETS.radar = () => {
  const d = dog(), mk = monthKey(Date.now());
  const cur = S.radar.find(r => r.dogId === d.id && r.month === mk);
  const prev = S.radar.filter(r => r.dogId === d.id && r.month < mk).sort((a, b) => b.month.localeCompare(a.month))[0];
  F = { save: 'radar', scores: Object.assign({}, (cur || prev || { scores: {} }).scores) };
  const hints = { energia: 'disposição para brincar e passear', apetite: 'interesse pela comida', pelagem: 'brilho, queda, coceira, pele', mobilidade: 'sobe, desce, corre sem dor', digestao: 'fezes, gases, vômitos', sono: 'descansa bem, sem inquietação', humor: 'calmo, sociável, sem ansiedade' };
  return [`<h3>Bem-estar de ${monthLabel(mk)}</h3><p class="lead">0 = muito ruim · 5 = excelente. ${prev && !cur ? 'Valores do mês anterior pré-preenchidos.' : ''}</p>
    ${RADAR_AXES.map(([k, l]) => `<div class="field"><label>${l} <span class="muted" style="font-weight:400">· ${hints[k]}</span></label>
      <div class="levels" data-group="r_${k}">${[0, 1, 2, 3, 4, 5].map(n => `<button class="${F.scores[k] === n ? 'on' : ''}" data-a="radarSet" data-v="${k}|${n}">${n}</button>`).join('')}</div></div>`).join('')}
    ${saveBar()}`];
};
SHEETS.redflags = () => [`<h3>Sinais de emergência</h3><p class="lead">Se notar algum destes, vá ao veterinário ou à clínica 24 h agora.</p>
  <div class="list">${RED_FLAGS.map(f => `<div class="item"><div class="ic bad">${icon('alert', 'sm')}</div><div class="grow t" style="white-space:normal">${f.m}</div></div>`).join('')}</div>
  ${emergencyButtons()}`];
function emergencyButtons() {
  const c = S.team.filter(m => m.phone && (m.role === 'Clínica 24 h' || m.role === 'Veterinário'));
  return c.length ? `<div class="btns" style="flex-direction:column">${c.map(m => `<button class="btn danger" data-a="call" data-v="${esc(m.phone)}">${icon('phone', 'sm')} Ligar para ${esc(m.name)}</button>`).join('')}</div>`
    : `<div class="btns"><button class="btn ghost" data-a="goTeam">Cadastrar veterinário e clínica 24 h</button></div>`;
}
SHEETS.emergency = flags => [`<div class="alert bad" style="margin-top:4px">${icon('alert')}<div class="body"><b>Isso pode ser uma emergência</b>${flags.map(esc).join(' · ')}</div></div>
  <p style="margin:0 4px 6px">Procure o veterinário ou uma clínica 24 h agora. Não espere os sintomas piorarem e não dê remédios por conta própria.</p>${emergencyButtons()}
  <div class="btns"><button class="btn ghost" data-a="closeSheet">Entendi</button></div>`];

SHEETS.dog = (d = null) => {
  F = { save: 'dog', editId: d && d.id, sex: d ? d.sex : 'm', neutered: d ? (d.neutered ? 'sim' : 'nao') : 'sim', size: d ? d.size : 'medio', goal: d ? d.goal || 'manter' : 'manter', activity: d ? d.activity || 'normal' : 'normal', photo: null, photoId: d && d.photoId };
  return [`<h3>${d ? 'Perfil' : 'Seu cão'}</h3><p class="lead">${d ? 'Esses dados ajustam metas e lembretes.' : 'Só o nome é obrigatório. O resto melhora as metas.'}</p>
    <div class="row" style="gap:16px;margin-bottom:14px"><div style="width:96px">${photoPicker(d && d.photoId).replace('height:150px', 'height:96px;border-radius:50%')}</div>
      <div class="grow">${fld('Nome', `<input id="f_name" value="${esc(d ? d.name : '')}" placeholder="Ex.: Thor">`)}</div></div>
    ${fld('Raça', `<input id="f_breed" value="${esc(d ? d.breed || '' : '')}" placeholder="Ex.: SRD, Golden Retriever">`)}
    <div class="grid2">${fld('Nascimento', `<input id="f_birth" type="date" value="${d ? d.birth || '' : ''}">`)}${fld('Peso atual (kg)', `<input id="f_weight" type="number" inputmode="decimal" step="0.1" value="${d ? latestWeight(d) || '' : ''}">`)}</div>
    ${fld('Sexo', opts('sex', [['m', 'Macho'], ['f', 'Fêmea']], F.sex))}
    ${fld('Castrado(a)', opts('neutered', [['sim', 'Sim'], ['nao', 'Não']], F.neutered))}
    ${fld('Porte adulto', opts('size', SIZES.map(s => [s[0], `${s[1]} <span class="muted tiny">${s[2]}</span>`]), F.size))}
    ${fld('Peso ideal (kg)', `<input id="f_ideal" type="number" inputmode="decimal" step="0.1" value="${d && d.idealWeight ? d.idealWeight : ''}" placeholder="opcional — pergunte ao veterinário">`)}
    ${fld('Objetivo', opts('goal', [['manter', 'Manter peso'], ['perder', 'Perder peso'], ['ganhar', 'Ganhar peso']], F.goal))}
    ${fld('Atividade', opts('activity', [['baixa', 'Baixa'], ['normal', 'Normal'], ['alta', 'Alta']], F.activity))}
    ${saveBar(d ? 'Salvar' : 'Começar')}`];
};
SHEETS.team = (m = null) => {
  F = { save: 'team', editId: m && m.id, role: m ? m.role : 'Veterinário' };
  const roles = ['Veterinário', 'Clínica 24 h', 'Banho e tosa', 'Adestrador', 'Passeador / pet sitter', 'Outro'];
  return [`<h3>${m ? 'Contato' : 'Novo contato'}</h3><p class="lead"></p>
    ${fld('Função', opts('role', roles.map(r => [r, r]), F.role))}
    ${fld('Nome', `<input id="f_name" value="${esc(m ? m.name : '')}" placeholder="Ex.: Dra. Ana · Clínica Vida">`)}
    ${fld('Telefone', `<input id="f_phone" type="tel" value="${esc(m ? m.phone || '' : '')}" placeholder="(11) 99999-0000">`)}
    ${fld('Observações', `<input id="f_notes" value="${esc(m ? m.notes || '' : '')}" placeholder="endereço, horário…">`)}
    ${saveBar('Salvar', m ? `<button class="btn ghost" data-a="delTeam" data-v="${m.id}">Excluir</button>` : '')}`];
};

function showSheet(name, ...args) {
  const r = SHEETS[name](...args);
  const [html, mount] = Array.isArray(r) ? r : [r];
  const keepF = F;
  openSheet(html, mount);
  F = keepF;
}

/* ---------------- salvar sheets ---------------- */
const SAVE = {};
SAVE.meal = () => {
  const g = numv('f_g'); const f = foodById(F.food);
  if (!g || !f) return toast('Informe a quantidade');
  if (F.editId) { const e = S.entries.find(x => x.id === F.editId); Object.assign(e, { foodId: f.id, name: f.name, g, kcal: f.kcal100 * g / 100, t: whenVal() }); save(); }
  else addEntry({ type: 'meal', foodId: f.id, name: f.name, g, kcal: f.kcal100 * g / 100, t: whenVal() });
  return true;
};
SAVE.water = () => { const ml = numv('f_ml'); if (!ml) return toast('Informe a quantidade'); addEntry({ type: 'water', ml, t: whenVal() }); return true; };
SAVE.walk = () => { const min = numv('f_min'); if (!min) return toast('Informe os minutos'); addEntry({ type: 'walk', min, intensity: F.intensity, t: whenVal() }); return true; };
SAVE.potty = () => { if (F.pee !== 'sim' && F.poo !== 'sim') return toast('Marque xixi ou cocô'); addEntry({ type: 'potty', pee: F.pee === 'sim', poo: F.poo === 'sim', stool: F.poo === 'sim' ? F.stool : null, t: whenVal() }); if (F.poo === 'sim' && F.stool === 'diarreia') addEntry({ type: 'symptom', sym: 'diarreia', level: 2, t: whenVal() }); return true; };
SAVE.weight = () => {
  const kg = numv('f_kg'); if (!kg) return toast('Informe o peso');
  const prev = latestWeight(dog());
  addEntry({ type: 'weight', kg, bcs: F.bcs ? +F.bcs : null, t: whenVal() });
  if (prev && Math.abs(kg / prev - 1) > 0.15) setTimeout(() => toast('Mudança grande em relação ao último peso. Confira a balança.'), 400);
  return true;
};
SAVE.symptom = () => {
  const notes = val('f_notes');
  addEntry({ type: 'symptom', sym: F.sym, level: +F.level, notes, t: whenVal() });
  const flags = redFlags(notes + ' ' + symName(F.sym));
  const d = dog();
  const same = entriesOf(d.id, 'symptom').filter(e => e.sym === F.sym && Date.now() - e.t < DAY).length;
  if (flags.length) { setTimeout(() => showSheet('emergency', flags), 300); }
  else if (+F.level === 3 || same >= 2) setTimeout(() => toast('Sintoma forte ou repetido: vale ligar para o veterinário.'), 300);
  return true;
};
SAVE.note = () => { const t = val('f_notes'); if (!t) return toast('Escreva algo'); addEntry({ type: 'note', text: t, t: whenVal() }); return true; };
SAVE.food = () => {
  const name = val('f_name'), kcal = numv('f_kcal');
  if (!name || !kcal) return toast('Nome e calorias são obrigatórios');
  if (kcal > 1000) return toast('Valor por 100 g parece alto. Dividiu kcal/kg por 10?');
  let f = F.editId && foodById(F.editId);
  if (!f) { f = { id: uid() }; S.foods.push(f); }
  Object.assign(f, { name, kind: F.kind, kcal100: kcal, unitG: numv('f_unit') || 0, main: F.main === 'sim', generic: false });
  if (f.main) S.foods.forEach(x => { if (x !== f) x.main = false; });
  save(); return true;
};
SAVE.factor = () => { const d = dog(); d.factor = F.factor === 'auto' ? null : F.factor; save(); return true; };
SAVE.care = () => {
  const d = dog(); const date = val('f_date'); if (!date) return toast('Informe a data');
  const def = (F.kind === 'vaccine' ? VACCINES : PARASITES).find(x => x.id === F.type);
  const name = F.type === 'outra' ? val('f_name') : def.name;
  if (!name) return toast('Informe o nome');
  let r = F.editId && S.care.find(c => c.id === F.editId);
  if (!r) { r = { id: uid(), dogId: d.id, kind: F.kind, type: F.type }; S.care.push(r); }
  Object.assign(r, { name, date, next: val('f_next') || '', interval: +F.interval, notes: val('f_notes'), product: val('f_product') || undefined });
  askNotifOnce(); save(); return true;
};
SAVE.med = () => {
  const name = val('f_name'); if (!name) return toast('Informe o nome');
  const times = val('f_times').split(/[,;\s]+/).map(s => s.trim()).filter(Boolean).map(s => { const m = s.match(/^(\d{1,2})(?::|h)?(\d{2})?$/); return m ? `${pad(+m[1] % 24)}:${pad(m[2] ? +m[2] : 0)}` : null; }).filter(Boolean);
  if (!times.length) return toast('Informe ao menos um horário, ex.: 08:00');
  let m = F.editId && S.care.find(c => c.id === F.editId);
  if (!m) { m = { id: uid(), dogId: dog().id, kind: 'med' }; S.care.push(m); }
  Object.assign(m, { name, dose: val('f_dose'), times: [...new Set(times)].sort(), every: +F.every, start: val('f_start'), end: val('f_end'), notes: val('f_notes'), paused: F.paused === 'sim' });
  if (F.photo) { const pid = uid(); Native.savePhoto(pid, F.photo); photoCache[pid] = F.photo; m.photoId = pid; }
  askNotifOnce(); save(); return true;
};
SAVE.visit = () => {
  const date = val('f_date'); if (!date) return toast('Informe a data');
  let v = F.editId && S.care.find(c => c.id === F.editId);
  if (!v) { v = { id: uid(), dogId: dog().id, kind: 'visit', photoIds: [] }; S.care.push(v); }
  Object.assign(v, { date, reason: val('f_reason'), vet: val('f_vet'), notes: val('f_notes') });
  F.photos.forEach(p => { const pid = uid(); Native.savePhoto(pid, p); photoCache[pid] = p; v.photoIds.push(pid); });
  save(); return true;
};
SAVE.doc = () => {
  if (!F.photo) return toast('Escolha uma foto');
  const pid = uid(); Native.savePhoto(pid, F.photo); photoCache[pid] = F.photo;
  S.care.push({ id: uid(), dogId: dog().id, kind: 'doc', photoId: pid, label: val('f_label'), date: val('f_date') || dayKey(Date.now()) });
  save(); return true;
};
SAVE.radar = () => {
  if (RADAR_AXES.some(([k]) => F.scores[k] == null)) return toast('Avalie todos os itens');
  const d = dog(), mk = monthKey(Date.now());
  let r = S.radar.find(x => x.dogId === d.id && x.month === mk);
  if (!r) { r = { dogId: d.id, month: mk }; S.radar.push(r); }
  r.scores = Object.assign({}, F.scores); save(); return true;
};
SAVE.dog = () => {
  const name = val('f_name'); if (!name) return toast('Informe o nome');
  let d = F.editId && S.dogs.find(x => x.id === F.editId);
  const isNew = !d;
  if (!d) { d = { id: uid(), created: Date.now() }; S.dogs.push(d); }
  Object.assign(d, { name, breed: val('f_breed'), birth: val('f_birth'), sex: F.sex, neutered: F.neutered === 'sim', size: F.size, idealWeight: numv('f_ideal'), goal: F.goal, activity: F.activity });
  if (F.photo) { const pid = uid(); Native.savePhoto(pid, F.photo); photoCache[pid] = F.photo; if (d.photoId) Native.deletePhoto(d.photoId); d.photoId = pid; }
  const kg = numv('f_weight');
  if (kg && kg !== latestWeight(d)) S.entries.push({ id: uid(), dogId: d.id, type: 'weight', kg, t: Date.now() });
  S.settings.activeDog = d.id;
  if (isNew) { nav = { tab: 'hoje', stack: [] }; }
  save(); return true;
};
SAVE.team = () => {
  const name = val('f_name'); if (!name) return toast('Informe o nome');
  let m = F.editId && S.team.find(x => x.id === F.editId);
  if (!m) { m = { id: uid() }; S.team.push(m); }
  Object.assign(m, { role: F.role, name, phone: val('f_phone'), notes: val('f_notes') });
  save(); return true;
};
function askNotifOnce() {
  if (S.settings.notif && !S.settings.askedNotif) { S.settings.askedNotif = true; Native.requestNotifications(); }
}

/* ---------------- voz ---------------- */
function showVoiceResult(text, drafts, viaAi) {
  F = { save: 'voice', drafts };
  const d = dog();
  const rows = drafts.map((x, i) => {
    const e = Object.assign({ id: 'draft' + i, dogId: d.id }, x);
    if (x.type === 'meal' && x.g) e.kcal = (foodById(x.foodId) || {}).kcal100 * x.g / 100;
    const info = entryInfo(e);
    let s = info.s;
    if (x.type === 'meal' && !x.g) s = 'quantidade não entendida — informe abaixo';
    return `<div class="item"><div class="ic ${info.cls}">${icon(info.ic, 'sm')}</div><div class="grow"><div class="t">${esc(info.t)}</div><div class="s">${esc(s)}${x.guessed && x.type === 'walk' ? ' (estimado)' : ''}</div>
      ${x.type === 'meal' && !x.g ? `<input id="vg_${i}" type="number" inputmode="decimal" placeholder="gramas" style="margin-top:6px;width:120px;border:1px solid var(--line);border-radius:10px;padding:6px 10px;background:var(--surface)">` : ''}</div>
      <button class="icon-btn" data-a="voiceDrop" data-v="${i}">${icon('x', 'sm')}</button></div>`;
  });
  const html = `<h3>${drafts.length ? 'Entendi' : 'Não entendi'}</h3><p class="lead">"${esc(text)}"${viaAi ? ' · interpretado pela IA local' : ''}</p>
    ${drafts.length ? `<div class="list">${rows.join('')}</div>${saveBar('Salvar tudo', '<button class="btn ghost" data-a="voice">Falar de novo</button>')}`
      : `<p class="small muted">Tente frases como "comeu 150 gramas de ração", "bebeu 300 ml de água", "passeou 40 minutos", "pesou 12,4 kg", "vomitou duas vezes".</p>
         <div class="btns">${aiState.state === 'ready' ? `<button class="btn ghost" data-a="voiceAi" data-v="${esc(text)}">Tentar com IA</button>` : ''}<button class="btn accent" data-a="voice">Falar de novo</button></div>`}`;
  const keep = F; openSheet(html); F = keep;
}
SAVE.voice = () => {
  const d = dog(); let flagged = [];
  F.drafts.forEach((x, i) => {
    if (!x) return;
    const e = Object.assign({}, x); delete e.guessed;
    if (e.type === 'meal') {
      if (!e.g) { const g = numv('vg_' + i); if (!g) return; e.g = g; }
      e.kcal = (foodById(e.foodId) || mainFood()).kcal100 * e.g / 100;
      delete e.units;
    }
    if (e.type === 'symptom') flagged = flagged.concat(redFlags(e.notes || ''));
    S.entries.push(Object.assign({ id: uid(), dogId: d.id }, e));
  });
  save();
  if (flagged.length) setTimeout(() => showSheet('emergency', [...new Set(flagged)]), 300);
  else toast('Registrado');
  return true;
};

/* ---------------- assistente local ---------------- */
function localAnswer(q, d) {
  const n = norm(q);
  const en = energy(d), mf = mainFood();
  const m = n.match(/pode (?:comer|dar|ganhar)\s+(.+)|posso dar\s+(.+)|(?:e toxico|faz mal)\s*(.*)/);
  if (m) { const item = (m[1] || m[2] || m[3] || '').replace(/[?!.]/g, '').replace(/^(o|a|os|as|um|uma)\s+/, ''); const r = foodCheck(item); if (r) return `${{ bad: 'Não pode', warn: 'Melhor evitar', good: 'Pode', unknown: 'Não sei dizer' }[r.lvl]}: ${r.t}. ${r.d}`; }
  if (/comid|aliment|kcal|calori|racao|petisco|comer|comendo|fome/.test(n)) {
    if (!en) return 'Preciso do peso para calcular a meta. Registre em Hoje › Peso.';
    const v = lastDays(7).slice(0, 6).map(k => kcalOnDay(d, k)).filter(x => x > 0);
    const avg = v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
    return `Meta de ${nf(en.mer)} kcal por dia (${en.label.toLowerCase()})${mf ? `, cerca de ${nf(en.mer / mf.kcal100 * 100)} g de ${mf.name.toLowerCase()}` : ''}.` +
      (avg ? ` Nos últimos dias a média foi ${nf(avg)} kcal, ${avg > en.mer * 1.1 ? 'acima' : avg < en.mer * 0.85 ? 'abaixo' : 'dentro'} da meta.` : ' Ainda há poucos registros de refeições nesta semana.') +
      ` Petiscos: ${nf(treatShare(d) * 100)}% das calorias (o ideal é até 10%).`;
  }
  if (/vacina|vermif|pulga|carrapat|venc|cuidad|remedio|proxim/.test(n)) {
    const due = dueItems(d, 60);
    const meds = careOf(d.id, 'med').filter(x => medActiveOn(x, Date.now()));
    let s = due.length ? 'Próximos cuidados: ' + due.map(x => `${x.name} ${x.days < 0 ? `(atrasada ${-x.days} dias)` : relDay(x.next)}`).join('; ') + '.' : 'Nada vencendo nos próximos 60 dias entre os cuidados registrados.';
    if (meds.length) s += ' Remédios hoje: ' + meds.map(x => `${x.name} às ${(x.times || []).join(', ')}`).join('; ') + '.';
    const missing = VACCINES.slice(0, 2).filter(v => !lastCare(d.id, 'vaccine', v.id));
    if (missing.length) s += ` Sem registro de: ${missing.map(v => v.name).join(' e ')}.`;
    return s;
  }
  if (/peso|gord|magr|ideal|obes|emagrec/.test(n)) {
    const w = latestWeight(d); if (!w) return 'Ainda não há peso registrado.';
    const wc = weightChange(d, 30);
    const b = entriesOf(d.id, 'weight').filter(e => e.bcs).sort((a, c) => c.t - a.t)[0];
    let s = `Peso atual: ${nf(w, 1)} kg.`;
    if (wc) s += ` Variação de ${wc.kg >= 0 ? '+' : ''}${nf(wc.kg, 1)} kg em ${wc.days} dias.`;
    if (d.idealWeight) s += ` Peso ideal: ${nf(d.idealWeight, 1)} kg (${nf((w / d.idealWeight - 1) * 100)}%).`;
    s += b ? ` Último escore corporal: ${b.bcs}/9 (${BCS[b.bcs].toLowerCase()}).` : ' Avalie o escore corporal: costelas fáceis de sentir e cintura visível indicam peso ideal.';
    return s + ' Para metas de emagrecimento, combine com o veterinário.';
  }
  if (/passe|ativ|exerc|brinc|tedio|enriquec|entedi|energia/.test(n)) {
    const avg = lastDays(7).reduce((a, k) => a + sumOnDay(d, 'walk', 'min', k), 0) / 7;
    return `Média de ${nf(avg)} min de passeio por dia; a referência para ${d.name} é ~${walkTarget(d)} min. Ideias para hoje: espalhar a ração no quintal para farejar, um brinquedo recheado congelado, 5 minutos de treino de "fica" e "vem", ou um passeio novo com tempo livre para cheirar.`;
  }
  const ins = insights(d).slice(0, 4);
  return (ins.length ? 'Destaques de agora:\n• ' + ins.map(x => x.text).join('\n• ') : `Tudo tranquilo nos registros de ${d.name}.`) +
    '\n\nPara conversar livremente, ative a IA local em Ajustes › IA local.';
}
function aiPrompt(q, d) {
  const hist = S.chat.filter(m => m.dogId === d.id && !m.think).slice(-6, -1).map(m => `${m.role === 'user' ? 'Tutor' : 'Assistente'}: ${m.text}`).join('\n');
  return `<start_of_turn>user
Você é o assistente do app DogCare e conversa em português do Brasil com o tutor de um cão.
Regras: seja breve (até 6 frases), prático e gentil. Use os dados abaixo e conhecimento geral de cuidados com cães. Nunca dê diagnóstico nem dose de remédio. Diante de sintomas, faça perguntas conservadoras (há quanto tempo, se come e bebe, se há sangue, apatia, vômito repetido) e recomende o veterinário quando houver dúvida. Em sinais de emergência, oriente procurar atendimento imediato. Não invente dados que não estão abaixo.

DADOS DE ${d.name.toUpperCase()}
${dogContext(d)}
${hist ? `\nCONVERSA RECENTE\n${hist}\n` : ''}
PERGUNTA DO TUTOR
${q}<end_of_turn>
<start_of_turn>model
`;
}
function ask(q) {
  q = (q || '').trim(); if (!q) return;
  const d = dog();
  S.chat.push({ dogId: d.id, role: 'user', text: q, t: Date.now() });
  const flags = redFlags(q);
  if (flags.length) {
    S.chat.push({ dogId: d.id, role: 'ai', text: `Isso pode ser uma emergência (${flags.join('; ').toLowerCase()}). Procure o veterinário ou uma clínica 24 h agora, sem esperar piorar, e não dê remédios por conta própria.`, t: Date.now() });
    save(); render(); showSheet('emergency', flags); return;
  }
  if (aiState.state === 'ready') {
    const id = uid();
    S.chat.push({ dogId: d.id, role: 'ai', text: 'Pensando…', think: true, reqId: id, t: Date.now() });
    pendingAi[id] = { kind: 'chat' };
    Native.aiAsk(id, aiPrompt(q, d));
  } else {
    S.chat.push({ dogId: d.id, role: 'ai', text: localAnswer(q, d), t: Date.now() });
  }
  save(); render();
}

/* ---------------- imagens ---------------- */
function readImage(file, max = 1280) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        res(c.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = rej; img.src = r.result;
    };
    r.onerror = rej; r.readAsDataURL(file);
  });
}

/* ---------------- backup ---------------- */
function exportData() {
  const ids = new Set();
  S.dogs.forEach(d => d.photoId && ids.add(d.photoId));
  S.care.forEach(c => { c.photoId && ids.add(c.photoId); (c.photoIds || []).forEach(i => ids.add(i)); });
  const photos = {}; ids.forEach(id => { const p = photo(id); if (p) photos[id] = p; });
  Native.exportFile(`dogcare-backup-${dayKey(Date.now())}.json`, JSON.stringify({ app: 'dogcare', v: 1, exported: new Date().toISOString(), data: S, photos }));
}
DC.onImport = text => {
  let o; try { o = JSON.parse(text); } catch (e) { return toast('Arquivo inválido'); }
  const data = o && o.app === 'dogcare' ? o.data : (o && o.dogs ? o : null);
  if (!data) return toast('Não é um backup do DogCare');
  F = { save: 'none', imp: o };
  const html = `<h3>Importar backup</h3><p class="lead">${o.exported ? 'Exportado em ' + fmtDate(new Date(o.exported).getTime()) : ''}</p>
    <div class="list">${[['Cães', data.dogs], ['Registros', data.entries], ['Cuidados', data.care], ['Contatos', data.team]].map(([l, a]) => `<div class="item"><div class="grow t">${l}</div><div class="end num">${(a || []).length}</div></div>`).join('')}</div>
    <p class="small muted">"Mesclar" junta com o que já existe, sem duplicar. "Substituir" apaga os dados atuais.</p>
    <div class="btns">${S.dogs.length ? '<button class="btn ghost" data-a="impReplace">Substituir</button>' : ''}<button class="btn accent" data-a="impMerge">${S.dogs.length ? 'Mesclar' : 'Importar'}</button></div>`;
  const k = F; openSheet(html); F = k;
};
function doImport(replace) {
  const o = F.imp; const data = o.app === 'dogcare' ? o.data : o;
  Object.entries(o.photos || {}).forEach(([id, p]) => { Native.savePhoto(id, p); photoCache[id] = p; });
  if (replace || !S.dogs.length) {
    const keepSettings = S.settings;
    S = Object.assign(DEFAULT(), data);
    S.settings = Object.assign(DEFAULT().settings, data.settings || {}, { theme: keepSettings.theme });
  } else {
    const byId = (a, b) => { const m = new Map(a.map(x => [x.id, x])); b.forEach(x => { if (!m.has(x.id)) m.set(x.id, x); }); return [...m.values()]; };
    ['dogs', 'foods', 'entries', 'care', 'team'].forEach(k => { S[k] = byId(S[k] || [], data[k] || []); });
    const rk = new Set(S.radar.map(r => r.dogId + r.month)); (data.radar || []).forEach(r => { if (!rk.has(r.dogId + r.month)) S.radar.push(r); });
    Object.entries(data.skills || {}).forEach(([dg, sk]) => { S.skills[dg] = Object.assign({}, sk, S.skills[dg] || {}); });
    const ck = new Set(S.chat.map(c => c.t + c.role)); (data.chat || []).forEach(c => { if (!ck.has(c.t + c.role)) S.chat.push(c); });
    if (S.foods.filter(f => f.main).length > 1) S.foods.forEach((f, i) => { f.main = i === S.foods.findIndex(x => x.main); });
  }
  if (!S.dogs.find(d => d.id === S.settings.activeDog)) S.settings.activeDog = S.dogs[0] && S.dogs[0].id;
  lastDark = null; flush(); closeSheet(); render(); toast('Backup importado');
}

/* ---------------- ações ---------------- */
const A = {};
A.tab = v => { nav.tab = v; nav.stack = []; render(); };
A.go = v => { nav.stack.push({ v }); render(); };
A.back = () => DC.back();
A.goTeam = () => { closeSheet(); nav.stack = [{ v: 'equipe' }]; render(); };
A.sheet = v => showSheet(v);
A.closeSheet = () => closeSheet();
A.saveSheet = () => { const fn = SAVE[F.save]; if (fn && fn() === true) { closeSheet(); render(); } };
A.opt = (v, el) => {
  const [name, value] = v.split('|'); F[name] = value;
  el.parentElement.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === el));
  if (name === 'food') mealCalc();
  if (name === 'interval') careNext();
};
A.opt1 = v => { const [name, value] = v.split('|'); F[name] = value; document.querySelectorAll('[data-chk]').forEach(c => c.classList.toggle('on', c.dataset.chk === value)); };
A.optLvl = (v, el) => { const [name, value] = v.split('|'); F[name] = F[name] === value ? '' : value; el.parentElement.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === el && F[name])); };
A.radarSet = (v, el) => { const [k, n] = v.split('|'); F.scores[k] = +n; el.parentElement.querySelectorAll('button').forEach((b, i) => b.classList.toggle('on', i === +n)); };
A.setG = v => { $('#f_g').value = v; mealCalc(); };
A.setV = v => { const [id, x] = v.split('|'); document.getElementById(id).value = x; };
A.entry = id => {
  const e = S.entries.find(x => x.id === id); if (!e) return;
  const i = entryInfo(e);
  openSheet(`<h3>${esc(i.t)}</h3><p class="lead">${esc(i.s)} · ${fmtDate(e.t)} às ${hhmm(e.t)}</p>
    <div class="btns">${e.type === 'meal' ? `<button class="btn ghost" data-a="editMeal" data-v="${id}">Editar</button>` : ''}<button class="btn danger" data-a="delEntry" data-v="${id}">${icon('trash', 'sm')} Excluir</button></div>`);
};
A.editMeal = id => { const e = S.entries.find(x => x.id === id); showSheet('meal', { id, foodId: e.foodId, g: e.g, t: e.t, treat: false }); };
A.delEntry = id => { S.entries = S.entries.filter(e => e.id !== id); save(); closeSheet(); render(); toast('Excluído'); };
A.toggleDose = v => {
  const [medId, slot] = v.split('|'); const d = dog(); const k = dayKey(Date.now());
  const ex = S.entries.find(e => e.dogId === d.id && e.type === 'dose' && e.medId === medId && e.slot === slot && dayKey(e.t) === k);
  if (ex) S.entries = S.entries.filter(e => e !== ex); else addEntry({ type: 'dose', medId, slot });
  save(); render();
};
A.voice = () => { closeSheet(true); Native.startVoice(); };
A.voiceDrop = (i, el) => { F.drafts[+i] = null; el.closest('.item').remove(); };
A.voiceAi = text => {
  const id = uid(); pendingAi[id] = { kind: 'voice', text };
  closeSheet(); toast('Interpretando com a IA local…'); Native.aiAsk(id, voicePrompt(text));
};
A.foodEdit = id => showSheet('food', foodById(id));
A.delFood = id => {
  S.foods = S.foods.filter(f => f.id !== id);
  if (!S.foods.some(f => f.main) && S.foods.length) (S.foods.find(f => f.kind === 'seca') || S.foods[0]).main = true;
  save(); closeSheet(); render(); toast('Alimento removido da lista');
};
A.care = v => { const [kind, type] = v.split('|'); showSheet('care', kind, type, null); };
A.careRec = id => { const r = S.care.find(c => c.id === id); showSheet('care', r.kind, r.type, r); };
A.delCare = id => { S.care = S.care.filter(c => c.id !== id); save(); closeSheet(); render(); toast('Excluído'); };
A.delCareId = id => { const c = S.care.find(x => x.id === id); if (c) { (c.photoIds || []).concat(c.photoId || []).forEach(p => Native.deletePhoto(p)); } A.delCare(id); };
A.medEdit = id => showSheet('med', S.care.find(c => c.id === id));
A.visitEdit = id => showSheet('visit', S.care.find(c => c.id === id));
A.docView = id => {
  const x = S.care.find(c => c.id === id);
  openSheet(`<h3>${esc(x.label || 'Documento')}</h3><p class="lead">${fmtDate(parseDay(x.date))}</p><img class="viewer" src="${photo(x.photoId)}">
    <div class="btns"><button class="btn danger" data-a="delCareId" data-v="${x.id}">${icon('trash', 'sm')} Excluir</button></div>`);
};
A.photoView = pid => { const keep = F; openSheet(`<img class="viewer" src="${photo(pid)}"><div class="btns"><button class="btn ghost" data-a="closeSheet">Fechar</button></div>`); F = keep; };
A.skill = v => {
  const [id, n] = v.split('|'); const d = dog();
  S.skills[d.id] = S.skills[d.id] || {};
  const cur = S.skills[d.id][id] || 0;
  S.skills[d.id][id] = cur === +n ? +n - 1 : +n;
  save(); render();
};
A.dogMenu = () => {
  if (S.dogs.length < 2) return showSheet('dog', dog());
  openSheet(`<h3>Cães</h3><p class="lead"></p><div class="list">${S.dogs.map(x => `<button class="item" data-a="switchDog" data-v="${x.id}">${avatar(x)}<div class="grow"><div class="t">${esc(x.name)}</div><div class="s">${esc(ageLabel(x.birth))}</div></div>${x.id === dog().id ? '<span class="pill accent">ativo</span>' : ''}</button>`).join('')}</div>
    <div class="btns"><button class="btn ghost" data-a="dogForm" data-v="${dog().id}">Editar perfil</button><button class="btn" data-a="dogForm">Adicionar</button></div>`);
};
A.dogForm = id => { closeSheet(true); showSheet('dog', id ? S.dogs.find(d => d.id === id) : null); };
A.switchDog = id => { S.settings.activeDog = id; save(); closeSheet(); render(); };
A.deleteDog = id => {
  const d = S.dogs.find(x => x.id === id);
  openSheet(`<h3>Excluir ${esc(d.name)}?</h3><p class="lead">Todos os registros, cuidados e fotos serão apagados deste aparelho. Exporte um backup antes se quiser guardar.</p>
    <div class="btns"><button class="btn ghost" data-a="closeSheet">Cancelar</button><button class="btn danger" data-a="deleteDogOk" data-v="${id}">Excluir</button></div>`);
};
A.deleteDogOk = id => {
  S.care.filter(c => c.dogId === id).forEach(c => (c.photoIds || []).concat(c.photoId || []).forEach(p => Native.deletePhoto(p)));
  const d = S.dogs.find(x => x.id === id); if (d && d.photoId) Native.deletePhoto(d.photoId);
  S.dogs = S.dogs.filter(x => x.id !== id); S.entries = S.entries.filter(e => e.dogId !== id); S.care = S.care.filter(c => c.dogId !== id);
  S.radar = S.radar.filter(r => r.dogId !== id); delete S.skills[id]; S.chat = S.chat.filter(c => c.dogId !== id);
  S.settings.activeDog = S.dogs[0] ? S.dogs[0].id : null; nav = { tab: 'hoje', stack: [] };
  flush(); closeSheet(); render();
};
A.theme = v => { S.settings.theme = v; lastDark = null; save(); render(); };
A.toggleNotif = () => { S.settings.notif = !S.settings.notif; if (S.settings.notif) Native.requestNotifications(); save(); render(); };
A.export = () => exportData();
A.import = () => Native.importFile();
A.impMerge = () => doImport(false);
A.impReplace = () => doImport(true);
A.teamEdit = id => showSheet('team', id ? S.team.find(m => m.id === id) : null);
A.delTeam = id => { S.team = S.team.filter(m => m.id !== id); save(); closeSheet(); render(); };
A.call = p => Native.openUrl('tel:' + p.replace(/[^\d+]/g, ''));
A.wa = p => { let n = p.replace(/\D/g, ''); if (n.length <= 11) n = '55' + n; Native.openUrl('https://wa.me/' + n); };
A.ask = q => ask(q);
A.send = () => { const i = $('#ask'); const q = i.value; i.value = ''; ask(q); };
A.clearChat = () => { const d = dog(); S.chat = S.chat.filter(m => m.dogId !== d.id); save(); render(); };
A.aiPick = () => Native.aiPickModel();
A.aiRemove = () => Native.aiRemove();

/* entradas (input/change) */
const IN = {};
IN.foodq = el => { foodQuery = el.value; const r = foodQuery ? foodCheck(foodQuery) : null; $('#fqr').innerHTML = r ? foodResult(r) : ''; };
IN.mealCalc = () => mealCalc();
IN.careNext = () => careNext();
IN.remHour = el => { S.settings.reminderHour = +el.value; save(); };
IN.photoOne = async el => {
  const f = el.files[0]; if (!f) return;
  try { F.photo = await readImage(f, F.save === 'dog' ? 640 : 1400); const pp = $('#f_pp'); pp.style.backgroundImage = `url('${F.photo}')`; $('#f_ppl').innerHTML = ''; }
  catch (e) { toast('Não foi possível ler a imagem'); }
};
IN.photosAdd = async el => {
  for (const f of el.files) { try { F.photos.push(await readImage(f, 1600)); } catch (e) { /* ignora */ } }
  $('#f_pcount').textContent = `${F.photos.length} foto(s) para adicionar`;
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-a]'); if (!el) return;
  const fn = A[el.dataset.a]; if (!fn) return;
  e.preventDefault(); fn(el.dataset.v, el, e);
});
document.addEventListener('input', e => { const el = e.target.closest('[data-in]'); if (el && IN[el.dataset.in] && el.type !== 'file') IN[el.dataset.in](el); });
document.addEventListener('change', e => { const el = e.target.closest('[data-in]'); if (el && IN[el.dataset.in] && (el.type === 'file' || el.tagName === 'SELECT')) IN[el.dataset.in](el); });
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'ask') A.send(); });

/* ---------------- callbacks nativos ---------------- */
DC.back = () => {
  if (sheetEl) { closeSheet(); return true; }
  if (nav.stack.length) { nav.stack.pop(); render(); return true; }
  if (nav.tab !== 'hoje' && dog()) { nav.tab = 'hoje'; render(); return true; }
  return false;
};
DC.onVoice = (text, err) => {
  if (err) return toast(err);
  if (!text) return;
  const d = dog(); if (!d) return;
  showVoiceResult(text, parseVoice(text, d), false);
};
DC.onAiStatus = st => {
  aiState = typeof st === 'string' ? JSON.parse(st) : st;
  const p = $('#aiprog'); if (p) p.innerHTML = '';
  if (aiState.state === 'ready') toast('IA local pronta');
  if (!sheetEl && (nav.tab === 'ia' || nav.stack.length)) render();
};
DC.onAiProgress = p => {
  const el = $('#aiprog');
  if (el) el.innerHTML = `<div class="mt"><div class="progress"><i style="width:${p}%"></i></div><div class="tiny muted mt">Copiando modelo… ${p}%</div></div>`;
};
DC.onAi = (id, out, err) => {
  const req = pendingAi[id]; delete pendingAi[id];
  if (!req) return;
  if (req.kind === 'voice') {
    const drafts = out ? parseAiJson(out) : [];
    showVoiceResult(req.text, drafts, true);
    return;
  }
  const m = S.chat.find(x => x.reqId === id);
  if (m) { m.text = out ? out.trim() : `Não consegui responder agora (${err || 'erro'}).`; m.think = false; delete m.reqId; }
  save(); if (!sheetEl) render();
};
DC.onNotifPermission = ok => { if (!ok) toast('Sem permissão, os lembretes não aparecem. Ative em Configurações do Android.'); };
DC.onResume = () => { if (!sheetEl && dog()) render(); };

/* ---------------- início ---------------- */
loadState();
try { aiState = JSON.parse(Native.aiStatus()); } catch (e) { /* sem IA */ }
S.chat.forEach(m => { if (m.think) { m.think = false; m.text = 'Resposta interrompida.'; delete m.reqId; } });
render();
scheduleReminders();
