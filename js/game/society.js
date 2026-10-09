// Fas 6: levande människor. Personerna har humör, relationer till varandra och hör skvaller om dig.
// Allt sparas i state.society och ändras en gång per speldag (se societyDay) och när du gör saker.
'use strict';
const pairKey = (a, b) => (a < b ? a + '|' + b : b + '|' + a);
const allIds = () => [...characters, ...extra].map((p) => p.id);
const firstName = (id) =>
  ([...characters, ...extra].find((p) => p.id === id)?.name || id).split(' ')[0];

function ensureSociety() {
  const s = (state.society ??= {});
  if (!s.rel) {
    s.rel = {};
    for (const [a, b, v] of SOCIETY.relationer) s.rel[pairKey(a, b)] = v;
  }
  s.mood ??= {};
  for (const id of allIds())
    if (!Number.isFinite(s.mood[id])) s.mood[id] = 55 + ((id.length * 13) % 25) + traitMood(id);
  s.rumors = Array.isArray(s.rumors) ? s.rumors.slice(-30) : [];
  s.news = Array.isArray(s.news) ? s.news.slice(-12) : [];
  s.day ??= state.day;
}
function npcRel(a, b) {
  return state.society.rel[pairKey(a, b)] || 0;
}
function setNpcRel(a, b, v) {
  state.society.rel[pairKey(a, b)] = clamp(Math.round(v), -100, 100);
}
function relWord(v) {
  return v >= 70 ? 'bästa vänner' : v >= 35 ? 'vänner' : v <= -20 ? 'osams' : null;
}
function moodWord(id) {
  const m = state.society?.mood[id] ?? 60;
  return m >= 78 ? 'på strålande humör' : m >= 55 ? 'glad' : m >= 35 ? 'lite trött' : 'nere';
}
// Vem som är vän med vem (bland personerna, och med dig).
function friendsOf(id) {
  return allIds().filter((o) => o !== id && npcRel(id, o) >= 35);
}

// ---- Skvaller ----
// Något du gjort blir ett rykte. De som var där (eller känner dig väl) vet först, sedan sprids det.
function addRumor(kind, fill = {}, witnesses = []) {
  if (!state?.society || !SOCIETY.skvaller[kind]) return;
  const r = { kind, fill, day: state.day, knows: [...new Set(witnesses)], told: [] };
  state.society.rumors.push(r);
  state.society.rumors = state.society.rumors.slice(-30);
}
// Vilket rykte personen skulle nämna för dig just nu, om något.
function rumorFor(id) {
  return state.society?.rumors.find(
    (r) => r.knows.includes(id) && !r.told.includes(id) && state.day - r.day <= 10,
  );
}
function rumorText(r, id) {
  const t = SOCIETY.skvaller[r.kind].text;
  return t.replace(/\{(\w+)\}/g, (_, k) => r.fill[k] ?? '').replace('{namn}', firstName(id));
}
// Kallas från samtalet: personen säger vad hen hört, en gång per rykte.
function tellRumor(p) {
  const r = rumorFor(p.id);
  if (!r) return null;
  r.told.push(p.id);
  bump(p.id, SOCIETY.skvaller[r.kind].relation);
  return rumorText(r, p.id);
}
// Nyheter om de andra ("Har du hört att Axel och Otto är osams?").
function newsFor(id) {
  return state.society?.news.find(
    (n) => !n.told?.includes(id) && n.about.every((a) => a !== id) && state.day - n.day <= 6,
  );
}
function tellNews(p) {
  const n = newsFor(p.id);
  if (!n) return null;
  (n.told ??= []).push(p.id);
  return n.text;
}

