// VÄDER · innehållsfil
// Vädret på campus. Varje dygn delas i fyra perioder (natt 0–6, morgon 6–12, eftermiddag
// 12–18 och kväll 18–24). Varje period får en vädertyp som lottas efter månaden, och vädret
// håller gärna i sig från en period till nästa. Mellan perioderna skiftar det mjukt.
// Online har alla samma väder. Se js/game/weather.js.
//
// Vädertyper (VÄDERTYPER):
//   namn, ikon      vad som visas
//   moln            hur mulet det är, 0 till 1
//   ned             hur mycket det regnar eller snöar, 0 till 1
//   dimma           hur tät dimman är, 0 till 1
//   åska            true om det blixtrar
//   snönamn         vad typen heter när det är så kallt att nederbörden blir snö
//   snöikon         ikonen då
const VÄDERTYPER = {
  sol: { namn: 'Sol', ikon: '☀️', moln: 0.05, ned: 0 },
  halvklart: { namn: 'Halvklart', ikon: '⛅', moln: 0.4, ned: 0 },
  mulet: { namn: 'Mulet', ikon: '☁️', moln: 0.85, ned: 0 },
  dimma: { namn: 'Dimma', ikon: '🌫️', moln: 0.7, ned: 0, dimma: 1 },
  duggregn: { namn: 'Duggregn', ikon: '🌦️', moln: 0.85, ned: 0.3, snönamn: 'Lätt snöfall', snöikon: '🌨️' },
  regn: { namn: 'Regn', ikon: '🌧️', moln: 0.95, ned: 0.7, snönamn: 'Snöfall', snöikon: '🌨️' },
  åska: { namn: 'Åskväder', ikon: '⛈️', moln: 1, ned: 1, åska: true, snönamn: 'Snöstorm', snöikon: '❄️' },
};

// Hur vanlig varje typ är per månad (september först). Talen är vikter, inte procent.
//            sol  halvkl mulet dimma dugg regn åska
const VÄDERMÅNAD = [
  /* sep */ [3, 3, 2, 1, 1, 2, 0.15],
  /* okt */ [2, 2, 3, 1.5, 2, 2.5, 0],
  /* nov */ [1, 1.5, 4, 2, 2, 3, 0],
  /* dec */ [1, 1.5, 4, 1, 1.5, 3, 0.2],
  /* jan */ [2, 2, 3, 1, 1, 2.5, 0.2],
  /* feb */ [3, 2.5, 2.5, 0.5, 1, 2, 0.1],
  /* mar */ [3.5, 2.5, 2, 1, 1, 1.5, 0],
  /* apr */ [3, 3, 2, 1, 1.5, 2, 0],
  /* maj */ [4, 3, 1.5, 0.5, 1, 1.5, 0.15],
  /* jun */ [4.5, 3, 1.5, 0.3, 0.8, 1.5, 0.7],
  /* jul */ [4.5, 3, 1.5, 0.3, 0.8, 1.5, 0.8],
  /* aug */ [3.5, 3, 2, 0.8, 1, 2, 0.6],
];

// Medeltemperaturen i Vasa per månad (september först), i grader.
const TEMPERATUR = [10, 5, 0, -4, -7, -7, -3, 3, 9, 14, 17, 15];

const VÄDERREGLER = {
  hållerI: 0.55, // chansen att vädret fortsätter som förra perioden
  snöUnder: 1, // under så här många grader blir nederbörden snö
  dagsvariation: 4, // så mycket varmare eller kallare en dag kan vara än vanligt
  dygnsvariation: 3, // så mycket varmare eftermiddagen är än natten (mindre när det är mulet)
  // Blöt: hur fort man blir blöt ute per spelad timme i det tyngsta regnet, och hur fort man torkar.
  blötPerTimme: 70,
  paraplySkyddar: 0.85, // så stor del av regnet paraplyet tar
  torkarInne: 35,
  torkarUte: 12,
  // Humöret per timme ute.
  solGlädje: 3, // i solen när det är minst 10 grader
  regnGlädje: -2, // i regn utan paraply
  snöstormFart: 0.8, // gånghastigheten i snöstorm
};
