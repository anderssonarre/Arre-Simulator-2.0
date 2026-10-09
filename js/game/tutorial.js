// Första dagen: en guidad dag för nya spelare. Varje steg förklarar ett system just när det behövs.
// Steg som man redan har gjort hoppas över. Går att hoppa över i menyn.
'use strict';
const TUTORIAL = [
  {
    id: 'world:outdoor',
    title: 'Gå ut genom dörren',
    detail:
      'Måndag 08:00. Din första föreläsning börjar 09:00 i W33. Gå till ytterdörren och tryck E.',
    tip: 'Behoven uppe till vänster sjunker hela tiden: mättnad, glädje och energi. Håll dem över 20 så går allt bättre.',
  },
  {
    id: 'world:w33',
    title: 'Hitta till W33',
    detail:
      'Tegelhuset med NOVIA-skylten. Kartan uppe till höger visar vägen, ingången är vid hörnet.',
    tip: 'Klockan går en spelminut per sekund. Natten 23–07 går sex gånger fortare.',
  },
  {
    id: 'föreläsning',
    title: 'Gå på föreläsningen',
    detail:
      'Föreläsningen pågår 9–11. Den räknas som ett studiepass och höjer betyget på tentan. Missade du den, plugga vid studieplatsen.',
    tip: 'Varje kurs kräver två studiepass och en tenta. Föreläsningar, studiepass och färdighet ger bättre betyg.',
  },
  {
    id: 'lunch',
    title: 'Ät lunch',
    detail: 'Lunchen i W33 kostar 8 €. Hemma kan du laga mat för 3 €.',
    tip: 'Hyran på 55 € dras varje måndag. FPA betalar 45 € i studiestöd så länge du klarar kurser.',
  },
  {
    id: 'prata',
    title: 'Prata med någon',
    detail:
      'Gå fram till en person och tryck E. Vänner pluggar med dig, bjuder på kaffe och hör av sig.',
    tip: 'Vänner du inte pratat med på två veckor svalnar. Fråga gärna "Vet du var någon är?".',
  },
  {
    id: 'jobb',
    title: 'Gör ett extrajobb',
    detail:
      'Jobbtavlan står mellan Technobothnia och Wasa Sports Club. Där jobbar du ett pass och kan söka fler jobb med annan lön.',
    tip: 'Du blir bättre på det du gör. Färdigheter och ekonomi finns i menyn (Esc).',
  },
  {
    id: 'sov',
    title: 'Gå hem och sov',
    detail: 'Sängen hemma ger mest energi. Gå hem genom dörren "Gå hem" på campus.',
    tip: 'Fredagar 20–22 finsk tid är det fest på Filicia Castle för alla som är online.',
  },
];
// Nuvarande steg, eller null när introduktionen är klar.
function tutorialStep() {
  if (!state || !Array.isArray(state.tutorial)) return null;
  return TUTORIAL.find((t) => !state.tutorial.includes(t.id)) || null;
}
// Anropas när spelaren gör något som kan avsluta ett steg.
function tutorialDone(id) {
  if (!state || !Array.isArray(state.tutorial) || state.tutorial.includes(id)) return;
  const before = tutorialStep();
  state.tutorial.push(id);
  track('tutorial', { step: id });
  const next = tutorialStep();
  if (next === before) return;
  if (!next) {
    state.tutorial = null;
    tutorialEnding = true;
    setTimeout(finishTutorial, 900);
  } else setTimeout(() => toast(next.tip), 1200);
  updateHUD();
}
let tutorialEnding = false;
function finishTutorial() {
  if (modal) {
    setTimeout(finishTutorial, 1000);
    return;
  }
  tutorialEnding = false;
  dialog(
    'Första dagen är klar',
    '<p>Nu kan du grunderna. Resten av studielivet är ditt.</p><div class="info">Klara tre kurser per termin, åtta terminer totalt.<br>Håll koll på pengarna inför måndagens hyra.<br>Vänner, fester och extrajobb gör livet roligare.<br>Menyn (Esc) har veckoschema, studieplan, färdigheter och ekonomi.</div>',
    [{ label: 'Kör!', primary: true, run: close }],
    'Introduktion',
  );
}
function skipTutorial() {
  state.tutorial = null;
  close();
  updateHUD();
  save();
  toast('Introduktionen är överhoppad.');
}
