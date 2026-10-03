/* DogCare — registro por voz: frase em português → lista de registros (JSON). */
'use strict';

const NUMWORDS = {
  um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10,
  onze: 11, doze: 12, treze: 13, quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16, dezessete: 17, dezoito: 18, dezenove: 19,
  vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70, oitenta: 80, noventa: 90,
  cem: 100, cento: 100, duzentos: 200, duzentas: 200, trezentos: 300, trezentas: 300, quatrocentos: 400, quinhentos: 500,
};

function normalizeSpeech(text) {
  let s = norm(text)
    .replace(/(\d),(\d)/g, '$1.$2')
    .replace(/\bkg\b|\bquilos?\b|\bkilos?\b/g, ' kg ')
    .replace(/\bgramas?\b|\bgr\b/g, ' g ')
    .replace(/\bmililitros?\b/g, ' ml ')
    .replace(/\blitros?\b/g, ' l ')
    .replace(/\bminutos?\b|\bmin\b/g, ' min ')
    .replace(/\bmeia hora\b/g, '30 min')
    .replace(/\b(uma|1) hora e meia\b/g, '90 min')
    .replace(/\bduas horas\b/g, '120 min')
    .replace(/\b(uma|1) hora\b/g, '60 min');
  // números por extenso compostos: "vinte e cinco" → 25, "cento e vinte" → 120
  s = s.replace(/\b((?:[a-z]+)(?:\s+e\s+[a-z]+)*)\b/g, m => {
    const parts = m.split(/\s+e\s+/);
    if (!parts.every(p => p in NUMWORDS)) {
      return m.split(/\s+/).map(w => (w in NUMWORDS && !['um', 'uma'].includes(w)) ? NUMWORDS[w] : w).join(' ');
    }
    return String(parts.reduce((a, p) => a + NUMWORDS[p], 0));
  });
  s = s.replace(/\b(um|uma)\s+(petisco|biscoito|sache|bifinho|osso|unidade|copo|tigela)/g, '1 $2');
  return s.replace(/\s+/g, ' ').trim();
}

function timeFrom(clause, base) {
  const d = new Date(base);
  let m = clause.match(/\bas (\d{1,2})(?:h|:| horas?)?\s*(\d{2})?/);
  if (m) { d.setHours(+m[1], m[2] ? +m[2] : 0, 0, 0); return d.getTime(); }
  if (/\bde manha|\bcedo\b/.test(clause)) { d.setHours(8, 0, 0, 0); return d.getTime(); }
  if (/\bao meio dia|\balmoco\b/.test(clause)) { d.setHours(12, 0, 0, 0); return d.getTime(); }
  if (/\ba tarde\b|\bde tarde\b/.test(clause)) { d.setHours(15, 0, 0, 0); return d.getTime(); }
  if (/\ba noite\b|\bde noite\b|\bjanta/.test(clause)) { d.setHours(20, 0, 0, 0); return d.getTime(); }
  return null;
}

function matchFood(clause) {
  const foods = [...S.foods].sort((a, b) => b.name.length - a.name.length);
  for (const f of foods) {
    const n = norm(f.name).replace(/\(.*?\)/g, '').trim();
    if (n.length > 2 && clause.includes(n)) return f;
    const first = n.split(' ')[0];
    if (!f.generic && first.length > 3 && clause.includes(first)) return f;
  }
  if (/petisco|biscoito|bifinho|snack|ossinho/.test(clause)) return S.foods.find(f => f.kind === 'petisco');
  if (/sache|umida|patê|pate|lata/.test(clause)) return S.foods.find(f => f.kind === 'umida');
  if (/frango/.test(clause)) return S.foods.find(f => /frango/i.test(f.name));
  if (/cenoura/.test(clause)) return S.foods.find(f => /cenoura/i.test(f.name));
  if (/racao|comida|comeu|refeicao|jant|almo|cafe da manha|tigela|pote/.test(clause)) return mainFood();
  return null;
}