// ---- En ny speldag ----
// Humöret rör sig, personer som ses blir närmare, ibland blir någon osams och ryktena sprids.
function societyDay() {
  const s = state.society,
    r = seeded(state.day * 977 + 13),
    weekday = weekdayIndex(state.day),
    examStress = state.courses.some((c) => c.study >= 2 && !c.pass) ? 6 : 0;
  for (const id of allIds()) {
    let m = s.mood[id] + (r() - 0.5) * 18;
    if (weekday >= 4) m += 6; // fredag och helg
    if (weekday === 0) m -= 5; // måndag
    m -= examStress * (PEOPLE_SCHEDULE.kurs.some((k) => k.includes(id)) ? 1 : 0);
    // Humöret dras mot personens vanliga läge: skämtare gladare, griniga surare (traits.js).
    s.mood[id] = clamp(m + (60 + traitMood(id) - m) * 0.15, 5, 98);
  }
  // Kurskamrater ses varje dag och blir lite närmare.
  for (const group of PEOPLE_SCHEDULE.kurs)
    for (let i = 0; i < group.length; i++)
      for (let j = i + 1; j < group.length; j++)
        setNpcRel(group[i], group[j], npcRel(group[i], group[j]) + 0.6);
  // Ibland blir två vänner osams, och osams personer blir sams igen efter ett tag.
  const pairs = Object.keys(s.rel);
  if (r() < 0.12 && pairs.length) {
    const k = pairs[Math.floor(r() * pairs.length)],
      [a, b] = k.split('|');
    if (s.rel[k] >= 35 && a !== state.character && b !== state.character) {
      s.rel[k] = -25;
      s.news.push({
        day: state.day,
        about: [a, b],
        text:
          'Har du hört? ' +
          firstName(a) +
          ' och ' +
          firstName(b) +
          ' är osams. Ingen vet riktigt varför.',
      });
    }
  }
  for (const k of pairs)
    if (s.rel[k] < 0 && r() < 0.18) {
      s.rel[k] = 40;
      const [a, b] = k.split('|');
      if (a !== state.character && b !== state.character)
        s.news.push({
          day: state.day,
          about: [a, b],
          text: firstName(a) + ' och ' + firstName(b) + ' är sams igen. Skönt.',
        });
    }
  // Ryktena sprids till vännerna till dem som redan vet.
  for (const rumor of s.rumors) {
    if (state.day - rumor.day > 10) continue;
    const add = new Set(rumor.knows);
    for (const id of rumor.knows)
      for (const f of friendsOf(id)) if (r() < Math.min(0.95, 0.5 * traitGossip(id))) add.add(f);
    // De som är dina vänner hör det också.
    for (const [id, v] of Object.entries(state.relations)) if (v >= 40 && r() < 0.3) add.add(id);
    add.delete(state.character);
    rumor.knows = [...add];
  }
  s.news = s.news.slice(-12);
  s.day = state.day;
}
// Personer nära dig just nu (vittnen till det du gör).
function witnessesHere(radius = 8) {
  return world.objects
    .filter((o) => o.person && o.profile && Math.hypot(o.x - player.x, o.y - player.y) < radius)
    .map((o) => o.profile.id);
}
// Hur personen mår och står till andra, för AI-samtalen.
function socialContext(id) {
  const rels = allIds()
    .filter((o) => o !== id && relWord(npcRel(id, o)))
    .map((o) => firstName(o) + ' (' + relWord(npcRel(id, o)) + ')')
    .slice(0, 5);
  const r = rumorFor(id);
  return {
    mood: moodWord(id),
    friends: rels.join(', '),
    rumor: r ? rumorText(r, id) : '',
  };
}
// Översikt i menyn.
function societyHtml() {
  const s = state.society,
    lines = Object.entries(s.rel)
      .filter(([, v]) => relWord(v))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([k, v]) => {
        const [a, b] = k.split('|');
        return esc(firstName(a)) + ' och ' + esc(firstName(b)) + ': ' + relWord(v);
      }),
    news = s.news
      .slice(-3)
      .reverse()
      .map((n) => '• ' + esc(n.text));
  return (
    '<h3>Vem är vän med vem</h3><div class="info">' +
    lines.join('<br>') +
    (news.length ? '<br><br><strong>Senaste nytt</strong><br>' + news.join('<br>') : '') +
    '</div>'
  );
}
