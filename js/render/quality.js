// Bildkvalitet som anpassar sig efter datorn eller mobilen. Går spelet långsammare än cirka
// 26 bilder per sekund sänks upplösningen (och i 3D även skuggorna), och går det lätt höjs
// den igen. Målet är minst 30 bilder per sekund även på en vanlig mobil.
'use strict';
const QUALITY = {
  scale: 1, // 1 = full upplösning, lägst 0.55
  min: 0.55,
  frames: 0,
  since: 0,
  good: 0, // antal snabba mätperioder i rad
  fps: 60,
};
// Anropas en gång per bildruta från loop() i render.js.
function qualityTick(now) {
  if (!active || modal || document.hidden) {
    QUALITY.since = 0;
    return;
  }
  if (!QUALITY.since) {
    QUALITY.since = now;
    QUALITY.frames = 0;
    return;
  }
  QUALITY.frames++;
  const span = now - QUALITY.since;
  if (span < 2000) return;
  const fps = (QUALITY.frames * 1000) / span;
  QUALITY.fps = fps;
  QUALITY.since = now;
  QUALITY.frames = 0;
  let next = QUALITY.scale;
  if (fps < 26 && QUALITY.scale > QUALITY.min) {
    next = Math.max(QUALITY.min, QUALITY.scale - 0.15);
    QUALITY.good = 0;
  } else if (fps > 52) {
    // Höj försiktigt: först efter tre snabba perioder i rad.
    if (++QUALITY.good >= 3 && QUALITY.scale < 1) {
      next = Math.min(1, QUALITY.scale + 0.1);
      QUALITY.good = 0;
    }
  } else QUALITY.good = 0;
  if (next !== QUALITY.scale) {
    QUALITY.scale = Math.round(next * 100) / 100;
    if (typeof resize === 'function') resize();
    if (typeof resize3d === 'function') resize3d();
  }
}
