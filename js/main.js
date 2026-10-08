// Bygger världarna och startar spelloopen. Laddas sist, när alla funktioner finns.
'use strict';
build();
// Realistisk 3D om datorn klarar det, annars den klassiska motorn.
initR3();
document.body.classList.toggle('gfx3d', use3d());
window.addEventListener('error', (e) => {
  console.error(e.error);
  $('bootError').style.display = 'block';
  $('bootError').textContent = 'Ett fel uppstod: ' + e.message;
});
// Expose a small read-only snapshot for diagnostics; no external scripts or network calls.
window.ArreSimulator = {
  getSnapshot: () => ({
    active,
    modal,
    world: world?.id,
    player: { ...player },
    state: state ? JSON.parse(JSON.stringify(state)) : null,
    job: job ? { type: job.type, key: job.key, stage: job.stage } : null,
  }),
  version: '2.0-hd',
  texturePack: TEXTURE_PACK.name,
};
requestAnimationFrame(loop);
