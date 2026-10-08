// Ritar 3D-vyn och minikartan
'use strict';
function resize() {
  const ratio = Math.min(1.7, window.innerWidth / window.innerHeight);
  W =
    Math.round(
      clamp(window.innerWidth * (highDetail ? 0.85 : 0.65), 360, highDetail ? 1200 : 720) / 2,
    ) * 2;
  H = Math.round(((W / window.innerWidth) * window.innerHeight) / 2) * 2;
  view.width = W;
  view.height = H;
  zbuffer = new Float32Array(W);
  wallTops = new Float32Array(W);
}
resize();
window.addEventListener('resize', resize);
// Vilken markyta som finns på en punkt utomhus. Används både för att rita marken och för att placera träd.
function outdoorGround(wx, wy) {
  const road = (wy > 16 && wy < 21) || (wx > 37 && wx < 42 && wy >= 21);
  const pavement =
    (wy > 14 && wy < 23) ||
    (wx > 35.8 && wx < 43.5 && wy >= 21) ||
    (wx > 5 && wx < 34 && wy > 38 && wy < 43) ||
    (wx > 46.5 && wx < 50.5 && wy > 23 && wy < 58);
  const park = wx > 31 && wx < 36 && wy > 23 && wy < 53;
  if (road) return 'asphalt';
  if (pavement && !park) return 'paving';
  return 'grass';
}
const floorRGB = [0, 0, 0];
function render() {
  const w = world || worlds.outdoor,
    day = state?.hour ?? 10;
  lightNow = lightLevels(w);
  w.onRender?.();
  // Titta upp/ner flyttar horisonten. Huvudgungen höjer och sänker ögat lite.
  horizon = clamp(H * 0.5 + pitch * H * 0.42 + camera.bob * H * 0.006, H * 0.08, H * 0.92);
  const plane = camera.plane,
    focal = W / (2 * plane),
    eye = 0.58 + Math.abs(camera.bob) * 0.02 - 0.01 * camera.bobAmount,
    angle = player.a,
    dirX = Math.cos(angle),
    dirY = Math.sin(angle),
    planeX = -dirY * plane,
    planeY = dirX * plane,
    cam = { focal, horizon, eye, dirX, dirY, planeX, planeY, plane },
    lit = !!w.lightmap,
    mirrorPlane = w.mirror ? w.mirror.plane : null;
  const light =
    day >= 7 && day <= 18 ? 1 : day >= 6 && day < 7 ? 0.6 : day > 18 && day < 21 ? 0.7 : 0.32;
  if (!w.ceiling) {
    const sky = ctx.createLinearGradient(0, 0, 0, horizon);
    if (w.outdoor) {
      sky.addColorStop(0, light > 0.8 ? '#558cae' : light > 0.4 ? '#4e5371' : '#13273d');
      sky.addColorStop(1, light > 0.8 ? '#c7dcda' : light > 0.4 ? '#d4a782' : '#364658');
    } else {
      sky.addColorStop(0, '#202e3b');
      sky.addColorStop(1, '#63717a');
    }
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, horizon + 1);
  }
  if (w.outdoor) {
    const sunX = ((((angle * 0.25 + 0.65) % 1) + 1) % 1) * W;
    ctx.fillStyle = light > 0.8 ? '#f8ecd0' : '#e3c6a7';
    ctx.beginPath();
    ctx.arc(sunX, horizon * 0.32, W * 0.028, 0, 7);
    ctx.fill();
    ctx.fillStyle = '#ffffff35';
    for (let i = 0; i < 4; i++) {
      const x = ((((i * 0.31 + frame * 0.00005 - angle * 0.12) % 1) + 1) % 1) * W;
      ctx.beginPath();
      ctx.ellipse(x, horizon * (0.3 + (i % 2) * 0.2), W * 0.09, W * 0.014, 0, 0, 7);
      ctx.fill();
    }
  }
  // ---- Golv (och tak inomhus där världen har ett riktigt tak) ----
  const floorTop = Math.floor(horizon),
    startY = w.ceiling ? 0 : floorTop,
    fh = H - startY;
  if (fh > 0) {
    const image = ctx.createImageData(W, fh),
      buf = new Uint32Array(image.data.buffer),
      ceilH = w.wallHeight,
      outdoor = w.id === 'outdoor',
      workYard = w.id === 'work' && w.outdoor,
      partyFloor = homeParty && w.id === 'home',
      dayK = w.outdoor ? light : Math.max(light, 0.74);
    for (let sy = startY; sy < H; sy += 2) {
      const below = sy >= floorTop;
      const dist = below
        ? (eye * focal) / (sy - floorTop + 0.5)
        : ((ceilH - eye) * focal) / (floorTop - sy - 0.5);
      if (!below && dist <= 0) continue;
      const lx = player.x + dist * (dirX - planeX),
        ly = player.y + dist * (dirY - planeY),
        sxs = (2 * dist * planeX) / W,
        sys = (2 * dist * planeY) / W,
        y = sy - startY,
        row0 = y * W,
        row1 = y + 1 < fh ? row0 + W : -1,
        distFade = lit ? clamp(1 - dist * 0.01, 0.7, 1) : clamp(1 - dist * 0.015, 0.48, 1);
      // Taket är jämnt, så där räcker varannan beräkning i sidled.
      const step = below ? 2 : 4;
      for (let x = 0; x < W; x += step) {
        let wx = lx + sxs * x,
          wy = ly + sys * x;
        // Bakom spegeln ser man en spegelvänd kopia av rummet.
        if (mirrorPlane !== null && wy < mirrorPlane) wy = 2 * mirrorPlane - wy;
        let r = 0,
          g = 0,
          b = 0,
          ground = 'paving',
          painted = false;
        if (!below || w.floor) {
          (below ? w.floor : w.ceiling)(wx, wy, floorRGB);
          r = floorRGB[0];
          g = floorRGB[1];
          b = floorRGB[2];
          painted = true;
        } else if (outdoor) {
          ground = outdoorGround(wx, wy);
          if (
            (wy > 16 && wy < 21 && wx > 48 && wx < 53 && Math.floor(wx * 2) % 2 === 0) ||
            (Math.abs(wy - 18.5) < 0.055 && Math.floor(wx / 2) % 2 === 0) ||
            (Math.abs(wx - 39.5) < 0.055 && wy > 23 && Math.floor(wy / 2) % 2 === 0)
          ) {
            r = 225;
            g = 226;
            b = 213;
            painted = true;
          }
        } else if (workYard) {
          ground = 'asphalt';
          if (Math.abs(wx - 8.5) < 0.06 && Math.floor(wy) % 4 < 2) {
            r = 224;
            g = 204;
            b = 135;
            painted = true;
          }
        }
        if (!painted) {
          const texture = groundPack[ground].data,
            tx = ((Math.floor(wx * 56) % 128) + 128) % 128,
            ty = ((Math.floor(wy * 56) % 128) + 128) % 128,
            ti = (ty * 128 + tx) * 4;
          r = texture[ti];
          g = texture[ti + 1];
          b = texture[ti + 2];
        }
        let fade;
        if (lit) fade = lightAt(w, wx, wy) * distFade;
        else
          fade =
            distFade *
            (w.outdoor ? 0.98 : (Math.floor(wx) + Math.floor(wy)) % 2 === 0 ? 0.98 : 0.9) *
            dayK;
        r *= fade;
        g *= fade;
        b *= fade;
        if (partyFloor && below) {
          const glow = partyGlow(wx, wy);
          r += glow[0];
          g += glow[1];
          b += glow[2];
        }
        const px =
          0xff000000 |
          ((b > 255 ? 255 : b) << 16) |
          ((g > 255 ? 255 : g) << 8) |
          (r > 255 ? 255 : r);
        for (let k = 0; k < step && x + k < W; k++) {
          buf[row0 + x + k] = px;
          if (row1 >= 0) buf[row1 + x + k] = px;
        }
      }
    }
    ctx.putImageData(image, 0, startY);
  }
  // ---- Väggar ----
  const mirrorCols = w.mirror ? new Float32Array(W) : null;
  for (let x = 0; x < W; x += 2) {
    const cx = (2 * x) / W - 1,
      rx = dirX + planeX * cx,
      ry = dirY + planeY * cx;
    let mx = Math.floor(player.x),
      my = Math.floor(player.y),
      ddx = Math.abs(1 / rx),
      ddy = Math.abs(1 / ry),
      stepX = rx < 0 ? -1 : 1,
      stepY = ry < 0 ? -1 : 1,
      sx = (rx < 0 ? player.x - mx : mx + 1 - player.x) * ddx,
      sy = (ry < 0 ? player.y - my : my + 1 - player.y) * ddy,
      side = 0,
      tile = 0,
      dist = 40,
      mirrored = false,
      M = 0;
    for (let k = 0; k < 100; k++) {
      if (sx < sy) {
        sx += ddx;
        mx += stepX;
        side = 0;
      } else {
        sy += ddy;
        my += stepY;
        side = 1;
      }
      // I spegelvärlden läses rutnätet spegelvänt kring spegelns plan.
      tile = w.grid[mirrored ? 2 * M - 1 - my : my]?.[mx] ?? 3;
      if (tile === MIRROR && !mirrored && side === 1 && stepY < 0) {
        mirrored = true;
        M = my + 1;
        mirrorCols[x] = mirrorCols[x + 1] = sy - ddy;
        continue;
      }
      if (tile) {
        dist = side ? sy - ddy : sx - ddx;
        break;
      }
    }
    dist = Math.max(0.05, dist);
    zbuffer[x] = zbuffer[x + 1] = dist;
    let u = side ? player.x + dist * rx : player.y + dist * ry;
    if (mirrored && !side) u = 2 * M - u;
    u -= Math.floor(u);
    const base = isDoor(tile) ? tile - DOOR : tile,
      wallHeight = w.id === 'outdoor' ? facadeHeights[base] || 1.2 : w.wallHeight;
    const top = horizon - ((wallHeight - eye) * focal) / dist,
      bottom = horizon + (eye * focal) / dist;
    wallTops[x] = wallTops[x + 1] = top;
    const texture = isDoor(tile)
      ? doorTexture(base, wallHeight, !w.outdoor, w.wallTex?.[base])
      : w.wallTex?.[tile] || wallTextures[(tile - 1) % wallTextures.length];
    ctx.drawImage(
      texture,
      Math.floor(u * (texture.width - 1)),
      0,
      1,
      texture.height,
      x,
      top,
      2,
      bottom - top,
    );
    if (lit) {
      const hx = player.x + rx * dist * 0.995,
        hy0 = player.y + ry * dist * 0.995,
        hy = mirrored ? 2 * M - hy0 : hy0,
        b = lightAt(w, hx, hy) * (side ? 0.93 : 1);
      if (b < 1) {
        ctx.fillStyle = 'rgba(14,18,26,' + clamp(1 - b, 0, 0.85) + ')';
        ctx.fillRect(x, top, 2, bottom - top);
      } else {
        ctx.fillStyle = 'rgba(255,226,180,' + clamp((b - 1) * 0.5, 0, 0.25) + ')';
        ctx.fillRect(x, top, 2, bottom - top);
      }
    } else {
      const shade = clamp(
        (side ? 0.12 : 0) + dist * 0.02 + (w.outdoor ? 1 - light : 0.12),
        0,
        0.85,
      );
      ctx.fillStyle = 'rgba(13,29,39,' + shade + ')';
      ctx.fillRect(x, top, 2, bottom - top);
    }
  }
  ctx.imageSmoothingEnabled = true;
  // ---- Figurer, föremål och möbler i rätt ordning (längst bort först) ----
  const items = [];
  const pushSprite = (o) => {
    const dx = o.x - player.x,
      dy = o.y - player.y,
      depth = dx * dirX + dy * dirY;
    if (depth > 0.1) items.push({ kind: 's', o, depth, lateral: -dx * dirY + dy * dirX });
  };
  for (const o of w.objects) {
    if (o.profile?.id === state?.character || o.hidden) {
      if (o.hidden && o.label) pushSprite(o);
      continue;
    }
    pushSprite(o);
  }
  if (w.mirror) {
    const P = w.mirror.plane;
    for (const o of w.objects)
      if (
        !o.hidden &&
        o.sprite &&
        (o.profile || o.type === 'plant') &&
        o.profile?.id !== state?.character &&
        o.y > P
      )
        pushSprite({ ...o, y: 2 * P - o.y, label: '', virtual: true });
    // Du själv i spegeln.
    const me = profile(),
      out = outfits.find((x) => x.id === state?.outfit),
      moving = Math.hypot(motion.vx, motion.vy) > 0.2;
    if (me)
      pushSprite({
        x: player.x,
        y: 2 * P - player.y,
        height: 1.08,
        virtual: true,
        self: true,
        sprite: npcSprite(
          { ...me, color: out?.color || me.color },
          moving ? Math.floor(frame / 9) % 4 : 0,
        ),
      });
  }
  for (const b of w.boxes || []) items.push({ kind: 'b', b, depth: boxDepth(b, cam) });
  for (const b of w.mirrorBoxes || []) items.push({ kind: 'b', b, depth: boxDepth(b, cam) });
  items.sort((a, b) => b.depth - a.depth);
  const nearLabels = [];
  for (const it of items) {
    if (it.kind === 'b') {
      drawBox(w, it.b, cam);
      continue;
    }
    const o = it.o;
    if (o.profile) {
      const moving = o.targetX != null && Math.hypot(o.targetX - o.x, o.targetY - o.y) > 0.04;
      o.sprite = npcSprite(o.profile, moving ? Math.floor(frame / 10) % 4 : 0);
    }
    const scale = focal / it.depth,
      sh = (o.height || 1) * scale,
      spr = o.sprite,
      sw = spr ? (sh * spr.width) / spr.height : 0,
      px = W / 2 + it.lateral * scale - sw / 2;
    let bob = o.profile ? Math.sin(frame * 0.055 + (o.phase || 0)) * scale * 0.005 : 0;
    if (party && o.profile && w.id === 'w33' && o.x > 33 && o.y < 16)
      bob = Math.sin(frame * 0.17 + o.phase) * scale * 0.045;
    if (homeParty && o.profile && w.id === 'home' && o.dancing)
      bob = Math.abs(Math.sin(frame * 0.16 + (o.phase || 0))) * -scale * 0.05;
    const py = horizon + eye * scale - sh + bob - (o.z || 0) * scale;
    if (spr && !o.hidden) {
      // Syns hela figuren (inget framför den)? Då räcker ett enda ritanrop.
      const x0 = Math.max(0, Math.floor(px / 2) * 2),
        x1 = Math.min(W, px + sw);
      let clear = x1 > x0;
      for (let x = x0; x < x1 && clear; x += 2) if (it.depth > zbuffer[x] + 0.03) clear = false;
      if (clear) {
        ctx.drawImage(spr, px, py, sw, sh);
        if (
          o.label &&
          !o.virtual &&
          it.depth < 5.5 &&
          Math.abs(it.lateral) < it.depth * 0.75 &&
          lineOfSight(o)
        )
          nearLabels.push({ o, x: W / 2 + it.lateral * scale, py });
        continue;
      }
      for (let x = x0; x < x1; x += 2) {
        const visibleHeight = it.depth > zbuffer[x] + 0.03 ? Math.min(sh, wallTops[x] - py) : sh;
        if (visibleHeight <= 0) continue;
        const tx = clamp(((x - px) / sw) * spr.width, 0, spr.width - 1);
        ctx.drawImage(
          spr,
          tx,
          0,
          Math.min((2 / sw) * spr.width, spr.width - tx),
          (spr.height * visibleHeight) / sh,
          x,
          py,
          2,
          visibleHeight,
        );
      }
    }
    if (
      o.label &&
      !o.virtual &&
      it.depth < 5.5 &&
      Math.abs(it.lateral) < it.depth * 0.75 &&
      lineOfSight(o)
    )
      nearLabels.push({ o, x: W / 2 + it.lateral * scale, py });
  }
  // Etiketter sist så att möbler inte täcker dem.
  for (const { o, x, py } of nearLabels) {
    const label =
      near && o.x === near.x && o.y === near.y
        ? o.label
        : o.profile
          ? o.profile.name
          : o.type === 'portal'
            ? o.label.split('·')[0]
            : null;
    if (!label) continue;
    ctx.font = '600 ' + clamp(W / 65, 9, 13) + 'px system-ui';
    const textWidth = ctx.measureText(label).width;
    ctx.fillStyle = '#102635cc';
    ctx.beginPath();
    ctx.roundRect(x - textWidth / 2 - 6, py - 22, textWidth + 12, 18, 5);
    ctx.fill();
    ctx.fillStyle = o.type === 'portal' ? '#a7efd0' : '#edf4f3';
    ctx.textAlign = 'center';
    ctx.fillText(label, x, py - 9);
  }
  // Spegelglas: svag blå ton och en ljusreflex.
  if (mirrorCols) {
    for (let x = 0; x < W; x += 2) {
      const md = mirrorCols[x];
      if (!md) continue;
      const top = horizon - ((w.wallHeight - eye) * focal) / md,
        bottom = horizon + (eye * focal) / md;
      ctx.fillStyle = 'rgba(190,215,230,0.10)';
      ctx.fillRect(x, top, 2, bottom - top);
      const hx = player.x + (dirX + planeX * ((2 * x) / W - 1)) * md;
      const streak = ((((hx - w.mirror.x0) * 1.4) % 1) + 1) % 1;
      if (streak > 0.18 && streak < 0.3) {
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(x, top, 2, bottom - top);
      }
    }
  }
  if (party && w.id === 'w33') {
    ctx.fillStyle = 'hsla(' + ((frame * 2) % 360) + ',80%,60%,.07)';
    ctx.fillRect(0, 0, W, H);
  }
  if (lit && lightNow.sun < 0.5) {
    ctx.fillStyle = 'rgba(255,170,90,' + (0.5 - lightNow.sun) * 0.12 + ')';
    ctx.fillRect(0, 0, W, H);
  }
  if (homeParty && w.id === 'home') {
    ctx.fillStyle = 'hsla(' + ((frame * 1.5) % 360) + ',85%,55%,.06)';
    ctx.fillRect(0, 0, W, H);
  }
  if (job?.type === 'drive') {
    ctx.fillStyle = '#142635';
    ctx.beginPath();
    ctx.moveTo(0, H);
    ctx.lineTo(W * 0.2, H * 0.87);
    ctx.quadraticCurveTo(W * 0.5, H * 0.82, W * 0.8, H * 0.87);
    ctx.lineTo(W, H);
    ctx.fill();
    ctx.strokeStyle = '#516674';
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.arc(W * 0.68, H * 1.02, W * 0.1, Math.PI, 2 * Math.PI);
    ctx.stroke();
  }
  const vignette = ctx.createRadialGradient(
    W / 2,
    H / 2,
    H * 0.1,
    W / 2,
    H / 2,
    Math.max(W, H) * 0.65,
  );
  vignette.addColorStop(0, '#0000');
  vignette.addColorStop(1, lit ? '#08111e55' : '#08111e77');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, W, H);
  drawMap(w);
}
function drawMap(w) {
  const c = mapCtx,
    sz = 148,
    scale = sz / w.size;
  c.fillStyle = w.outdoor ? '#344c36' : '#14252b';
  c.fillRect(0, 0, sz, sz);
  if (w.id === 'outdoor') {
    c.fillStyle = '#738080';
    c.fillRect(0, 16 * scale, sz, 5 * scale);
    c.fillRect(37 * scale, 21 * scale, 5 * scale, sz);
    c.fillStyle = '#b8b7a4';
    c.fillRect(48 * scale, 16 * scale, 5 * scale, 5 * scale);
  }
  for (let y = 0; y < w.size; y++)
    for (let x = 0; x < w.size; x++) {
      if (!w.outdoor && !w.grid[y][x]) {
        c.fillStyle = '#2c4248';
        c.fillRect(x * scale, y * scale, scale + 0.2, scale + 0.2);
      }
      if (
        w.grid[y][x] &&
        (w.outdoor ||
          [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ].some(([dx, dy]) => w.grid[y + dy]?.[x + dx] === 0))
      ) {
        c.fillStyle = w.id === 'outdoor' ? '#a27658' : '#586c74';
        c.fillRect(x * scale, y * scale, scale + 0.2, scale + 0.2);
      }
    }
  for (const o of w.objects) {
    if (o.profile?.id === state?.character || !o.action) continue;
    c.fillStyle = o.profile ? '#82b5d9' : '#92e2bf';
    c.beginPath();
    c.arc(o.x * scale, o.y * scale, w.size > 30 ? 1.8 : 2.3, 0, 7);
    c.fill();
  }
  c.save();
  c.translate(player.x * scale, player.y * scale);
  c.rotate(player.a);
  c.fillStyle = '#ffd18e';
  c.beginPath();
  c.moveTo(6, 0);
  c.lineTo(-4, -4);
  c.lineTo(-2, 0);
  c.lineTo(-4, 4);
  c.closePath();
  c.fill();
  c.restore();
}
function loop(time) {
  const dt = Math.min(0.05, (time - last) / 1000 || 0);
  last = time;
  frame++;
  update(dt);
  render();
  requestAnimationFrame(loop);
}
