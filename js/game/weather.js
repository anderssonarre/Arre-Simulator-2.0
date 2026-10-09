// Vädret: sol, moln, dimma, regn, snö och åska som skiftar under dygnet och följer årstiderna i
// Vasa. Typerna och hur vanliga de är per månad finns i js/data/weather.js.
// Online räknas vädret från serverns dag, så alla som spelar ser samma himmel.
'use strict';
const VÄDERLISTA = Object.keys(VÄDERTYPER);
const weatherCache = new Map();
// För tester och skärmbilder: { typ: 'regn', temp: 8 } tvingar fram ett väder. Null = vanligt.
let forcedWeather = null;

// Dagen vädret räknas från: serverns dag online, annars din egen.
function weatherKey(day) {
  return typeof sharedClock === 'function' && sharedClock() ? day - net.clock.offset : day;
}
// Blandar om ett tal så att närliggande dagar inte får liknande slump.
function mixSeed(n) {
  n = Math.imul(n ^ (n >>> 16), 0x85ebca6b);
  n = Math.imul(n ^ (n >>> 13), 0xc2b2ae35);
  return (n ^ (n >>> 16)) >>> 0;
}
function drawWeather(r, month) {
  const w = VÄDERMÅNAD[month],
    sum = w.reduce((a, n) => a + n, 0);
  let x = r() * sum;
  for (let i = 0; i < w.length; i++) if ((x -= w[i]) < 0) return VÄDERLISTA[i];
  return VÄDERLISTA[0];
}
// Vädertypen i en period (fyra per dygn). Vädret håller gärna i sig från förra perioden.
function periodType(key, seg, month) {
  const idx = key * 4 + seg,
    id = idx + '|' + month;
  if (weatherCache.has(id)) return weatherCache.get(id);
  let t = drawWeather(seeded(mixSeed(idx - 8)), month);
  for (let i = idx - 7; i <= idx; i++) {
    const r = seeded(mixSeed(i));
    if (r() >= VÄDERREGLER.hållerI) t = drawWeather(r, month);
  }
  if (weatherCache.size > 400) weatherCache.clear();
  weatherCache.set(id, t);
  return t;
}
// Medeltemperaturen den dagen, mjukt mellan månaderna.
function baseTemp(day) {
  const m = (yearDay(day) / YEAR.dagar) * 12 - 0.5,
    i = Math.floor(m),
    f = m - i,
    a = TEMPERATUR[(i + 12) % 12],
    b = TEMPERATUR[(i + 13) % 12];
  return a + (b - a) * f;
}
const smooth = (t) => t * t * (3 - 2 * t);

// Vädret vid ett klockslag: { typ, namn, ikon, moln, ned, dimma, åska, snö, temp, kind, clouds }.
// kind ('klart', 'mulet', 'regn', 'snö') och clouds finns kvar för äldre kod.
function weatherAt(day = state?.day ?? 1, hour = state?.hour ?? 12) {
  hour = ((hour % 24) + 24) % 24;
  const key = weatherKey(day),
    month = monthIndex(day),
    seg = Math.min(3, Math.floor(hour / 6)),
    forced = forcedWeather && VÄDERTYPER[forcedWeather.typ],
    a = forced || VÄDERTYPER[periodType(key, seg, month)],
    nextKey = seg === 3 ? key + 1 : key,
    b = forced || VÄDERTYPER[periodType(nextKey, (seg + 1) % 4, seg === 3 ? monthIndex(day + 1) : month)],
    // Den sista och en halv timmen av perioden går över i nästa.
    t = smooth(clamp((hour - (seg * 6 + 4.5)) / 1.5, 0, 1)),
    mix = (k) => (a[k] || 0) + ((b[k] || 0) - (a[k] || 0)) * t,
    typ = t < 0.5 ? a : b,
    moln = mix('moln'),
    ned = mix('ned'),
    dimma = mix('dimma');
  // Temperaturen: månaden, dagens avvikelse och dygnet (varmast vid tretiden på eftermiddagen).
  const dev = (k) => (seeded(mixSeed(k * 131 + 7))() * 2 - 1) * VÄDERREGLER.dagsvariation,
    daily = (dev(key) * 2 + dev(key - 1)) / 3,
    diurnal = -Math.cos(((hour - 3) / 24) * Math.PI * 2) * VÄDERREGLER.dygnsvariation * (1 - moln * 0.6),
    temp = forced && forcedWeather.temp != null ? forcedWeather.temp : baseTemp(day) + daily + diurnal,
    snö = temp < VÄDERREGLER.snöUnder;
  const wet = ned > 0.05 && typ.ned > 0;
  return {
    typ: VÄDERLISTA.find((k) => VÄDERTYPER[k] === typ),
    namn: wet && snö && typ.snönamn ? typ.snönamn : typ.namn,
    ikon: wet && snö && typ.snöikon ? typ.snöikon : typ.ikon,
    moln,
    ned,
    dimma,
    åska: !!typ.åska,
    snö,
    temp: Math.round(temp),
    kind: ned > 0.05 ? (snö ? 'snö' : 'regn') : moln > 0.6 ? 'mulet' : 'klart',
    clouds: moln,
  };
}
// Äldre namn: vädret just nu (eller mitt på dagen en annan dag).
function weather(day = state?.day ?? 1) {
  return weatherAt(day, state && day === state.day ? state.hour : 12);
}
// "regn, 8 grader"
function weatherText() {
  const w = weather();
  return w.namn.toLowerCase() + ', ' + w.temp + ' grader';
}
function weatherHud() {
  const w = weather();
  return w.ikon + ' ' + w.temp + '°';
}
// Prognosen för en dag: morgon, eftermiddag och kväll.
function forecast(day = state?.day ?? 1) {
  return [
    ['morgon', 9],
    ['eftermiddag', 15],
    ['kväll', 21],
  ].map(([namn, h]) => ({ namn, ...weatherAt(day, h) }));
}
function forecastText(day = state?.day ?? 1) {
  return forecast(day)
    .map((f) => f.namn + ' ' + f.ikon + ' ' + f.temp + '°')
    .join(', ');
}

