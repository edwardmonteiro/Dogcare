/* DogCare — núcleo: ponte nativa, armazenamento, cálculos e conhecimento. */
'use strict';

/* ---------------- ponte nativa (com simulação para navegador) ---------------- */
const NATIVE = typeof window.Android !== 'undefined';
const Native = NATIVE ? window.Android : (() => {
  const ls = window.localStorage;
  return {
    load: () => ls.getItem('dogcare') || '',
    save: s => { ls.setItem('dogcare', s); return true; },
    savePhoto: (id, d) => { ls.setItem('ph_' + id, d); return true; },
    getPhoto: id => ls.getItem('ph_' + id) || '',
    deletePhoto: id => ls.removeItem('ph_' + id),
    setBars: () => {},
    startVoice: () => setTimeout(() => {
      const t = window.prompt('Simulação de voz — digite a frase:', 'comeu 120 gramas de ração e passeou 30 minutos');
      DC.onVoice(t, null);
    }, 50),
    exportFile: (name, content) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
      a.download = name; a.click(); DC.toast('Backup salvo');
    },
    importFile: () => {
      const i = document.createElement('input'); i.type = 'file';
      i.onchange = () => { const r = new FileReader(); r.onload = () => DC.onImport(r.result); r.readAsText(i.files[0]); };
      i.click();
    },
    openUrl: u => window.open(u, '_blank'),
    schedule: j => { window.__scheduled = JSON.parse(j); },
    requestNotifications: () => {},
    notificationsAllowed: () => true,
    version: () => 'web',
    aiStatus: () => JSON.stringify(window.__aiMock ? { state: 'ready', model: 'simulado.task' } : { state: 'none', model: '' }),
    aiPickModel: () => { window.__aiMock = true; DC.onAiStatus({ state: 'ready', model: 'simulado.task' }); },
    aiRemove: () => { window.__aiMock = false; DC.onAiStatus({ state: 'none' }); },
    aiModelFolder: () => '/storage/emulated/0/Android/data/com.edward.dogcare/files',
    aiAsk: (id, p) => setTimeout(() => DC.onAi(id, '(Resposta simulada da IA local.)', null), 600),
  };
})();

