// Fas 8: hem och ägande. Köpa, flytta och sälja möbler, byta lägenhet och visa upp hemmet.
'use strict';
function ensureHome() {
  state.home ??= { typ: 'etta', items: [] };
  if (!APARTMENTS[state.home.typ]) state.home.typ = 'etta';
  state.home.items = (state.home.items || []).filter(
    (it) => FURNITURE[it.id] && HOME_SLOTS.some((s) => s.id === it.slot),
  );
}
function rent() {
  return APARTMENTS[state?.home?.typ || 'etta'].hyra;
}
// Trivsel: möblernas mys plus lägenhetens.
function coziness(home = state.home) {
  return (
    APARTMENTS[home.typ].mys + home.items.reduce((a, it) => a + (FURNITURE[it.id]?.mys || 0), 0)
  );
}
function hasItem(id) {
  return state.home?.items.some((it) => it.id === id);
}

// ---- Bygg möblerna i hemmets värld ----
const homeBase = { wall: null };
function tintedWall(color) {
  const key = 'wall' + color;
  if (cache[key]) return cache[key];
  const src = homeBase.wall,
    c = canvasOf(src.width, src.height, (g, w, h) => {
      g.drawImage(src, 0, 0);
      g.globalCompositeOperation = 'color';
      g.fillStyle = color;
      g.fillRect(0, 0, w, h * 0.62);
    });
  cache[key] = c;
  return c;
}
function applyHome(home) {
  const w = worlds.home;
  if (!w) return;
  homeBase.wall ??= w.wallTex[11];
  // Ta bort förra omgången möbler.
  w.boxes = w.boxes.filter((b) => !b.item);
  w.solids = (w.solids || []).filter((s) => !s.item);
  w.objects = w.objects.filter((o) => !o.item);
  if (w.lights) w.lights = w.lights.filter((l) => !l.item);
  const col = APARTMENTS[home.typ].vägg;
  w.wallTex[11] = col ? tintedWall(col) : homeBase.wall;
  for (const it of home.items) {
    const slot = HOME_SLOTS.find((s) => s.id === it.slot);
    if (slot) buildItem(w, it.id, slot.x, slot.y);
  }
  buildMirrorBoxes(w);
  // 3D-scenen byggs om nästa bildruta.
  if (typeof R3 !== 'undefined' && R3.scenes.has(w)) {
    const g = R3.scenes.get(w);
    if (R3.current === g) {
      R3.scene.remove(g);
      R3.current = null;
    }
    R3.scenes.delete(w);
  }
}
function itemBox(w, x0, y0, x1, y1, z0, z1, opts) {
  const before = (w.solids || []).length,
    b = addBox(w, x0, y0, x1, y1, z0, z1, opts);
  b.item = true;
  for (let i = before; i < (w.solids || []).length; i++) w.solids[i].item = true;
  return b;
}
function buildItem(w, id, x, y) {
  const B = (dx0, dy0, dx1, dy1, z0, z1, opts) =>
      itemBox(w, x + dx0, y + dy0, x + dx1, y + dy1, z0, z1, opts),
    wood = [150, 108, 72],
    spot = (label, action) => {
      const o = obj(w, x, y, 'home', label, action, { hidden: true, height: 0.7, item: true });
      return o;
    };
  if (id === 'fatolj') {
    const c = [122, 64, 52];
    B(-0.28, -0.28, 0.28, 0.28, 0, 0.24, { color: c });
    B(-0.28, 0.18, 0.28, 0.3, 0.24, 0.62, { color: c, solid: false });
    B(-0.3, -0.28, -0.2, 0.3, 0.24, 0.4, { color: c, solid: false });
    B(0.2, -0.28, 0.3, 0.3, 0.24, 0.4, { color: c, solid: false });
    spot('Fåtöljen · vila en stund', () => {
      advance(20);
      gain('energy', 12);
      gain('happy', 3);
      save();
      toast('Skönt i fåtöljen. +12 energi');
    });
  } else if (id === 'bokhylla') {
    B(-0.38, -0.12, 0.38, 0.12, 0, 1.15, { color: wood, top: [170, 126, 86] });
    const r = seeded(77);
    for (let s = 0; s < 4; s++)
      for (let k = 0; k < 6; k++) {
        const bx = -0.34 + k * 0.11,
          bh = 0.14 + r() * 0.07,
          c = [
            [160, 60, 50],
            [50, 90, 140],
            [220, 190, 90],
            [60, 110, 70],
            [200, 200, 190],
          ][Math.floor(r() * 5)];
        B(bx, -0.13, bx + 0.09, -0.04, 0.08 + s * 0.27, 0.08 + s * 0.27 + bh, {
          color: c,
          solid: false,
        });
      }
  } else if (id === 'vaxt') {
    B(-0.13, -0.13, 0.13, 0.13, 0, 0.26, { color: [196, 112, 74] });
    obj(w, x, y, 'plant', '', null, { height: 1.0, z: 0.22, sprite: plantSprite(2), item: true });
  } else if (id === 'hantlar') {
    B(-0.25, -0.12, 0.25, 0.12, 0, 0.3, { color: [52, 56, 60] });
    B(-0.2, -0.05, -0.05, 0.05, 0.3, 0.37, { color: [30, 30, 32], solid: false });
    B(0.05, -0.05, 0.2, 0.05, 0.3, 0.37, { color: [30, 30, 32], solid: false });
    spot('Hantlarna · träna en stund', () => {
      if (state.stats.energy < 10) return toast('För trött för att träna.');
      advance(15);
      gain('energy', -4);
      gain('happy', 5);
      addXp('kondition', 6);
      save();
      toast('Ett pass med hantlarna. Kondition +6 XP');
    });
  } else if (id === 'spel') {
    B(-0.3, -0.15, 0.3, 0.15, 0, 0.35, { color: [40, 42, 48] });
    B(-0.25, -0.05, 0.25, 0.0, 0.35, 0.68, { color: [20, 24, 30], glow: true, solid: false });
    spot('Spelhörnan · spela en stund', () => {
      advance(40);
      gain('happy', 12);
      gain('energy', -3);
      save();
      toast('Bara en runda till... +12 glädje, 40 minuter');
    });
  } else if (id === 'lampa') {
    B(-0.15, -0.15, 0.15, 0.15, 0, 0.4, { color: wood });
    B(-0.07, -0.07, 0.07, 0.07, 0.4, 0.58, { color: [255, 150, 90], glow: true, solid: false });
    w.lights?.push?.({ x, y, z: 0.5, power: 0.2, falloff: 2.5, item: true });
  } else if (id === 'akvarium') {
    B(-0.35, -0.15, 0.35, 0.15, 0, 0.45, { color: wood });
    B(-0.33, -0.13, 0.33, 0.13, 0.45, 0.85, { color: [90, 160, 190], glow: true, solid: false });
    spot('Akvariet · titta på fiskarna', () => {
      advance(10);
      gain('happy', 4);
      gain('energy', 2);
      save();
      toast('Fiskarna simmar lugnt runt. +4 glädje');
    });
  }
}

