// Ritar 3D-vyn och minikartan
'use strict';
function resize() {
  const ratio = Math.min(1.7, window.innerWidth / window.innerHeight);
  W =
    Math.round(
      clamp(
        window.innerWidth * (highDetail ? 0.85 : 0.65) * QUALITY.scale,
        300,
        highDetail ? 1200 : 720,
      ) / 2,
    ) * 2;
  H = Math.round(((W / window.innerWidth) * window.innerHeight) / 2) * 2;
  view.width = W;
  view.height = H;
  zbuffer = new Float32Array(W);
  wallTops = new Float32Array(W);
}
resize();
window.addEventListener('resize', resize);
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
  const light = 0.32 + 0.68 * daylight(day),
    wxNow = w.outdoor ? weather() : null;
  // Färgen på diset långt bort, samma som himlen vid horisonten.
  const fogRGB = light > 0.8 ? [199, 220, 218] : light > 0.4 ? [212, 167, 130] : [54, 70, 88],
    fogCss = 'rgba(' + fogRGB.join(',') + ',';
  if (!w.ceiling) {
    const sky = ctx.createLinearGradient(0, 0, 0, horizon);
    if (w.outdoor) {
      // Mulet: himlen blir grå.
      const grey = clamp(wxNow.clouds * 1.2 - 0.2, 0, 1);
      sky.addColorStop(0, mixHex(light > 0.8 ? '#558cae' : light > 0.4 ? '#4e5371' : '#13273d', light > 0.4 ? '#7b8389' : '#1c2128', grey));
      sky.addColorStop(1, mixHex(light > 0.8 ? '#c7dcda' : light > 0.4 ? '#d4a782' : '#364658', light > 0.4 ? '#adb4b8' : '#2a3038', grey));
    } else {
      sky.addColorStop(0, '#202e3b');
      sky.addColorStop(1, '#63717a');
    }
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, horizon + 1);
  }
  if (w.outdoor) {
    const sunX = ((((angle * 0.25 + 0.65) % 1) + 1) % 1) * W;
    if (wxNow.clouds < 0.6) {
      ctx.fillStyle = light > 0.8 ? '#f8ecd0' : '#e3c6a7';
      ctx.beginPath();
      ctx.arc(sunX, horizon * 0.32, W * 0.028, 0, 7);
      ctx.fill();
    }
    ctx.fillStyle = wxNow.ned > 0.2 ? '#5f676d55' : '#ffffff35';
    for (let i = 0; i < 2 + Math.round(wxNow.clouds * 10); i++) {
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
      groundMap = w.ground || null,
      gRes = w.groundRes || 1,
      gN = (w.size || 1) * gRes,
      dayK = w.outdoor ? light : Math.max(light, 0.74),
      snowNow = w.outdoor ? snowCover() : 0;
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
          painted = false,
          parking = false;
        if (!below || w.floor) {
          (below ? w.floor : w.ceiling)(wx, wy, floorRGB);
          r = floorRGB[0];
          g = floorRGB[1];
          b = floorRGB[2];
          painted = true;
        } else if (groundMap) {
          const gx = Math.floor(wx * gRes),
            gy = Math.floor(wy * gRes),
            v = gx >= 0 && gy >= 0 && gx < gN && gy < gN ? groundMap[gy * gN + gx] : 1;
          if (v === 1) {
            ground = 'grass';
            // Snö på gräsmattorna på vintern.
            if (snowNow > 0.5) {
              const n = ((Math.floor(wx * 9) * 7 + Math.floor(wy * 9) * 13) % 7) * 2;
              r = 232 + n;
              g = 236 + n;
              b = 240 + n;
              painted = true;
            }
          } else if (v === 2 || v === 4) ground = 'asphalt';
          else if (v === 3) {
            r = 226;
            g = 227;
            b = 218;
            painted = true;
          } else if (v === 5) {
            r = 172;
            g = 172;
            b = 166;
            painted = true;
          } else if (v === 6) {
            // Havet: små vågor som rör sig, eller is och snö på vintern.
            const wave = Math.sin(wx * 2.1 + wy * 0.7 + frame * 0.03) * Math.sin(wy * 1.7 - frame * 0.02);
            if (snowNow > 0.5) {
              r = 214 + wave * 6;
              g = 224 + wave * 6;
              b = 232 + wave * 6;
            } else {
              r = 46 + wave * 10;
              g = 88 + wave * 12;
              b = 112 + wave * 16;
            }
            painted = true;
          }
          if (v === 4) parking = true;
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
          if (parking) {
            r *= 1.08;
            g *= 1.08;
            b *= 1.1;
          }
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
        // Dis mot horisonten på stora ytor.
        if (groundMap && dist > 30) {
          const f = dist > 200 ? 0.6 : ((dist - 30) / 170) * 0.6;
          r += (fogRGB[0] - r) * f;
          g += (fogRGB[1] - g) * f;
          b += (fogRGB[2] - b) * f;
        }
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
    if (w.segments) {
      drawSegmentColumn(w, x, castSegments(w, rx, ry, cam, 190), cam, light, fogCss);
      continue;
    }
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
    if (depth > 0.1 && depth < 140)
      items.push({ kind: 's', o, depth, lateral: -dx * dirY + dy * dirX });
  };
  for (const o of w.objects) {
    if (o.profile && !o.guest && onlineChars.has(o.profile.id)) continue;
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
  // Andra spelare online i samma värld.
  for (const r of remotesHere()) {
    // Kör kompisen egen bil syns bilen i stället för figuren.
    if (r.car) {
      pushSprite({ x: r.x, y: r.y, height: 0.85, remote: r, label: r.name, sprite: carSprite(r.car, carView(r, player.x, player.y)) });
      continue;
    }
    const body = remoteBody(r),
      until = performance.now() + 100;
    pushSprite({
      x: r.x,
      y: r.y,
      height: 1.08,
      profile: remoteProfile(r),
      remote: r,
      label: r.name,
      phase: r.id,
      targetX: r.moving ? r.x + 1 : r.x,
      targetY: r.y,
      waveUntil: body === 'vinka' ? until : 0,
      gestureUntil: body === 'gestikulera' ? until : 0,
      dance: body === 'dansa',
    });
  }
  // Bilar på gatorna (traffic.js).
  for (const c of w.showroom || [])
    pushSprite({ x: c.x, y: c.y, height: 0.85, sprite: carSprite(c.color, carView(c, player.x, player.y)) });
  if (traffic.world === w)
    for (const c of traffic.cars)
      pushSprite({ x: c.x, y: c.y, height: 0.85, sprite: carSprite(c.color, carView(c, player.x, player.y)) });
  // Snöbollar i luften.
  for (const b of balls)
    pushSprite({ x: b.x, y: b.y, z: b.z - 0.07, height: 0.14, sprite: ballSprite() });
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
      // Kroppsspråk (js/game/life.js): vinkar, gestikulerar när de pratar.
      const now = performance.now(),
        flap = Math.floor(frame / 9) % 2;
      o.sprite = npcSprite(
        o.profile,
        o.waveUntil > now
          ? 'w' + flap
          : !moving && (o.gestureUntil > now || o.bubbleUntil > now)
            ? 'g' + (Math.floor(frame / 14) % 2)
            : moving
              ? Math.floor(frame / 10) % 4
              : 0,
      );
    }
    const scale = focal / it.depth,
      // Den som är nere hänger med axlarna och ser lite mindre ut (fötterna står kvar).
      slump = o.profile && (state?.society?.mood[o.profile.id] ?? 60) < 35 ? 0.97 : 1,
      sh = (o.height || 1) * scale * slump,
      spr = o.sprite,
      sw = spr ? (sh * spr.width) / spr.height : 0,
      // Berusade (nattfolk och festfolk ute) vinglar åt sidorna.
      tipsy = o.drunk || (o.activity === 'fest' && w.id === 'outdoor'),
      px =
        W / 2 +
        it.lateral * scale -
        sw / 2 +
        (tipsy ? Math.sin(frame * 0.05 + (o.phase || 0)) * scale * 0.09 : 0);
    let bob = o.profile ? Math.sin(frame * 0.055 + (o.phase || 0)) * scale * 0.005 : 0;
    if (party && o.profile && w.id === 'w33' && o.x > 33 && o.y < 16)
      bob = Math.sin(frame * 0.17 + o.phase) * scale * 0.045;
    if (o.dance || (homeParty && o.profile && w.id === 'home' && o.dancing))
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
          it.depth < (o.remote || o.bubbleUntil > performance.now() ? 16 : 5.5) &&
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
      it.depth < (o.remote || o.bubbleUntil > performance.now() ? 16 : 5.5) &&
      Math.abs(it.lateral) < it.depth * 0.75 &&
      lineOfSight(o)
    )
      nearLabels.push({ o, x: W / 2 + it.lateral * scale, py });
  }
  // Etiketter sist så att möbler inte täcker dem.
  const nowMs = performance.now();
  for (const { o, x, py } of nearLabels) {
    if (o.remote) {
      drawTag(o.remote.name, x, py, '#ffcb83');
      if (o.remote.chatUntil > nowMs) drawBubble(o.remote.chat, x, py - 26);
      continue;
    }
    if (o.bubbleUntil > nowMs) drawBubble(o.bubble, x, py - 26);
    const label =
      near && o.x === near.x && o.y === near.y
        ? o.label
        : o.profile
          ? questMark(o.profile.id) +
            o.profile.name.split(' ')[0] +
            (o.activity ? ' · ' + ACTIVITY_TEXT[o.activity] : '')
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
  if (inVehicle()) {
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
  if (w.outdoor) weatherOverlay(wxNow, light);
  vignette.addColorStop(0, '#0000');
  vignette.addColorStop(1, lit ? '#08111e55' : '#08111e77');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, W, H);
  drawMap(w);
}
// Blandar två färger (#rrggbb), t till 0–1.
function mixHex(a, b, t) {
  const pa = parseInt(a.slice(1), 16),
    pb = parseInt(b.slice(1), 16),
    ch = (sh) => Math.round(((pa >> sh) & 255) * (1 - t) + ((pb >> sh) & 255) * t);
  return 'rgb(' + ch(16) + ',' + ch(8) + ',' + ch(0) + ')';
}
// Regn, snö, dimma och blixtar ovanpå bilden.
const hash01 = (n) => {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};
function weatherOverlay(wx, light) {
  if (wx.dimma > 0.05) {
    ctx.fillStyle = 'rgba(' + (light > 0.5 ? '205,210,212,' : '40,46,54,') + wx.dimma * 0.45 + ')';
    ctx.fillRect(0, 0, W, H);
  }
  if (wx.ned > 0.05) {
    const t = performance.now() / 1000,
      n = Math.round((wx.snö ? 180 : 260) * wx.ned),
      wind = wx.åska ? 0.25 : 0.08;
    if (wx.snö) {
      ctx.fillStyle = '#ffffffcc';
      for (let i = 0; i < n; i++) {
        const sp = 0.06 + ((i * 37) % 10) / 120,
          x = ((((hash01(i) + t * wind * 0.4 + Math.sin(t + i) * 0.01) % 1) + 1) % 1) * W,
          y = ((hash01(i + 0.5) + t * sp) % 1) * H,
          r = 1 + (i % 3) * 0.7;
        ctx.fillRect(x, y, r, r);
      }
    } else {
      ctx.strokeStyle = 'rgba(200,212,224,' + (0.35 + wx.ned * 0.25) + ')';
      ctx.lineWidth = Math.max(1, W / 700);
      ctx.beginPath();
      const len = H * (0.03 + wx.ned * 0.04);
      for (let i = 0; i < n; i++) {
        const x = hash01(i) * W,
          y = ((hash01(i + 0.5) + t * (1.4 + (i % 5) * 0.12)) % 1) * H;
        ctx.moveTo(x, y);
        ctx.lineTo(x - len * wind, y + len);
      }
      ctx.stroke();
    }
  }
  const f = weatherFlash();
  if (f > 0) {
    ctx.fillStyle = 'rgba(235,240,255,' + f * 0.45 + ')';
    ctx.fillRect(0, 0, W, H);
  }
}
// Namnskylt ovanför en figur.
function drawTag(text, x, py, color) {
  ctx.font = '600 ' + clamp(W / 65, 9, 13) + 'px system-ui';
  const tw = ctx.measureText(text).width;
  ctx.fillStyle = '#102635dd';
  ctx.beginPath();
  ctx.roundRect(x - tw / 2 - 6, py - 22, tw + 12, 18, 5);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.fillText(text, x, py - 9);
}
// Pratbubbla från chatten, radbruten till högst tre rader.
function drawBubble(text, x, bottom) {
  const size = clamp(W / 70, 9, 13);
  ctx.font = '500 ' + size + 'px system-ui';
  const maxW = clamp(W * 0.28, 120, 260),
    lines = [];
  let line = '';
  for (const wd of text.split(/\s+/)) {
    const t = line ? line + ' ' + wd : wd;
    if (ctx.measureText(t).width > maxW && line) {
      lines.push(line);
      line = wd;
    } else line = t;
  }
  if (line) lines.push(line);
  if (lines.length > 3) {
    lines.length = 3;
    lines[2] += ' …';
  }
  const lh = size + 4,
    bw = Math.min(maxW + 16, Math.max(...lines.map((l) => ctx.measureText(l).width)) + 16),
    bh = lines.length * lh + 10,
    top = bottom - bh;
  ctx.fillStyle = '#f4f1e8';
  ctx.beginPath();
  ctx.roundRect(x - bw / 2, top, bw, bh, 8);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x - 5, bottom);
  ctx.lineTo(x, bottom + 6);
  ctx.lineTo(x + 5, bottom);
  ctx.fill();
  ctx.fillStyle = '#1b2a33';
  ctx.textAlign = 'center';
  lines.forEach((l, i) => ctx.fillText(l, x, top + 5 + lh * (i + 0.8)));
}
function drawMap(w) {
  const c = mapCtx,
    sz = 148,
    base = minimapBase(w),
    bs = base.scale,
    big = w.size > 70,
    // Stora världar visas som ett utsnitt kring spelaren, små i sin helhet.
    view = big ? 46 : w.size,
    scale = sz / view,
    ox = big ? clamp(player.x - view / 2, 0, w.size - view) : 0,
    oy = big ? clamp(player.y - view / 2, 0, w.size - view) : 0;
  c.fillStyle = '#14252b';
  c.fillRect(0, 0, sz, sz);
  c.imageSmoothingEnabled = false;
  c.drawImage(base.canvas, ox * bs, oy * bs, view * bs, view * bs, 0, 0, sz, sz);
  const P = (x, y) => [(x - ox) * scale, (y - oy) * scale];
  // Sidouppdrag utanför utsnittet: en pil i kanten som visar åt vilket håll.
  for (const o of w.objects) {
    if (o.type !== 'quest') continue;
    const [x, y] = P(o.x, o.y);
    if (x >= 0 && y >= 0 && x <= sz && y <= sz) continue;
    const a = Math.atan2(y - sz / 2, x - sz / 2),
      ex = sz / 2 + Math.cos(a) * (sz / 2 - 7),
      ey = sz / 2 + Math.sin(a) * (sz / 2 - 7);
    c.save();
    c.translate(clamp(ex, 6, sz - 6), clamp(ey, 6, sz - 6));
    c.rotate(a);
    c.fillStyle = '#ffcb83';
    c.beginPath();
    c.moveTo(6, 0);
    c.lineTo(-5, -5);
    c.lineTo(-5, 5);
    c.closePath();
    c.fill();
    c.restore();
  }
  for (const o of w.objects) {
    if (o.profile?.id === state?.character || !o.action || o.stranger || o.reveler) continue;
    if (o.profile && onlineChars.has(o.profile.id) && !o.guest) continue;
    const [x, y] = P(o.x, o.y);
    if (x < -3 || y < -3 || x > sz + 3 || y > sz + 3) continue;
    c.fillStyle = o.type === 'quest' ? '#ffcb83' : o.profile ? '#82b5d9' : '#92e2bf';
    c.beginPath();
    c.arc(x, y, big ? 2.2 : w.size > 30 ? 1.8 : 2.3, 0, 7);
    c.fill();
  }
  c.fillStyle = '#ffcb83';
  for (const r of remotesHere()) {
    const [x, y] = P(r.x, r.y);
    c.beginPath();
    c.arc(x, y, 2.8, 0, 7);
    c.fill();
  }
  const [px, py] = P(player.x, player.y);
  c.save();
  c.translate(px, py);
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
  qualityTick(time);
  update(dt);
  if (use3d()) render3d();
  else render();
  requestAnimationFrame(loop);
}