/* ---------------- utilidades ---------------- */
const DAY = 86400000;
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const round = (v, d = 0) => { const p = 10 ** d; return Math.round(v * p) / p; };
const nf = (v, d = 0) => (v == null || isNaN(v)) ? '–' : Number(v).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
const pad = n => String(n).padStart(2, '0');
const dayKey = t => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const monthKey = t => dayKey(t).slice(0, 7);
const parseDay = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d).getTime(); };
const startOfDay = t => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
const addDays = (t, n) => { const d = new Date(t); d.setDate(d.getDate() + n); return d.getTime(); };
const daysBetween = (a, b) => Math.round((startOfDay(b) - startOfDay(a)) / DAY);
const hhmm = t => { const d = new Date(t); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const fmtDate = t => { const d = new Date(t); return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };
const fmtShort = t => { const d = new Date(t); return `${d.getDate()} ${MONTHS[d.getMonth()]}`; };
function relDay(t) {
  const n = daysBetween(Date.now(), t);
  if (n === 0) return 'hoje';
  if (n === 1) return 'amanhã';
  if (n === -1) return 'ontem';
  if (n > 1) return n < 60 ? `em ${n} dias` : fmtShort(t);
  return -n < 60 ? `há ${-n} dias` : fmtShort(t);
}
function ageMonths(birth) {
  if (!birth) return null;
  const b = new Date(parseDay(birth)), n = new Date();
  let m = (n.getFullYear() - b.getFullYear()) * 12 + (n.getMonth() - b.getMonth());
  if (n.getDate() < b.getDate()) m--;
  return Math.max(0, m);
}
function ageLabel(birth) {
  const m = ageMonths(birth);
  if (m == null) return '';
  if (m < 1) return 'recém-nascido';
  if (m < 12) return `${m} ${m === 1 ? 'mês' : 'meses'}`;
  const y = Math.floor(m / 12), r = m % 12;
  return `${y} ${y === 1 ? 'ano' : 'anos'}${r ? ` e ${r} ${r === 1 ? 'mês' : 'meses'}` : ''}`;
}

/* ---------------- conhecimento ---------------- */
const SIZES = [
  ['mini', 'Mini', 'até 5 kg'], ['pequeno', 'Pequeno', '5–10 kg'], ['medio', 'Médio', '10–25 kg'],
  ['grande', 'Grande', '25–45 kg'], ['gigante', 'Gigante', 'acima de 45 kg'],
];
const FOOD_KINDS = [['seca', 'Ração seca'], ['umida', 'Ração úmida'], ['petisco', 'Petisco'], ['natural', 'Natural / caseiro']];
const seedFoods = () => [
  { id: 'f_seca', name: 'Ração seca (média)', kind: 'seca', kcal100: 360, unitG: 0, main: true, generic: true },
  { id: 'f_umida', name: 'Sachê / ração úmida (média)', kind: 'umida', kcal100: 90, unitG: 100, main: false, generic: true },
  { id: 'f_petisco', name: 'Petisco (média)', kind: 'petisco', kcal100: 320, unitG: 5, main: false, generic: true },
  { id: 'f_frango', name: 'Frango cozido sem pele', kind: 'natural', kcal100: 165, unitG: 0, main: false, generic: true },
  { id: 'f_cenoura', name: 'Cenoura', kind: 'natural', kcal100: 41, unitG: 10, main: false, generic: true },
];

const VACCINES = [
  { id: 'polivalente', name: 'Polivalente (V8/V10)', days: 365 },
  { id: 'raiva', name: 'Antirrábica', days: 365 },
  { id: 'gripe', name: 'Gripe canina', days: 365 },
  { id: 'giardia', name: 'Giárdia', days: 365 },
  { id: 'leish', name: 'Leishmaniose', days: 365 },
];
const PARASITES = [
  { id: 'vermifugo', name: 'Vermífugo', days: 90 },
  { id: 'pulgas', name: 'Pulgas e carrapatos', days: 30 },
];
const SYMPTOMS = [
  ['vomito', 'Vômito'], ['diarreia', 'Diarreia'], ['apetite', 'Sem apetite'], ['apatia', 'Apatia'],
  ['tosse', 'Tosse'], ['espirros', 'Espirros'], ['coceira', 'Coceira'], ['mancando', 'Mancando'],
  ['olhos', 'Olhos'], ['ouvido', 'Ouvido'], ['outro', 'Outro'],
];
const symName = id => (SYMPTOMS.find(s => s[0] === id) || [0, 'Sintoma'])[1];

const RADAR_AXES = [
  ['energia', 'Energia'], ['apetite', 'Apetite'], ['pelagem', 'Pelagem'], ['mobilidade', 'Mobilidade'],
  ['digestao', 'Digestão'], ['sono', 'Sono'], ['humor', 'Humor'],
];
const SKILLS = [
  { g: 'Comandos', items: [['nome', 'Atende pelo nome'], ['senta', 'Senta'], ['deita', 'Deita'], ['fica', 'Fica'], ['vem', 'Vem quando chamado'], ['junto', 'Anda junto na guia'], ['solta', 'Solta / larga'], ['espera', 'Espera na porta']] },
  { g: 'Manejo e hábitos', items: [['banheiro', 'Xixi no lugar certo'], ['escova', 'Aceita escovação dental'], ['unhas', 'Aceita corte de unhas'], ['banho', 'Tranquilo no banho'], ['caixa', 'Caixa de transporte'], ['sozinho', 'Fica sozinho com calma'], ['exame', 'Aceita ser examinado']] },
  { g: 'Socialização', items: [['pessoas', 'Pessoas desconhecidas'], ['caes', 'Outros cães'], ['criancas', 'Crianças'], ['sons', 'Barulhos e fogos'], ['carro', 'Andar de carro'], ['vet', 'Ida ao veterinário']] },
];
const LEVELS = ['Não iniciado', 'Apresentado', 'Às vezes', 'Com ajuda', 'Quase sempre', 'Dominado'];

const BCS = {
  1: 'Muito magro', 2: 'Muito magro', 3: 'Magro', 4: 'Ideal', 5: 'Ideal', 6: 'Acima do peso', 7: 'Acima do peso', 8: 'Obeso', 9: 'Obeso',
};

const TOXIC = [
  { k: ['chocolate', 'cacau', 'achocolatado', 'brigadeiro', 'nescau'], lvl: 'bad', t: 'Chocolate', d: 'Teobromina e cafeína causam vômito, agitação, arritmia e convulsão. Quanto mais amargo, pior.' },
  { k: ['uva', 'passa', 'uva passa'], lvl: 'bad', t: 'Uva e uva-passa', d: 'Podem causar insuficiência renal aguda, mesmo em pouca quantidade.' },
  { k: ['xilitol', 'chiclete', 'bala', 'diet', 'sem acucar', 'pasta de dente', 'adocante'], lvl: 'bad', t: 'Xilitol', d: 'Causa hipoglicemia grave e lesão no fígado. Confira o rótulo de doces diet, chicletes e pastas de amendoim.' },
  { k: ['cebola', 'alho', 'cebolinha', 'alho poro', 'tempero', 'sazon'], lvl: 'bad', t: 'Cebola, alho e cebolinha', d: 'Destroem hemácias e causam anemia, cruas, cozidas ou em pó.' },
  { k: ['macadamia'], lvl: 'bad', t: 'Macadâmia', d: 'Fraqueza, tremores e febre.' },
  { k: ['alcool', 'cerveja', 'vinho', 'cachaca'], lvl: 'bad', t: 'Álcool', d: 'Intoxicação grave mesmo em doses pequenas.' },
  { k: ['cafe', 'cafeina', 'energetico', 'cha preto', 'mate', 'guarana'], lvl: 'bad', t: 'Café e cafeína', d: 'Agitação, coração acelerado e tremores.' },
  { k: ['massa crua', 'fermento', 'massa de pao'], lvl: 'bad', t: 'Massa crua com fermento', d: 'Cresce no estômago e produz álcool.' },
  { k: ['paracetamol', 'ibuprofeno', 'remedio humano', 'anti inflamatorio', 'aspirina', 'tylenol'], lvl: 'bad', t: 'Remédios de gente', d: 'Paracetamol e ibuprofeno são muito tóxicos para cães. Só dê o que o veterinário prescrever.' },
  { k: ['osso cozido', 'osso de frango', 'osso'], lvl: 'warn', t: 'Ossos cozidos', d: 'Lascam e podem perfurar ou obstruir o intestino.' },
  { k: ['abacate'], lvl: 'warn', t: 'Abacate', d: 'O caroço obstrui; casca e folhas têm persina. Melhor evitar.' },
  { k: ['leite', 'queijo', 'sorvete', 'iogurte'], lvl: 'warn', t: 'Leite e laticínios', d: 'Muitos cães não digerem lactose e têm diarreia. Queijo magro em pouca quantidade costuma ser tolerado.' },
  { k: ['noz moscada', 'nozes', 'castanha'], lvl: 'warn', t: 'Nozes e castanhas', d: 'Gordurosas e podem ter mofo; noz-moscada é tóxica.' },
  { k: ['sal', 'salgadinho', 'embutido', 'presunto', 'salsicha', 'bacon', 'linguica', 'pizza'], lvl: 'warn', t: 'Salgados, embutidos e gordura', d: 'Excesso de sal e gordura pode causar pancreatite.' },
  { k: ['carne crua', 'frango cru', 'ovo cru', 'cru'], lvl: 'warn', t: 'Alimentos crus', d: 'Risco de Salmonella e outras bactérias. Prefira cozido e sem tempero.' },
  { k: ['caroco', 'semente', 'pessego', 'ameixa', 'cereja'], lvl: 'warn', t: 'Caroços e sementes', d: 'Obstruem e alguns têm compostos tóxicos. Ofereça só a polpa.' },
];
const SAFE = ['cenoura', 'abobora', 'maca', 'banana', 'melancia', 'mamao', 'pera', 'manga', 'frango cozido', 'frango', 'carne cozida', 'carne magra', 'peixe cozido', 'arroz', 'ovo cozido', 'ovo', 'batata doce', 'vagem', 'pepino', 'brocolis', 'mirtilo', 'morango', 'chuchu', 'abobrinha', 'quiabo', 'couve'];

function foodCheck(q) {
  const n = norm(q);
  if (n.length < 2) return null;
  const bad = TOXIC.find(x => x.k.some(k => n.includes(k) || (k.length > 3 && k.includes(n))));
  if (bad) return bad;
  const ok = SAFE.find(s => n.includes(s) || (n.length > 2 && s.startsWith(n)));
  if (ok) return { lvl: 'good', t: q.trim(), d: 'Pode, em pequenas porções, cozido quando for o caso e sem tempero. Retire sementes e caroços. Petiscos devem ficar abaixo de 10% das calorias do dia.' };
  return { lvl: 'unknown', t: q.trim(), d: 'Não está na minha lista. Na dúvida, não ofereça e pergunte ao veterinário.' };
}

const RED_FLAGS = [
  { k: ['respira', 'falta de ar', 'ofegante', 'lingua roxa', 'sufoc'], m: 'Dificuldade para respirar' },
  { k: ['barriga inchada', 'barriga dura', 'abdomen distendido', 'abdomen inchado', 'barriga estufada'], m: 'Barriga inchada ou dura (risco de torção gástrica)' },
  { k: ['tenta vomitar', 'ansia sem', 'nao consegue vomitar', 'vomitar e nao sai'], m: 'Tenta vomitar e não sai nada' },
  { k: ['convuls', 'ataque', 'tremendo muito', 'debatendo'], m: 'Convulsão' },
  { k: ['desmai', 'colapso', 'caiu e nao levanta', 'nao levanta'], m: 'Desmaio ou colapso' },
  { k: ['sangrando', 'sangramento', 'hemorragia'], m: 'Sangramento' },
  { k: ['gengiva branca', 'gengiva palida', 'gengiva roxa', 'gengiva azul'], m: 'Gengiva pálida, branca ou arroxeada' },
  { k: ['nao urina', 'nao faz xixi', 'sem urinar', 'esforco para urinar'], m: 'Não consegue urinar' },
  { k: ['atropel', 'queda', 'mordido', 'briga'], m: 'Trauma (atropelamento, queda, mordida)' },
  { k: ['comeu chocolate', 'comeu uva', 'xilitol', 'veneno', 'chumbinho', 'raticida', 'comeu remedio', 'paracetamol', 'ibuprofeno', 'intoxic', 'envenen'], m: 'Possível intoxicação' },
  { k: ['vomito com sangue', 'vomitando sangue', 'fezes com sangue', 'coco com sangue', 'diarreia com sangue'], m: 'Sangue no vômito ou nas fezes' },
  { k: ['insolacao', 'calor demais', 'hipertermia'], m: 'Superaquecimento' },
];
function redFlags(text) {
  const n = norm(text);
  return RED_FLAGS.filter(f => f.k.some(k => n.includes(k))).map(f => f.m);
}

const TIPS = [
  'Antes do passeio, encoste o dorso da mão no asfalto por 7 segundos. Se não aguentar, está quente demais para as patas.',
  'Petiscos devem somar no máximo 10% das calorias do dia. Pedaços de cenoura são uma troca leve.',
  'Escovar os dentes algumas vezes por semana previne tártaro e doença periodontal, comum depois dos 3 anos.',
  'Cheirar cansa. Dez minutos de farejar petiscos espalhados valem por um passeio curto em dia de chuva.',
  'Água fresca o dia todo: em média um cão bebe cerca de 50 ml por kg por dia, mais no calor e após exercício.',
  'Unhas que fazem "tec-tec" no piso estão compridas. Aparar aos poucos evita atingir o sabugo.',
  'Pese seu cão uma vez por mês. Mudanças de 5% ou mais sem motivo merecem conversa com o veterinário.',
  'Para avaliar o peso: você deve sentir as costelas sem apertar e enxergar a cintura olhando de cima.',
  'Trocas de ração devem levar de 7 a 10 dias, misturando a nova à antiga aos poucos.',
  'Cães idosos se beneficiam de exames de rotina a cada 6 meses.',
  'Brinquedos recheados e tapetes de lamber ajudam cães que ficam ansiosos sozinhos.',
  'Fogos: prepare um canto escuro e abafado com antecedência e mantenha portas e portões fechados.',
  'Sessões de treino curtas, de 3 a 5 minutos, rendem mais do que uma sessão longa.',
  'Leve a carteira de vacinação em viagens e mantenha a plaquinha com telefone na coleira.',
  'Mudanças de apetite, sede ou xixi costumam ser os primeiros sinais de doença. Anote no app.',
];

/* ---------------- estado ---------------- */
const DEFAULT = () => ({
  v: 1,
  settings: { theme: 'auto', activeDog: null, reminderHour: 9, notif: true },
  dogs: [], foods: seedFoods(), entries: [], care: [], radar: [], skills: {}, team: [], chat: [],
});
let S = DEFAULT();

function loadState() {
  try {
    const raw = Native.load();
    if (raw) {
      const d = JSON.parse(raw);
      S = Object.assign(DEFAULT(), d);
      S.settings = Object.assign(DEFAULT().settings, d.settings || {});
    }
  } catch (e) { console.error(e); }
}
let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 120);
}
function flush() {
  clearTimeout(saveTimer);
  Native.save(JSON.stringify(S));
  scheduleReminders();
}