// ---- Inredning och boende (dialog hemma) ----
function homeShop() {
  const free = HOME_SLOTS.filter((s) => !state.home.items.some((it) => it.slot === s.id)),
    owned = state.home.items;
  dialog(
    'Inred hemmet',
    '<p>Trivsel: <strong>' +
      coziness() +
      '</strong>. Hög trivsel gör att du vilar bättre hemma och mår bättre där. Bor i: <strong>' +
      esc(APARTMENTS[state.home.typ].namn) +
      '</strong>, hyra ' +
      rent() +
      ' € i veckan.</p>' +
      (owned.length
        ? '<div class="info">' +
          owned
            .map(
              (it) =>
                esc(FURNITURE[it.id].namn) +
                ' · ' +
                esc(HOME_SLOTS.find((s) => s.id === it.slot).namn),
            )
            .join('<br>') +
          '</div>'
        : '<p class="sub">Inga egna möbler än.</p>'),
    [
      ...(free.length ? [{ label: 'Köp en möbel', primary: true, run: buyFurnitureDialog }] : []),
      ...(owned.length ? [{ label: 'Flytta eller sälj en möbel', run: arrangeDialog }] : []),
      { label: 'Byt lägenhet', run: apartmentDialog },
      { label: 'Stäng', run: close },
    ],
    'Hemmet',
  );
}
function buyFurnitureDialog() {
  dialog(
    'Möbelkatalogen',
    '<p>Möblerna levereras direkt. Du har ' + state.money + ' €.</p>',
    [
      ...Object.entries(FURNITURE)
        .filter(([id]) => !hasItem(id))
        .map(([id, f]) => ({
          label: f.namn + ' · ' + f.pris + ' € · ' + f.text,
          disabled: state.money < f.pris,
          run: () => pickSlot(id),
        })),
      { label: 'Tillbaka', run: homeShop },
    ],
    'Hemmet',
  );
}
function pickSlot(id, moving = null) {
  const free = HOME_SLOTS.filter(
    (s) => !state.home.items.some((it) => it.slot === s.id && it !== moving),
  );
  dialog(
    'Var ska ' + FURNITURE[id].namn.toLowerCase() + ' stå?',
    '',
    [
      ...free.map((s) => ({
        label: capital(s.namn),
        run: () => {
          if (moving) moving.slot = s.id;
          else {
            state.money -= FURNITURE[id].pris;
            state.home.items.push({ id, slot: s.id });
            ledger('Köpte ' + FURNITURE[id].namn.toLowerCase(), -FURNITURE[id].pris);
            sound('win');
          }
          applyHome(state.home);
          save();
          updateHUD();
          homeShop();
        },
      })),
      { label: 'Tillbaka', run: homeShop },
    ],
    'Hemmet',
  );
}
function arrangeDialog() {
  dialog(
    'Flytta eller sälj',
    '<p>Sålda möbler ger tillbaka halva priset.</p>',
    [
      ...state.home.items.flatMap((it) => [
        { label: 'Flytta ' + FURNITURE[it.id].namn.toLowerCase(), run: () => pickSlot(it.id, it) },
        {
          label:
            'Sälj ' +
            FURNITURE[it.id].namn.toLowerCase() +
            ' · +' +
            Math.floor(FURNITURE[it.id].pris / 2) +
            ' €',
          run: () => {
            const back = Math.floor(FURNITURE[it.id].pris / 2);
            state.money += back;
            ledger('Sålde ' + FURNITURE[it.id].namn.toLowerCase(), back);
            state.home.items = state.home.items.filter((x) => x !== it);
            applyHome(state.home);
            save();
            updateHUD();
            arrangeDialog();
          },
        },
      ]),
      { label: 'Tillbaka', run: homeShop },
    ],
    'Hemmet',
  );
}
function apartmentDialog() {
  dialog(
    'Byt lägenhet',
    '<p>Flytten kostar ' +
      MOVING_COST +
      ' € och möblerna följer med. Ny hyra gäller från måndag.</p>',
    [
      ...Object.entries(APARTMENTS).map(([id, a]) => ({
        label:
          (state.home.typ === id ? '✓ ' : '') + a.namn + ' · ' + a.hyra + ' €/vecka · ' + a.text,
        disabled: state.home.typ === id || state.money < MOVING_COST,
        run: () => {
          state.money -= MOVING_COST;
          ledger('Flytt till ' + a.namn.toLowerCase(), -MOVING_COST);
          state.home.typ = id;
          applyHome(state.home);
          addRumor('flytt', { till: a.namn.toLowerCase() });
          reportHappening('flytt', { till: a.namn.toLowerCase() });
          save();
          updateHUD();
          toast('Välkommen till din nya ' + a.namn.toLowerCase() + '!');
          homeShop();
        },
      })),
      { label: 'Tillbaka', run: homeShop },
    ],
    'Hemmet',
  );
}
