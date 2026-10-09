// AI-samtal: när servern har en Claude-nyckel svarar personerna med Haiku i stället för färdiga repliker.
// Servern håller nyckeln och kostnadstaket (server/ai.js). Går något fel används de färdiga replikerna.
'use strict';
const aiOffer = {}; // id -> 'kaffe' när personen har föreslagit kaffe
function aiAvailable() {
  return !!serverInfo?.ai;
}
function aiContext(p) {
  const pp = people.get(p.id),
    act = pp?.obj.activity,
    r = relation(p);
  return {
    playerName: playerName(),
    relation: r,
    relationName: relationName(r),
    place: pp?.world ? PLACE_TEXT[pp.world] || 'på campus' : 'hemma',
    activity: ACTIVITY_TEXT[act] || '',
    time: clockText(state.hour),
    weekday: WEEKDAY_NAMES[weekdayIndex(state.day)],
    drunk: act === 'fest',
    courses: state.graduated ? '' : [0, 1, 2].map((i) => course(i).name).join(', '),
    ...(state.society && p.id ? socialContext(p.id) : {}),
    thought: lifeThought(p.id),
  };
}
// Hämtar ett AI-svar till en replik som redan står som "…" i historiken.
async function aiReply(p, text, entry, fallback) {
  let data = null;
  try {
    const hist = (state.histories[p.id] || []).filter((h) => h !== entry).slice(-10, -1),
      r = await fetch('/api/talk', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          person: {
            id: p.id,
            name: p.name,
            role: p.role,
            personality: p.personality,
            topic: p.topic,
          },
          context: aiContext(p),
          history: hist.map((h) => ({ who: h.who, text: h.text })),
          memories: state.memories?.[p.id] || [],
          text,
        }),
      });
    if (r.status === 200) data = await r.json();
  } catch {}
  delete entry.pending;
  if (data?.svar) {
    entry.text = data.svar;
    aiAction(p, data);
  } else entry.text = fallback;
  save();
  // Visa svaret om samtalet med personen fortfarande är öppet.
  if (
    modal &&
    $('dialogTitle').textContent === p.name &&
    $('dialogTag').textContent === 'Campusfolk'
  )
    chat(p);
}
// Små handlingar som modellen kan välja, och som spelet utför.
function aiAction(p, d) {
  const first = p.name.split(' ')[0];
  if (d.handling === 'gladare') bump(p.id, 2);
  else if (d.handling === 'surare') bump(p.id, -3);
  else if (d.handling === 'kaffe' && relation(p) >= 15 && state.hangout?.[p.id] !== state.day)
    aiOffer[p.id] = 'kaffe';
  else if (d.handling === 'tips') {
    const i = state.courses.findIndex((c) => !c.pass);
    if (i >= 0 && state.aiTipDay?.[p.id] !== state.day) {
      state.aiTipDay ??= {};
      state.aiTipDay[p.id] = state.day;
      addXp(courseSkill(i), 8);
      toast('Tips från ' + first + ' · ' + SKILLS[courseSkill(i)].namn + ' +8 XP');
    }
  }
  if (d.minne && (d.handling === 'minns' || d.handling === 'gladare')) {
    state.memories ??= {};
    const list = (state.memories[p.id] ??= []);
    if (!list.includes(d.minne)) list.push(d.minne);
    state.memories[p.id] = list.slice(-5);
  }
}