const dog = () => S.dogs.find(d => d.id === S.settings.activeDog) || S.dogs[0] || null;
const entriesOf = (dogId, type) => S.entries.filter(e => e.dogId === dogId && (!type || e.type === type));
const careOf = (dogId, kind) => S.care.filter(c => c.dogId === dogId && (!kind || c.kind === kind));
const foodById = id => S.foods.find(f => f.id === id);
const mainFood = () => S.foods.find(f => f.main) || S.foods.find(f => f.kind === 'seca') || S.foods[0];

/* ---------------- cálculos ---------------- */
function latestWeight(d) {
  const w = entriesOf(d.id, 'weight').sort((a, b) => b.t - a.t)[0];
  return w ? w.kg : (d.weight || null);
}
function weightSeries(d) {
  return entriesOf(d.id, 'weight').sort((a, b) => a.t - b.t).map(e => ({ t: e.t, y: e.kg }));
}
function weightChange(d, days = 30) {
  const s = weightSeries(d);
  if (s.length < 2) return null;
  const last = s[s.length - 1];
  const ref = [...s].reverse().find(p => last.t - p.t >= days * DAY * 0.6);
  if (!ref) return null;
  return { kg: last.y - ref.y, pct: (last.y - ref.y) / ref.y * 100, days: daysBetween(ref.t, last.t) };
}
const isPuppy = d => { const m = ageMonths(d.birth); if (m == null) return false; const lim = (d.size === 'grande' || d.size === 'gigante') ? 18 : 12; return m < lim; };
const isSenior = d => { const m = ageMonths(d.birth); if (m == null) return false; const lim = (d.size === 'grande' || d.size === 'gigante') ? 84 : 96; return m >= lim; };

