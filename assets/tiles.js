// Renders a tile spec [emoji, scene, alt] into a grainy, slightly-too-compressed
// "verification photo" data URL. Deterministic per seed, so callbacks and shared
// links show the same pictures. Placeholder until real photography lands.
(function () {
  const SIZE = 132;
  const cache = new Map();

  function rng(seedStr) {
    let h = 2166136261;
    for (let i = 0; i < seedStr.length; i++) h = Math.imul(h ^ seedStr.charCodeAt(i), 16777619);
    return () => {
      h += 0x6d2b79f5;
      let t = h;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Each scene: sky/top color, ground color, horizon height, plus a detail painter.
  const SCENES = {
    street: { top: ["#b9c4cc", "#9fb0bd"], ground: ["#6f7377", "#5b5f63"], horizon: 0.45, detail: streetDetail },
    sky: { top: ["#8fb6d8", "#c9dbe9"], ground: null, horizon: 1, detail: skyDetail },
    suburb: { top: ["#c3d3df", "#dfe7ec"], ground: ["#7c9a5e", "#6a8750"], horizon: 0.55, detail: suburbDetail },
    park: { top: ["#b4c9d6", "#d4e0e6"], ground: ["#6f9150", "#58783f"], horizon: 0.42, detail: parkDetail },
    field: { top: ["#c6d6e1", "#e7ecef"], ground: ["#a3a05f", "#8d8a4f"], horizon: 0.5, detail: null },
    water: { top: ["#b7cad8", "#d9e3ea"], ground: ["#5d7f93", "#486a7e"], horizon: 0.4, detail: waterDetail },
    table: { top: ["#d9cfc2", "#c8bcad"], ground: ["#8a6a4c", "#77593d"], horizon: 0.38, detail: tableDetail },
    office: { top: ["#e3e1dc", "#d3d1cb"], ground: ["#9c9a94", "#8a8882"], horizon: 0.62, detail: officeDetail },
    closet: { top: ["#cfc7bd", "#bdb3a7"], ground: ["#7d7064", "#6b5f54"], horizon: 0.66, detail: null },
  };

  function streetDetail(ctx, r) {
    ctx.fillStyle = "rgba(240,240,230,.55)";
    for (let i = 0; i < 4; i++) ctx.fillRect(i * 40 + r() * 10, SIZE * 0.78, 22, 4);
    ctx.fillStyle = "rgba(90,95,105,.45)";
    for (let i = 0; i < 3; i++) {
      const w = 22 + r() * 30, h = 20 + r() * 40;
      ctx.fillRect(r() * SIZE, SIZE * 0.45 - h, w, h);
    }
  }
  function skyDetail(ctx, r) {
    ctx.fillStyle = "rgba(255,255,255,.35)";
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.ellipse(r() * SIZE, r() * SIZE * 0.6, 20 + r() * 25, 7 + r() * 8, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  function suburbDetail(ctx, r) {
    ctx.fillStyle = "rgba(70,90,60,.5)";
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(r() * SIZE, SIZE * 0.55, 8 + r() * 14, Math.PI, 0);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(200,195,185,.6)";
    ctx.fillRect(SIZE * (0.3 + r() * 0.3), SIZE * 0.55, 16, SIZE * 0.45);
  }
  function parkDetail(ctx, r) {
    ctx.fillStyle = "rgba(55,80,45,.55)";
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.arc(r() * SIZE, SIZE * 0.42 - r() * 10, 10 + r() * 16, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  function waterDetail(ctx, r) {
    ctx.strokeStyle = "rgba(220,235,245,.35)";
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 7; i++) {
      const y = SIZE * 0.45 + r() * SIZE * 0.55;
      ctx.beginPath();
      ctx.moveTo(r() * SIZE, y);
      ctx.lineTo(r() * SIZE, y + 1);
      ctx.stroke();
    }
  }
  function tableDetail(ctx, r) {
    ctx.strokeStyle = "rgba(60,40,25,.25)";
    for (let i = 0; i < 6; i++) {
      const y = SIZE * 0.4 + r() * SIZE * 0.6;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(SIZE * 0.3, y + 3, SIZE * 0.7, y - 3, SIZE, y);
      ctx.stroke();
    }
  }
  function officeDetail(ctx, r) {
    ctx.fillStyle = "rgba(250,250,245,.5)";
    ctx.fillRect(SIZE * (0.05 + r() * 0.5), SIZE * 0.08, 36, 30);
    ctx.fillStyle = "rgba(120,120,115,.35)";
    ctx.fillRect(0, SIZE * 0.6, SIZE, 3);
  }

  function grad(ctx, y0, y1, [a, b]) {
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, a);
    g.addColorStop(1, b);
    return g;
  }

  function paint(spec, seed) {
    const [emoji, sceneName] = spec;
    const scene = SCENES[sceneName] || SCENES.street;
    const r = rng(seed);
    const c = document.createElement("canvas");
    c.width = c.height = SIZE;
    const ctx = c.getContext("2d");
    const hy = SIZE * scene.horizon;

    ctx.fillStyle = grad(ctx, 0, hy, scene.top);
    ctx.fillRect(0, 0, SIZE, hy);
    if (scene.ground) {
      ctx.fillStyle = grad(ctx, hy, SIZE, scene.ground);
      ctx.fillRect(0, hy, SIZE, SIZE - hy);
    }
    if (scene.detail) scene.detail(ctx, r);

    // The subject: off-center, a little rotated, sometimes cropped, like a real photo.
    const fs = SIZE * (0.42 + r() * 0.24);
    const x = SIZE * (0.3 + r() * 0.4);
    const y = SIZE * (0.45 + r() * 0.25);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((r() - 0.5) * 0.35);
    // Painted contact shadow. Note: color emoji inherit the fillStyle's alpha in Chrome,
    // so the subject must be drawn with an opaque fill (set below).
    ctx.fillStyle = "rgba(0,0,0,.22)";
    ctx.beginPath();
    ctx.ellipse(0, fs * 0.42, fs * 0.36, fs * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = `${fs}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#000";
    ctx.fillText(emoji, 0, 0);
    ctx.restore();

    return degrade(c, ctx, r, 76);
  }

  // Wash out, add grain, vignette, then crush it through low-res JPEG.
  // Shared by drawn tiles and real photos so both look like verification imagery.
  function degrade(c, ctx, r, out) {
    const img = ctx.getImageData(0, 0, SIZE, SIZE);
    const d = img.data;
    const warm = (r() - 0.5) * 14;
    for (let i = 0; i < d.length; i += 4) {
      const l = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
      const n = (r() - 0.5) * 34;
      d[i] = d[i] * 0.72 + l * 0.28 + n + warm;
      d[i + 1] = d[i + 1] * 0.72 + l * 0.28 + n;
      d[i + 2] = d[i + 2] * 0.72 + l * 0.28 + n - warm;
    }
    ctx.putImageData(img, 0, 0);
    const v = ctx.createRadialGradient(SIZE / 2, SIZE / 2, SIZE * 0.3, SIZE / 2, SIZE / 2, SIZE * 0.75);
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, "rgba(0,0,0,.28)");
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, SIZE, SIZE);

    const small = document.createElement("canvas");
    small.width = small.height = out;
    const sctx = small.getContext("2d");
    sctx.drawImage(c, 0, 0, out, out);
    return small.toDataURL("image/jpeg", 0.5);
  }

  // A real photo, cropped with a slight random zoom, then degraded.
  // Photos keep a bit more resolution than drawn tiles so subjects stay identifiable.
  function paintPhoto(photo, seed) {
    const r = rng(seed);
    const c = document.createElement("canvas");
    c.width = c.height = SIZE;
    const ctx = c.getContext("2d");
    const side = Math.min(photo.naturalWidth, photo.naturalHeight) * (0.82 + r() * 0.18);
    const sx = (photo.naturalWidth - side) * r();
    const sy = (photo.naturalHeight - side) * r();
    ctx.drawImage(photo, sx, sy, side, side, 0, 0, SIZE, SIZE);
    return degrade(c, ctx, r, 104);
  }

  function tileImage(spec, seed) {
    const key = seed + "|" + spec[0] + "|" + spec[1];
    if (!cache.has(key)) cache.set(key, paint(spec, seed));
    return cache.get(key);
  }

  const photoCache = new Map();
  function loadPhoto(file) {
    if (!photoCache.has(file)) {
      photoCache.set(file, new Promise((resolve, reject) => {
        const im = new Image();
        im.onload = () => resolve(im);
        im.onerror = reject;
        im.src = (window.CX_ASSET_BASE ?? "/assets/") + file;
      }));
    }
    return photoCache.get(file);
  }

  // Fill an <img> for a tile. Uses the real photo when one is mapped (assets/photos.js)
  // and falls back to the drawn tile if there is none or it fails to load.
  function fill(imgEl, spec, seed) {
    const file = (window.CX_PHOTOS || {})[seed];
    if (!file) { imgEl.src = tileImage(spec, seed); imgEl.dataset.kind = "drawn"; return Promise.resolve("drawn"); }
    const key = "photo|" + seed;
    if (cache.has(key)) { imgEl.src = cache.get(key); imgEl.dataset.kind = "photo"; return Promise.resolve("photo"); }
    return loadPhoto(file).then((photo) => {
      cache.set(key, paintPhoto(photo, seed));
      imgEl.src = cache.get(key);
      imgEl.dataset.kind = "photo";
      return "photo";
    }).catch(() => {
      imgEl.src = tileImage(spec, seed);
      imgEl.dataset.kind = "drawn";
      return "drawn";
    });
  }

  // Warm the cache for a challenge's tiles before it is shown.
  function preload(tiles, seedBase) {
    const map = window.CX_PHOTOS || {};
    tiles.forEach((_, i) => { const f = map[seedBase + ":" + i]; if (f) loadPhoto(f).catch(() => {}); });
  }

  window.CX_TILES = { tileImage, fill, preload };
})();