// ---- Vädret påverkar dig ----
const hasUmbrella = () => !!state?.bag?.paraply;
const outsideNow = () => !!world?.outdoor;
// Gånghastigheten (snöstorm går trögt).
function weatherSpeed() {
  if (!outsideNow()) return 1;
  const w = weather();
  return w.åska && w.snö ? VÄDERREGLER.snöstormFart : 1;
}
let weatherClock = null;
const flash = { v: 0, next: 4 };
// Körs varje bildruta. Blöt, glad i solen, blixtar.
function weatherTick(dt = 0) {
  if (!state || !world) return;
  const w = weather(),
    out = outsideNow();
  // Blixtar och åska (i realtid).
  flash.v = Math.max(0, flash.v - dt * 4);
  if (w.åska && !w.snö && w.ned > 0.5) {
    flash.next -= dt;
    if (flash.next <= 0) {
      flash.next = 5 + Math.random() * 14;
      flash.v = out ? 1 : 0.35;
      const far = 0.4 + Math.random() * 2.2;
      setTimeout(() => typeof thunder === 'function' && thunder(out ? 1 / far : 0.3), far * 1000);
    }
  }
  // Resten räknas på speltiden, som tillstånden.
  const now = state.day * 1440 + state.hour * 60;
  if (weatherClock === null || now < weatherClock || now - weatherClock > 24 * 60) {
    weatherClock = now;
    return;
  }
  const hours = (now - weatherClock) / 60;
  if (hours < 1 / 60) return;
  weatherClock = now;
  const R = VÄDERREGLER,
    c = ensureCond(),
    before = c.blöt;
  if (out && w.ned > 0.05) {
    const rain = w.snö ? 0.3 : 1,
      shield = hasUmbrella() ? 1 - R.paraplySkyddar : 1;
    c.blöt = clamp(c.blöt + w.ned * rain * shield * R.blötPerTimme * hours, 0, 100);
    if (!w.snö && !hasUmbrella()) gain('happy', R.regnGlädje * w.ned * hours);
    if (!w.snö && !hasUmbrella() && state.umbrellaTipDay !== state.day) {
      state.umbrellaTipDay = state.day;
      toast('Det regnar. Ett paraply från kiosken i W33 håller dig torr.');
    }
  } else c.blöt = Math.max(0, c.blöt - (out ? R.torkarUte : R.torkarInne) * hours);
  // I solen blir man glad, mest när det är varmt.
  if (out && w.moln < 0.5 && daylight(state.hour) > 0.5)
    gain('happy', (w.temp >= 10 ? R.solGlädje : w.temp < 0 ? 1.5 : 1) * (1 - w.moln) * hours);
  // Blöt är man trött och sur, särskilt när det är kallt.
  if (c.blöt >= 50) {
    gain('happy', -2 * hours);
    if (w.temp < 5) gain('energy', -2 * hours);
  }
  if (before < 70 && c.blöt >= 70) toast('Du är genomblöt. Gå in och torka.');
  updateConditionsHUD();
}
// Blixten just nu, 0 till 1 (används av båda grafikmotorerna).
const weatherFlash = () => flash.v;

// ---- Folket på campus ----
// Ändrar en plan efter vädret: i regn går folk in, på varma soldagar äter några lunch ute.
function weatherPlan(id, day, hour, plan) {
  if (!plan || (plan.where !== 'outdoor' && plan.activity !== 'lunch')) return plan;
  const w = weatherAt(day, hour);
  if (plan.where === 'outdoor' && plan.activity !== 'fest' && w.ned > 0.25)
    return { ...plan, where: seeded(hashId(id) + day)() < 0.5 ? 'w33' : 'tech', activity: 'paus' };
  if (plan.activity === 'lunch' && w.moln < 0.5 && w.ned === 0 && w.temp >= 12 && seeded(hashId(id) * 3 + day)() < 0.4)
    return { ...plan, where: 'outdoor', activity: 'lunch' };
  return plan;
}

// ---- Kollar datafilen när spelet startar ----
for (const [m, w] of VÄDERMÅNAD.entries())
  if (w.length !== VÄDERLISTA.length) console.warn('Väder: månad ' + m + ' har fel antal vikter');
if (TEMPERATUR.length !== 12) console.warn('Väder: TEMPERATUR behöver tolv månader');