const FACTORS = [
  ['auto', 'Automático', null],
  ['f30', 'Filhote até 4 meses', 3.0],
  ['f20', 'Filhote 4 meses até adulto', 2.0],
  ['castrado', 'Adulto castrado', 1.6],
  ['inteiro', 'Adulto não castrado', 1.8],
  ['pouco', 'Pouco ativo ou tende a engordar', 1.4],
  ['senior', 'Idoso', 1.4],
  ['perda', 'Perda de peso', 1.0],
  ['ativo', 'Muito ativo / atleta', 2.5],
];
function energy(d) {
  const w = latestWeight(d);
  if (!w) return null;
  let label, factor;
  const ov = FACTORS.find(f => f[0] === d.factor && f[2]);
  const months = ageMonths(d.birth);
  const calcW = (d.goal === 'perder' && d.idealWeight) ? d.idealWeight : w;
  if (ov) { factor = ov[2]; label = ov[1]; }
  else if (d.goal === 'perder') { factor = 1.0; label = 'Perda de peso (sobre o peso ideal)'; }
  else if (months != null && months < 4) { factor = 3.0; label = 'Filhote até 4 meses'; }
  else if (isPuppy(d)) { factor = 2.0; label = 'Filhote em crescimento'; }
  else if (isSenior(d)) { factor = 1.4; label = 'Idoso'; }
  else if (d.activity === 'alta') { factor = 2.0; label = 'Adulto ativo'; }
  else if (d.activity === 'baixa') { factor = 1.4; label = 'Adulto pouco ativo'; }
  else { factor = d.neutered ? 1.6 : 1.8; label = d.neutered ? 'Adulto castrado' : 'Adulto não castrado'; }
  if (d.goal === 'ganhar' && !ov) { factor = round(factor * 1.15, 2); label += ', ganho de peso'; }
  const rer = 70 * Math.pow(calcW, 0.75);
  return { weight: w, calcW, rer: Math.round(rer), factor, mer: Math.round(rer * factor / 5) * 5, label };
}
const kcalOf = e => e.kcal != null ? e.kcal : (() => { const f = foodById(e.foodId); return f ? f.kcal100 * (e.g || 0) / 100 : 0; })();
function kcalOnDay(d, key) {
  return entriesOf(d.id, 'meal').filter(e => dayKey(e.t) === key).reduce((s, e) => s + kcalOf(e), 0);
}
function sumOnDay(d, type, field, key) {
  return entriesOf(d.id, type).filter(e => dayKey(e.t) === key).reduce((s, e) => s + (e[field] || 0), 0);
}
function lastDays(n) { const out = []; for (let i = n - 1; i >= 0; i--) out.push(dayKey(addDays(Date.now(), -i))); return out; }
function treatShare(d, days = 7) {
  const keys = new Set(lastDays(days));
  let tot = 0, tr = 0;
  entriesOf(d.id, 'meal').filter(e => keys.has(dayKey(e.t))).forEach(e => {
    const k = kcalOf(e); tot += k;
    const f = foodById(e.foodId); if (f && f.kind === 'petisco') tr += k;
  });
  return tot ? tr / tot : 0;
}
function walkTarget(d) {
  const m = ageMonths(d.birth);
  if (isPuppy(d) && m != null) return clamp(m * 5 * 2, 10, 60);
  if (isSenior(d)) return 30;
  return { mini: 30, pequeno: 40, medio: 60, grande: 75, gigante: 50 }[d.size] || 45;
}
const waterTarget = d => { const w = latestWeight(d); return w ? Math.round(w * 50 / 10) * 10 : null; };