function parseVoice(text, d) {
  const base = Date.now();
  const s = normalizeSpeech(text);
  const clauses = s.split(/,|;|\.|\be depois\b|\bdepois\b|\btambem\b|\be (?=(?:ele|ela|deu|dei|comeu|bebeu|passe|caminh|fez|pesou|pesa|tomou|vomit|tossi|esta|ta |teve))/).map(c => c.trim()).filter(Boolean);
  const out = [];
  for (const c of clauses) {
    const t = timeFrom(c, base) || base;
    const num = re => { const m = c.match(re); return m ? parseFloat(m[1]) : null; };

    // peso
    if (/\bpes(a|ou|ando|o)\b|balanca|\bkg\b/.test(c)) {
      const kg = num(/(\d+(?:\.\d+)?)\s*kg/) ?? num(/pes\w*\D{0,12}(\d+(?:\.\d+)?)/);
      if (kg && kg > 0.3 && kg < 120) { out.push({ type: 'weight', kg, t }); continue; }
    }
    // água
    if (/agua|bebeu|tomou agua/.test(c)) {
      let ml = num(/(\d+(?:\.\d+)?)\s*ml/);
      const l = num(/(\d+(?:\.\d+)?)\s*l\b/);
      if (!ml && l) ml = l * 1000;
      if (!ml) { const cups = num(/(\d+)\s*(?:copos?|tigelas?|potes?)/); if (cups) ml = cups * 250; }
      if (ml) { out.push({ type: 'water', ml: Math.round(ml), t }); continue; }
    }
    // passeio
    if (/passe|caminh|corr(eu|ida)|brinc|trilha|parque/.test(c)) {
      const min = num(/(\d+)\s*min/);
      const kind = /corr|trilha/.test(c) ? 'intensa' : /brinc/.test(c) ? 'moderada' : 'leve';
      out.push({ type: 'walk', min: min || 20, intensity: kind, t, guessed: !min });
      continue;
    }
    // remédio
    if (/remedio|comprimido|medicamento|gotas|capsula|tomou o|tomou a|dei o|dei a/.test(c) && d) {
      const meds = careOf(d.id, 'med');
      const med = meds.find(m => c.includes(norm(m.name).split(' ')[0])) || (meds.length === 1 && /remedio|comprimido|medicamento|gotas|capsula/.test(c) ? meds[0] : null);
      if (med) {
        const pending = dosesOn(d, t).filter(x => x.med.id === med.id && !x.done);
        const slot = pending.length ? pending.reduce((best, x) => {
          const diff = Math.abs(toMin(x.time) - (new Date(t).getHours() * 60 + new Date(t).getMinutes()));
          return !best || diff < best.diff ? { slot: x.time, diff } : best;
        }, null).slot : null;
        out.push({ type: 'dose', medId: med.id, name: med.name, slot, t });
        continue;
      }
    }
    // sintomas
    const syms = [
      [/vomit/, 'vomito'], [/diarreia|coco mole|fezes moles|caganeira/, 'diarreia'], [/tossi|tosse/, 'tosse'],
      [/cocando|coceira|se coca/, 'coceira'], [/mancando|manca\b|mancou/, 'mancando'], [/apatico|desanimado|abatido|prostrado/, 'apatia'],
      [/nao comeu|sem apetite|recusou|nao quis comer/, 'apetite'], [/espirr/, 'espirros'], [/olho/, 'olhos'], [/orelha|ouvido/, 'ouvido'],
    ];
    const sym = syms.find(([re]) => re.test(c));
    if (sym) {
      const level = /muito|varias|forte|sangue/.test(c) ? 3 : /pouco|leve|uma vez/.test(c) ? 1 : 2;
      out.push({ type: 'symptom', sym: sym[1], level, notes: text.length < 140 ? text : '', t });
      if (sym[1] === 'diarreia') out.push({ type: 'potty', poo: true, stool: 'diarreia', t });
      continue;
    }
    // xixi e cocô
    if (/xixi|urinou|coco|fezes|fez as necessidades|evacuou/.test(c)) {
      const pee = /xixi|urinou|necessidades/.test(c);
      const poo = /coco|fezes|necessidades|evacuou/.test(c);
      const stool = /mole|pastos/.test(c) ? 'mole' : /dur|resseca/.test(c) ? 'dura' : 'normal';
      out.push({ type: 'potty', pee, poo, stool: poo ? stool : null, t });
      continue;
    }
    // refeição
    const food = matchFood(c);
    if (food) {
      let g = num(/(\d+(?:\.\d+)?)\s*g\b/);
      const units = num(/(\d+)\s*(?:petiscos?|biscoitos?|saches?|bifinhos?|unidades?|pedacos?|ossinhos?|cenouras?)/);
      if (!g && units && food.unitG) g = units * food.unitG;
      if (!g) { const cups = num(/(\d+(?:\.\d+)?)\s*(?:xicaras?|copos? medidores?|medidas?|potes?)/); if (cups) g = cups * 100; }
      if (!g && /meia (xicara|medida|tigela)/.test(c)) g = 50;
      out.push({ type: 'meal', foodId: food.id, name: food.name, g: g ? Math.round(g) : null, units: units || null, t, guessed: !g });
      continue;
    }
  }
  return out;
}
const toMin = hm => { const [h, m] = hm.split(':').map(Number); return h * 60 + (m || 0); };

/* Prompt para a IA local interpretar a frase quando o parser não entende. */
function voicePrompt(text) {
  const foods = S.foods.map(f => `${f.id}=${f.name}`).join('; ');
  return `<start_of_turn>user
Converta a frase sobre um cachorro em JSON. Responda SOMENTE com um array JSON.
Tipos: {"type":"meal","foodId":ID,"g":gramas} {"type":"water","ml":N} {"type":"walk","min":N} {"type":"weight","kg":N} {"type":"potty","pee":bool,"poo":bool,"stool":"normal|mole|dura|diarreia"} {"type":"symptom","sym":"vomito|diarreia|apetite|apatia|tosse|espirros|coceira|mancando|olhos|ouvido|outro","level":1-3}
Alimentos: ${foods}
Frase: "${text}"<end_of_turn>
<start_of_turn>model
`;
}
function parseAiJson(out) {
  try {
    const m = out.match(/\[[\s\S]*\]/);
    if (!m) return [];
    const arr = JSON.parse(m[0]);
    const now = Date.now();
    return arr.filter(x => x && x.type).map(x => {
      x.t = now;
      if (x.type === 'meal') { const f = foodById(x.foodId) || mainFood(); x.foodId = f.id; x.name = f.name; }
      return x;
    });
  } catch (e) { return []; }
}
