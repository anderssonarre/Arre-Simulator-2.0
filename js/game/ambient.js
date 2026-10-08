// Ljudmiljö: vind, regn, fåglar, sorl i korridorerna och musik på fester. Allt skapas med
// Web Audio i webbläsaren, inga ljudfiler. Följer ljudknappen i menyn (muted).
'use strict';
const AMB = { ready: false, beat: 0, chirp: 3 };
function ambientInit() {
  if (AMB.ready || !audio) return;
  const a = audio,
    len = a.sampleRate * 2,
    buf = a.createBuffer(1, len, a.sampleRate),
    d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const noise = () => {
    const s = a.createBufferSource();
    s.buffer = buf;
    s.loop = true;
    s.start();
    return s;
  };
  AMB.master = a.createGain();
  AMB.master.gain.value = 0;
  AMB.master.connect(a.destination);
  const chain = (type, freq, q) => {
    const f = a.createBiquadFilter(),
      g = a.createGain();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    g.gain.value = 0;
    noise().connect(f);
    f.connect(g);
    g.connect(AMB.master);
    return g;
  };
  AMB.wind = chain('lowpass', 380, 0.7);
  AMB.rain = chain('bandpass', 2600, 0.6);
  AMB.murmur = chain('bandpass', 520, 1.6);
  AMB.music = a.createGain();
  AMB.music.gain.value = 0;
  AMB.music.connect(AMB.master);
  AMB.noiseBuf = buf;
  AMB.ready = true;
}
function setLevel(g, v) {
  g.gain.setTargetAtTime(v, audio.currentTime, 0.6);
}
// Ett trumslag eller en hihat till festmusiken.
function beatNote(kind) {
  const a = audio,
    t = a.currentTime,
    g = a.createGain();
  g.connect(AMB.music);
  if (kind === 'kick') {
    const o = a.createOscillator();
    o.frequency.setValueAtTime(130, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.15);
    g.gain.setValueAtTime(0.9, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    o.connect(g);
    o.start(t);
    o.stop(t + 0.3);
  } else if (kind === 'hat') {
    const s = a.createBufferSource(),
      f = a.createBiquadFilter();
    s.buffer = AMB.noiseBuf;
    f.type = 'highpass';
    f.frequency.value = 7000;
    g.gain.setValueAtTime(0.25, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    s.connect(f);
    f.connect(g);
    s.start(t, Math.random());
    s.stop(t + 0.06);
  } else {
    const o = a.createOscillator(),
      notes = [55, 55, 65.4, 49];
    o.type = 'sawtooth';
    o.frequency.value = notes[Math.floor(AMB.beat / 8) % 4];
    const f = a.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 300;
    g.gain.setValueAtTime(0.35, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    o.connect(f);
    f.connect(g);
    o.start(t);
    o.stop(t + 0.25);
  }
}
function birdChirp() {
  const a = audio,
    t = a.currentTime,
    o = a.createOscillator(),
    g = a.createGain(),
    f = 2600 + Math.random() * 2400;
  o.frequency.setValueAtTime(f, t);
  o.frequency.exponentialRampToValueAtTime(f * (0.7 + Math.random() * 0.6), t + 0.08);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.05, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
  o.connect(g);
  g.connect(AMB.master);
  o.start(t);
  o.stop(t + 0.12);
}
function ambientTick(dt) {
  if (!audio || !state || !world) return;
  ambientInit();
  if (!AMB.ready) return;
  setLevel(AMB.master, muted || document.hidden ? 0 : 1);
  const out = !!world.outdoor,
    wx = weather(),
    day = daylight(state.hour),
    season = seasonName(),
    people = world.objects.filter(
      (o) => o.profile && Math.hypot(o.x - player.x, o.y - player.y) < 10,
    ).length,
    partying =
      (party && world.id === 'w33' && player.x > 28 && player.y < 18) ||
      (homeParty && world.id === 'home') ||
      (partyNow() && world.id === 'w33');
  setLevel(AMB.wind, out ? (season === 'vinter' ? 0.05 : 0.025) + wx.clouds * 0.02 : 0.004);
  setLevel(AMB.rain, out && wx.kind === 'regn' ? 0.05 : !out && wx.kind === 'regn' ? 0.008 : 0);
  setLevel(AMB.murmur, !out ? Math.min(0.05, people * 0.006) : Math.min(0.02, people * 0.002));
  setLevel(AMB.music, partying ? 0.12 : 0);
  // Fåglar på dagen ute, inte på vintern.
  AMB.chirp -= dt;
  if (out && day > 0.5 && season !== 'vinter' && wx.kind !== 'regn' && AMB.chirp <= 0) {
    AMB.chirp = 1.5 + Math.random() * 6;
    const n = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) setTimeout(birdChirp, i * 140);
  }
  // Festmusik: 120 slag i minuten.
  if (partying) {
    AMB.next = (AMB.next ?? 0) - dt;
    if (AMB.next <= 0) {
      AMB.next += 0.25;
      AMB.beat++;
      if (AMB.beat % 2 === 0) beatNote('kick');
      else beatNote('hat');
      if (AMB.beat % 2 === 1) beatNote('bass');
    }
  }
}