/* ---------------- cuidados e prazos ---------------- */
function lastCare(dogId, kind, type) {
  return careOf(dogId, kind).filter(c => c.type === type).sort((a, b) => parseDay(b.date) - parseDay(a.date))[0];
}
function careStatus(rec) {
  if (!rec) return { cls: '', label: 'Sem registro', days: null };
  if (!rec.next) return { cls: 'good', label: 'Registrado', days: null };
  const n = daysBetween(Date.now(), parseDay(rec.next));
  if (n < 0) return { cls: 'bad', label: `Atrasada ${-n} d`, days: n };
  if (n <= 14) return { cls: 'warn', label: n === 0 ? 'Vence hoje' : `Vence em ${n} d`, days: n };
  return { cls: 'good', label: 'Em dia', days: n };
}
function dueItems(d, horizon = 30) {
  const out = [];
  const push = (kind, def) => {
    const rec = lastCare(d.id, kind, def.id);
    if (!rec || !rec.next) return;
    const n = daysBetween(Date.now(), parseDay(rec.next));
    if (n <= horizon) out.push({ kind, name: rec.name || def.name, next: parseDay(rec.next), days: n });
  };
  VACCINES.forEach(v => push('vaccine', v));
  PARASITES.forEach(p => push('parasite', p));
  careOf(d.id, 'vaccine').filter(c => c.type === 'outra' && c.next).forEach(c => {
    const n = daysBetween(Date.now(), parseDay(c.next));
    if (n <= horizon) out.push({ kind: 'vaccine', name: c.name, next: parseDay(c.next), days: n });
  });
  return out.sort((a, b) => a.next - b.next);
}
function medActiveOn(m, t) {
  if (m.paused) return false;
  const k = dayKey(t);
  if (m.start && k < m.start) return false;
  if (m.end && k > m.end) return false;
  const every = m.every || 1;
  return m.start ? daysBetween(parseDay(m.start), t) % every === 0 : true;
}
function dosesOn(d, t) {
  const k = dayKey(t);
  const given = entriesOf(d.id, 'dose').filter(e => dayKey(e.t) === k);
  const out = [];
  careOf(d.id, 'med').forEach(m => {
    if (!medActiveOn(m, t)) return;
    (m.times || []).forEach(time => {
      const done = given.find(g => g.medId === m.id && g.slot === time);
      out.push({ med: m, time, done });
    });
  });
  return out.sort((a, b) => a.time.localeCompare(b.time));
}

