// Hjälpfunktioner och sparnyckel
'use strict';
const $ = (id) => document.getElementById(id),
  clamp = (v, a, b) => Math.max(a, Math.min(b, v)),
  rand = (a) => a[Math.floor(Math.random() * a.length)],
  esc = (s) =>
    String(s).replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
    );
const SAVE = 'arre_simulator_2_save_v1',
  VERSION = SAVE_VERSION;
