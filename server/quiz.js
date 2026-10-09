// Pubquizen på Filicia: åtta frågor per vecka, samma för alla. Med AI skriver Claude Haiku nya
// frågor en gång i veckan, annars väljs de ur listan nedan. Poängen sparas per vecka.
'use strict';
const str = (v, n) =>
  String(v ?? '')
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .trim()
    .slice(0, n);
const ANTAL = 8;

// Reservfrågor: [fråga, rätt svar, fel, fel, fel]
const RESERV = [
  ['Vilket år brann staden Vasa ner?', '1852', '1809', '1918', '1867'],
  ['Vad hette Vasa mellan 1855 och 1917?', 'Nikolaistad', 'Korsholm', 'Mustasaari', 'Kristinestad'],
  ['Vilket år fick Vasa sina stadsrättigheter?', '1606', '1640', '1550', '1721'],
  ['Vilket världsarv ligger alldeles nära Vasa?', 'Kvarkens skärgård', 'Sveaborg', 'Gamla Raumo', 'Petäjävesi kyrka'],
  ['Vad heter rederiet som kör färjan mellan Vasa och Umeå?', 'Wasaline', 'Viking Line', 'Tallink Silja', 'Finnlines'],
  ['Vilken bro nära Vasa är Finlands längsta?', 'Replotbron', 'Kirjalansalmibron', 'Lauttasaaribron', 'Tähtiniemibron'],
  ['Ungefär hur många bor i Vasa?', 'Runt 68 000', 'Runt 25 000', 'Runt 140 000', 'Runt 250 000'],
  ['Vilken sport spelar Vasa Sport?', 'Ishockey', 'Fotboll', 'Bandy', 'Innebandy'],
  ['Vad heter Vasas mest kända fotbollslag?', 'VPS', 'HJK', 'KuPS', 'SJK'],
  ['Vilken stad är huvudort i landskapet Österbotten?', 'Vasa', 'Seinäjoki', 'Karleby', 'Jakobstad'],
  ['Vilket år blev Finland självständigt?', '1917', '1809', '1905', '1944'],
  ['Vilket datum är Finlands självständighetsdag?', '6 december', '1 maj', '24 juni', '5 februari'],
  ['När äter man Runebergstårta?', '5 februari', '6 december', '1 maj', '24 juni'],
  ['Vem skrev Fänrik Ståls sägner?', 'Johan Ludvig Runeberg', 'Zacharias Topelius', 'Aleksis Kivi', 'Elias Lönnrot'],
  ['Vad heter Finlands nationalepos?', 'Kalevala', 'Kanteletar', 'Sju bröder', 'Fänrik Ståls sägner'],
  ['Vilket är Finlands högsta fjäll?', 'Halti', 'Saana', 'Pallastunturi', 'Koli'],
  ['Vad betyder "kippis"?', 'Skål', 'Tack', 'Hej då', 'Förlåt'],
  ['Hur många arbetstimmar motsvarar ungefär en studiepoäng?', '27', '10', '45', '60'],
  ['Hur många studiepoäng är en ingenjörsexamen vid en yrkeshögskola oftast?', '240', '180', '210', '300'],
  ['Vad säger Ohms lag?', 'U = R · I', 'U = R / I', 'U = I / R', 'U = R + I'],
  ['Vad är 2 upphöjt till 10?', '1024', '1000', '512', '2048'],
  ['Vilken gas finns det mest av i luften?', 'Kväve', 'Syre', 'Koldioxid', 'Argon'],
  ['Vad mäts i newton?', 'Kraft', 'Energi', 'Effekt', 'Tryck'],
  ['Vad mäts i watt?', 'Effekt', 'Kraft', 'Spänning', 'Energi'],
  ['Vid vilken temperatur kokar vatten vid havsnivå?', '100 °C', '90 °C', '110 °C', '120 °C'],
  ['Vad fyller man en karelsk pirog med, traditionellt?', 'Risgrynsgröt', 'Potatismos med lax', 'Köttfärs', 'Äppelmos'],
  ['Vad kallas första maj bland finländska studerande?', 'Vappen', 'Midsommar', 'Kekri', 'Laskiainen'],
  ['Vilket grundämne har kemiska tecknet Fe?', 'Järn', 'Fluor', 'Fosfor', 'Bly'],
  ['Hur många sidor har en hexagon?', 'Sex', 'Fem', 'Sju', 'Åtta'],
  ['Vilket land ligger på andra sidan Kvarken från Vasa?', 'Sverige', 'Estland', 'Norge', 'Ryssland'],
];
// Veckans reservfrågor, samma för alla samma vecka.
function reservQuiz(week) {
  let h = 0;
  for (const ch of week) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const idx = RESERV.map((_, i) => i).sort((a, b) => ((a * 7919 + h) % 101) - ((b * 7919 + h) % 101));
  return idx.slice(0, ANTAL).map((i) => {
    const [fråga, rätt, ...fel] = RESERV[i];
    return { fråga, rätt, fel };
  });
}
function buildQuizPrompt(week) {
  return [
    'Du är quizmaster på pubquizen på Filicia Castle, studentkåren i Vasa, i spelet Arre Simulator.',
    'Skriv ' + ANTAL + ' frågor för ' + week + '. Blanda: Vasa och Österbotten, Finland, studentliv, teknik och naturvetenskap (för ingenjörsstuderande), mat och allmänbildning.',
    'Varje fråga har ett rätt svar och tre felaktiga men rimliga svar. Svaren är korta.',
    'VIKTIGT: Ta bara med fakta du är helt säker på. Hellre en enkel fråga än en osäker.',
    'Finlandssvenska, korta frågor, passande för alla åldrar. Svara med verktyget quiz.',
  ].join('\n');
}
const QUIZ_TOOL = {
  name: 'quiz',
  description: 'Veckans pubquiz.',
  input_schema: {
    type: 'object',
    properties: {
      frågor: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            fråga: { type: 'string' },
            rätt: { type: 'string' },
            fel: { type: 'array', items: { type: 'string' } },
          },
          required: ['fråga', 'rätt', 'fel'],
        },
      },
    },
    required: ['frågor'],
  },
};
function cleanQuiz(out) {
  const list = (Array.isArray(out?.frågor) ? out.frågor : [])
    .map((q) => ({
      fråga: str(q?.fråga, 200),
      rätt: str(q?.rätt, 80),
      fel: (Array.isArray(q?.fel) ? q.fel : []).map((f) => str(f, 80)).filter(Boolean),
    }))
    .filter((q) => q.fråga && q.rätt && q.fel.length >= 3 && !q.fel.includes(q.rätt))
    .map((q) => ({ ...q, fel: [...new Set(q.fel)].slice(0, 3) }))
    .filter((q) => q.fel.length === 3);
  return list.length >= 5 ? list.slice(0, ANTAL) : null;
}
// Topplistan: bästa resultatet per namn.
function addScore(list, name, score) {
  const n = str(name, 24);
  if (!n || !Number.isInteger(score) || score < 0 || score > ANTAL) return list;
  const out = (Array.isArray(list) ? list : []).filter((t) => t.name.toLowerCase() !== n.toLowerCase());
  const old = (list || []).find((t) => t.name.toLowerCase() === n.toLowerCase());
  out.push({ name: n, score: Math.max(score, old?.score ?? 0) });
  return out.sort((a, b) => b.score - a.score).slice(0, 50);
}
module.exports = { ANTAL, RESERV, reservQuiz, buildQuizPrompt, QUIZ_TOOL, cleanQuiz, addScore };