/* ---------------- lembretes nativos ---------------- */
function scheduleReminders() {
  if (!S.settings.notif) { Native.schedule('[]'); return; }
  const list = [];
  const H = S.settings.reminderHour || 9;
  const now = Date.now();
  S.dogs.forEach(d => {
    dueItems(d, 400).forEach(it => {
      const at = it.next + H * 3600000;
      list.push({ id: `${d.id}_${it.kind}_${it.name}_0`, at, title: `${it.name} de ${d.name}`, body: `Vence hoje. Toque para registrar quando aplicar.` });
      list.push({ id: `${d.id}_${it.kind}_${it.name}_3`, at: at - 3 * DAY, title: `${it.name} de ${d.name}`, body: `Vence em 3 dias (${fmtShort(it.next)}).` });
    });
    for (let i = 0; i < 3; i++) {
      const day = addDays(startOfDay(now), i);
      careOf(d.id, 'med').forEach(m => {
        if (!medActiveOn(m, day)) return;
        (m.times || []).forEach(time => {
          const [h, mi] = time.split(':').map(Number);
          list.push({ id: `${d.id}_med_${m.id}_${dayKey(day)}_${time}`, at: day + (h * 60 + (mi || 0)) * 60000, title: `${m.name} · ${d.name}`, body: `${m.dose ? m.dose + ' · ' : ''}horário das ${time}` });
        });
      });
    }
  });
  Native.schedule(JSON.stringify(list.filter(x => x.at > now).sort((a, b) => a.at - b.at).slice(0, 150)));
}

