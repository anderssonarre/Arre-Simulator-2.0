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
function render() {
  const w = world || worlds.outdoor,
    day = state?.hour ?? 10;
  // Titta upp/ner flyttar horisonten. Huvudgungen höjer och sänker ögat lite.
  horizon = clamp(H * 0.5 + pitch * H * 0.42 + camera.bob * H * 0.006, H * 0.08, H * 0.92);
  const plane = camera.plane,
    focal = W / (2 * plane),
    eye = 0.58 + Math.abs(camera.bob) * 0.02 - 0.01 * camera.bobAmount,
    angle = player.a,
    dirX = Math.cos(angle),
    dirY = Math.sin(angle),
    planeX = -dirY * plane,
    planeY = dirX * plane;
  const light =
    day >= 7 && day <= 18 ? 1 : day >= 6 && day < 7 ? 0.6 : day > 18 && day < 21 ? 0.7 : 0.32;
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
  const floorTop = Math.floor(horizon),
    fh = H - floorTop;
  if (fh > 0) {
    const image = ctx.createImageData(W, fh),
      data = image.data;
    for (let y = 0; y < fh; y += 2) {
      const dist = (eye * focal) / (y + 0.5),
        lx = player.x + dist * (dirX - planeX),
        ly = player.y + dist * (dirY - planeY),
        sx = (2 * dist * planeX) / W,
        sy = (2 * dist * planeY) / W;
      for (let x = 0; x < W; x += 2) {
        const wx = lx + sx * x,
          wy = ly + sy * x;
        let color,
          ground = 'paving',
          painted = false;
        if (w.id === 'outdoor') {
          const road = (wy > 16 && wy < 21) || (wx > 37 && wx < 42 && wy >= 21);
          const pavement =
            (wy > 14 && wy < 23) ||
            (wx > 35.8 && wx < 43.5 && wy >= 21) ||
            (wx > 5 && wx < 34 && wy > 38 && wy < 43);
          const park = wx > 31 && wx < 36 && wy > 23 && wy < 53;
          const crossing = wy > 16 && wy < 21 && wx > 48 && wx < 53 && Math.floor(wx * 2) % 2 === 0;
          const center =
            (Math.abs(wy - 18.5) < 0.055 && Math.floor(wx / 2) % 2 === 0) ||
            (Math.abs(wx - 39.5) < 0.055 && wy > 23 && Math.floor(wy / 2) % 2 === 0);
          ground = road ? 'asphalt' : pavement && !park ? 'paving' : 'grass';
          painted = crossing || center;
          color =
            crossing || center
              ? [225, 226, 213]
              : road
                ? [105, 113, 116]
                : pavement && !park
                  ? [164, 166, 157]
                  : [100, 137, 77];
        } else if (w.id === 'work' && w.outdoor) {
          color = [88, 101, 108];
          if (Math.abs(wx - 8.5) < 0.06 && Math.floor(wy) % 4 < 2) color = [224, 204, 135];
        } else if (w.id === 'home') color = [139, 114, 84];
        else color = [134, 149, 151];
        if (w.id === 'home') ground = 'wood';
        else if (w.id === 'work' && w.outdoor) ground = 'asphalt';
        if (!painted) {
          const texture = groundPack[ground].data,
            tx = ((Math.floor(wx * 56) % 128) + 128) % 128,
            ty = ((Math.floor(wy * 56) % 128) + 128) % 128,
            ti = (ty * 128 + tx) * 4;
          color = [texture[ti], texture[ti + 1], texture[ti + 2]];
        }
        const checker = w.outdoor ? 0.98 : (Math.floor(wx) + Math.floor(wy)) % 2 === 0 ? 0.98 : 0.9,
          fade =
            clamp(1 - dist * 0.015, 0.48, 1) *
            checker *
            (w.outdoor ? light : Math.max(light, 0.74));
        const rr = color[0] * fade,
          gg = color[1] * fade,
          bb = color[2] * fade;
        for (let yy = 0; yy < 2 && y + yy < fh; yy++)
          for (let xx = 0; xx < 2 && x + xx < W; xx++) {
            const i = ((y + yy) * W + x + xx) * 4;
            data[i] = rr;
            data[i + 1] = gg;
            data[i + 2] = bb;
            data[i + 3] = 255;
          }
      }
    }
    ctx.putImageData(image, 0, floorTop);
  }
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
      dist = 40;
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
      tile = w.grid[my]?.[mx] ?? 3;
      if (tile) {
        dist = side ? sy - ddy : sx - ddx;
        break;
      }
    }
    dist = Math.max(0.05, dist);
    zbuffer[x] = zbuffer[x + 1] = dist;
    let u = side ? player.x + dist * rx : player.y + dist * ry;
    u -= Math.floor(u);
    const wallHeight = w.id === 'outdoor' ? facadeHeights[tile] || 1.2 : w.wallHeight;
    const top = horizon - ((wallHeight - eye) * focal) / dist,
      bottom = horizon + (eye * focal) / dist;
    wallTops[x] = wallTops[x + 1] = top;
    const texture = wallTextures[(tile - 1) % wallTextures.length];
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
    const shade = clamp((side ? 0.12 : 0) + dist * 0.02 + (w.outdoor ? 1 - light : 0.12), 0, 0.85);
    ctx.fillStyle = 'rgba(13,29,39,' + shade + ')';
    ctx.fillRect(x, top, 2, bottom - top);
  }
  ctx.imageSmoothingEnabled = true;
  const objects = w.objects
    .filter((o) => o.profile?.id !== state?.character)
    .map((o) => {
      const dx = o.x - player.x,
        dy = o.y - player.y;
      return { ...o, depth: dx * dirX + dy * dirY, lateral: -dx * dirY + dy * dirX };
    })
    .filter((o) => o.depth > 0.1)
    .sort((a, b) => b.depth - a.depth);
  for (const o of objects) {
    if (o.profile) {
      const moving = o.targetX != null && Math.hypot(o.targetX - o.x, o.targetY - o.y) > 0.04;
      o.sprite = npcSprite(o.profile, moving ? Math.floor(frame / 10) % 4 : 0);
    }
    const scale = focal / o.depth,
      sh = (o.height || 1) * scale,
      sw = (sh * o.sprite.width) / o.sprite.height,
      px = W / 2 + o.lateral * scale - sw / 2;
    let bob = o.profile ? Math.sin(frame * 0.055 + o.phase) * scale * 0.005 : 0;
    if (party && o.profile && w.id === 'w33' && o.x > 33 && o.y < 16)
      bob = Math.sin(frame * 0.17 + o.phase) * scale * 0.045;
    const py = horizon + eye * scale - sh + bob - (o.z || 0) * scale;
    for (let x = Math.max(0, Math.floor(px)); x < Math.min(W, px + sw); x += 2) {
      const visibleHeight = o.depth > zbuffer[x] + 0.03 ? Math.min(sh, wallTops[x] - py) : sh;
      if (visibleHeight <= 0) continue;
      const tx = clamp(((x - px) / sw) * o.sprite.width, 0, o.sprite.width - 1);
      ctx.drawImage(
        o.sprite,
        tx,
        0,
        Math.min((2 / sw) * o.sprite.width, o.sprite.width - tx),
        (o.sprite.height * visibleHeight) / sh,
        x,
        py,
        2,
        visibleHeight,
      );
    }
    if (o.label && o.depth < 5.5 && Math.abs(o.lateral) < o.depth * 0.75 && lineOfSight(o)) {
      const label =
        near && o.x === near.x && o.y === near.y
          ? o.label
          : o.profile
            ? o.profile.name
            : o.type === 'portal'
              ? o.label.split('·')[0]
              : null;
      if (label) {
        const x = W / 2 + o.lateral * scale;
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
    }
  }
  if (party && w.id === 'w33') {
    ctx.fillStyle = 'hsla(' + ((frame * 2) % 360) + ',80%,60%,.07)';
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
  vignette.addColorStop(1, '#08111e77');
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
