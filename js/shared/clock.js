// Spelklockan och fester på riktiga tider. Används både av spelet och av servern,
// så att alla räknar tiden på exakt samma sätt.
'use strict';
const CLOCK = {
  // Minut 0 är måndag kl. 07:00 på dag 1.
  epoch: Date.UTC(2026, 0, 1),
  // Dagen 07–23 går i normal takt (en sekund = en spelminut), natten sex gånger fortare.
  morning: 7,
  night: 23,
  nightSpeed: 6,
  // Fredagsfest för alla online, i finsk tid.
  party: { weekday: 5, from: 20, to: 22, zone: 'Europe/Helsinki' },
};
// Hur många spelminuter som går per sekund vid ett visst klockslag.
function clockRate(hour) {
  return hour >= CLOCK.night || hour < CLOCK.morning ? CLOCK.nightSpeed : 1;
}
// Spelminuter sedan start, för en tidpunkt i verkligheten (millisekunder).
function gameMinutesAt(ms) {
  const dayLen = (CLOCK.night - CLOCK.morning) * 60,
    nightLen = ((24 - CLOCK.night + CLOCK.morning) * 60) / CLOCK.nightSpeed,
    cycle = dayLen + nightLen,
    t = (ms - CLOCK.epoch) / 1000,
    n = Math.floor(t / cycle),
    r = t - n * cycle,
    m = r < dayLen ? r : dayLen + (r - dayLen) * CLOCK.nightSpeed;
  return n * 1440 + CLOCK.morning * 60 + m;
}
// Veckodag (1 = måndag) och klockslag i finsk tid.
function zonedParts(ms, zone) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: zone,
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(new Date(ms));
  const get = (k) => parts.find((p) => p.type === k)?.value;
  return {
    weekday: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(get('weekday')) + 1,
    hour: Number(get('hour')),
    minute: Number(get('minute')),
  };
}
// Pågår fredagsfesten, och när börjar nästa? Tider i millisekunder.
function partyStatus(ms, force = false) {
  const p = CLOCK.party,
    z = zonedParts(ms, p.zone),
    sinceMidnight = (z.hour * 60 + z.minute) * 60000,
    midnight = ms - sinceMidnight - (ms % 60000),
    days = (p.weekday - z.weekday + 7) % 7,
    start = midnight + days * 864e5 + p.from * 36e5,
    end = midnight + days * 864e5 + p.to * 36e5;
  const active = force || (days === 0 && ms >= start && ms < end);
  return {
    active,
    endsAt: force ? ms + 2 * 36e5 : end,
    nextAt: active ? start : ms < start ? start : start + 7 * 864e5,
  };
}
if (typeof module !== 'undefined')
  module.exports = { CLOCK, clockRate, gameMinutesAt, partyStatus, zonedParts };