/* ---------------- insights ---------------- */
function insights(d) {
  const out = [];
  const en = energy(d);
  const keys7 = lastDays(7);
  const hour = new Date().getHours();
  dueItems(d, 14).forEach(it => {
    if (it.days < 0) out.push({ lvl: 'bad', text: `${it.name} está atrasada há ${-it.days} ${-it.days === 1 ? 'dia' : 'dias'}.` });
    else out.push({ lvl: 'warn', text: `${it.name} vence ${relDay(it.next)}.` });
  });
  const recentSym = entriesOf(d.id, 'symptom').filter(e => Date.now() - e.t < 2 * DAY);
  const bySym = {};
  recentSym.forEach(e => { bySym[e.sym] = (bySym[e.sym] || 0) + 1; });
  Object.entries(bySym).forEach(([s, n]) => {
    if (n >= 2 || recentSym.some(e => e.sym === s && e.level >= 3)) out.push({ lvl: 'bad', text: `${symName(s)} repetido ou forte nas últimas 48 h. Vale ligar para o veterinário.` });
  });
  if (en) {
    const days = keys7.slice(0, 6).map(k => kcalOnDay(d, k)).filter(v => v > 0);
    if (days.length >= 4) {
      const avg = days.reduce((a, b) => a + b, 0) / days.length;
      if (avg > en.mer * 1.1) out.push({ lvl: 'warn', text: `Média de ${nf(avg)} kcal por dia na semana, ${nf((avg / en.mer - 1) * 100)}% acima da meta.` });
      else if (avg < en.mer * 0.75) out.push({ lvl: 'warn', text: `Média de ${nf(avg)} kcal por dia, bem abaixo da meta. Confira se tudo está sendo registrado.` });
      else out.push({ lvl: 'good', text: `Alimentação da semana dentro da meta: média de ${nf(avg)} kcal por dia.` });
    }
    const today = kcalOnDay(d, dayKey(Date.now()));
    if (hour >= 19 && today > en.mer * 1.15) out.push({ lvl: 'warn', text: `Hoje já passou ${nf((today / en.mer - 1) * 100)}% da meta de calorias.` });
  }
  const ts = treatShare(d);
  if (ts > 0.1) out.push({ lvl: 'warn', text: `Petiscos foram ${nf(ts * 100)}% das calorias da semana. O recomendado é até 10%.` });
  const wc = weightChange(d, 30);
  if (wc && !isPuppy(d) && Math.abs(wc.pct) >= 5) out.push({ lvl: 'warn', text: `Peso ${wc.pct > 0 ? 'subiu' : 'caiu'} ${nf(Math.abs(wc.pct), 1)}% em ${wc.days} dias.` });
  const w = latestWeight(d);
  if (w && d.idealWeight && !isPuppy(d)) {
    const p = (w / d.idealWeight - 1) * 100;
    if (p > 10) out.push({ lvl: 'warn', text: `${nf(p)}% acima do peso ideal de ${nf(d.idealWeight, 1)} kg.` });
    else if (p < -10) out.push({ lvl: 'warn', text: `${nf(-p)}% abaixo do peso ideal de ${nf(d.idealWeight, 1)} kg.` });
  }
  const walks = keys7.map(k => sumOnDay(d, 'walk', 'min', k));
  const withData = entriesOf(d.id, 'walk').some(e => Date.now() - e.t < 7 * DAY);
  if (withData) {
    const avg = walks.reduce((a, b) => a + b, 0) / 7;
    if (avg < walkTarget(d) * 0.6) out.push({ lvl: 'warn', text: `Média de ${nf(avg)} min de passeio por dia. A referência para ${d.name} é cerca de ${walkTarget(d)} min.` });
  }
  const lastW = entriesOf(d.id, 'weight').sort((a, b) => b.t - a.t)[0];
  if (!lastW || Date.now() - lastW.t > 30 * DAY) out.push({ lvl: 'info', text: 'Faz mais de um mês sem pesar. Uma pesagem por mês ajuda a ver tendências.' });
  if (!S.radar.find(r => r.dogId === d.id && r.month === monthKey(Date.now())) && new Date().getDate() >= 20)
    out.push({ lvl: 'info', text: 'Falta a avaliação de bem-estar deste mês, em Evolução.' });
  const mf = mainFood();
  if (mf && mf.generic && entriesOf(d.id, 'meal').length > 3) out.push({ lvl: 'info', text: 'Cadastre a ração com as calorias da embalagem para a meta ficar precisa.' });
  if (d.birth) {
    const b = new Date(parseDay(d.birth)); const n = new Date();
    const next = new Date(n.getFullYear(), b.getMonth(), b.getDate());
    const dd = daysBetween(n.getTime(), next.getTime());
    if (dd >= 0 && dd <= 7) out.push({ lvl: 'good', text: dd === 0 ? `Hoje é aniversário de ${d.name}!` : `Aniversário de ${d.name} ${relDay(next.getTime())}.` });
  }
  const order = { bad: 0, warn: 1, info: 2, good: 3 };
  return out.sort((a, b) => order[a.lvl] - order[b.lvl]);
}

/* ---------------- resumo para a IA ---------------- */
function dogContext(d) {
  const en = energy(d);
  const lines = [];
  lines.push(`Nome: ${d.name}. Raça: ${d.breed || 'não informada'}. Sexo: ${d.sex === 'f' ? 'fêmea' : 'macho'}, ${d.neutered ? 'castrado(a)' : 'não castrado(a)'}. Idade: ${ageLabel(d.birth) || 'não informada'}. Porte: ${d.size || '?'}.`);
  const w = latestWeight(d);
  lines.push(`Peso atual: ${w ? nf(w, 1) + ' kg' : 'sem registro'}${d.idealWeight ? `; peso ideal ${nf(d.idealWeight, 1)} kg` : ''}. Objetivo: ${d.goal || 'manter'}.`);
  const wc = weightChange(d, 30); if (wc) lines.push(`Variação de peso em ${wc.days} dias: ${nf(wc.pct, 1)}%.`);
  const bcs = entriesOf(d.id, 'weight').filter(e => e.bcs).sort((a, b) => b.t - a.t)[0];
  if (bcs) lines.push(`Escore corporal: ${bcs.bcs}/9.`);
  if (en) lines.push(`Meta: ${en.mer} kcal/dia (RER ${en.rer} × ${en.factor}, ${en.label}).`);
  const kc = lastDays(7).map(k => Math.round(kcalOnDay(d, k)));
  lines.push(`Calorias nos últimos 7 dias: ${kc.join(', ')}. Petiscos: ${nf(treatShare(d) * 100)}% das calorias.`);
  const wk = lastDays(7).map(k => sumOnDay(d, 'walk', 'min', k));
  lines.push(`Passeio por dia (min), 7 dias: ${wk.join(', ')}. Referência: ${walkTarget(d)} min.`);
  const due = dueItems(d, 60);
  if (due.length) lines.push('Cuidados a vencer: ' + due.map(x => `${x.name} ${relDay(x.next)}`).join('; ') + '.');
  const meds = careOf(d.id, 'med').filter(m => medActiveOn(m, Date.now()));
  if (meds.length) lines.push('Remédios em uso: ' + meds.map(m => `${m.name} ${m.dose || ''} (${(m.times || []).join(', ')})`).join('; ') + '.');
  const sy = entriesOf(d.id, 'symptom').filter(e => Date.now() - e.t < 14 * DAY).sort((a, b) => b.t - a.t);
  if (sy.length) lines.push('Sintomas em 14 dias: ' + sy.map(e => `${symName(e.sym)} (${relDay(e.t)}${e.notes ? ', ' + e.notes : ''})`).join('; ') + '.');
  const r = S.radar.filter(x => x.dogId === d.id).sort((a, b) => b.month.localeCompare(a.month))[0];
  if (r) lines.push(`Bem-estar (${r.month}, 0 a 5): ` + RADAR_AXES.map(a => `${a[1]} ${r.scores[a[0]] ?? '-'}`).join(', ') + '.');
  return lines.join('\n');
}
