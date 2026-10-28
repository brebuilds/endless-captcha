// Fetches real, openly licensed photos for every challenge tile from Openverse,
// crops them to squares, and writes:
//   assets/photos/<subject>/<n>.jpg   the images
//   assets/photos.js                  tile -> photo map, loaded by the page
//   assets/photos/credits.json        title, creator, license, source for each photo
//
// Usage: node tools/fetch-photos.mjs            (fetch anything missing)
//        node tools/fetch-photos.mjs --refresh   (refetch everything)
// Review the result at /photos-review before shipping. To reject a photo, add its
// Openverse id to tools/photo-overrides.json "exclude" and run the script again.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const PHOTOS = path.join(ROOT, "assets/photos");
const SIZE = 180;
const REFRESH = process.argv.includes("--refresh");

// What to search for, per tile emoji. A tile can override this with a 4th field.
const SUBJECTS = {
  "🚦": "traffic light", "🚥": "traffic signal", "🚗": "parked car", "🚘": "car front", "🏠": "suburban house",
  "🏡": "house garden", "🏘️": "suburban street houses", "🚌": "city bus", "🌳": "tree park", "🚲": "bicycle",
  "⛵": "sailboat", "🫖": "gravy boat", "🚤": "speedboat", "🛶": "canoe", "🪿": "goose",
  "🚕": "taxi cab", "🚙": "suv car", "🚐": "minivan", "🚚": "delivery truck", "🍌": "banana",
  "🍎": "apple fruit", "🥒": "cucumber", "🌽": "corn cob", "🍞": "bread loaf", "🥕": "carrot",
  "🚒": "fire truck", "🚑": "ambulance", "🚓": "police car", "🧳": "suitcase", "👜": "handbag",
  "🎒": "backpack", "💼": "briefcase", "🛍️": "shopping bag", "👝": "coin purse", "🪜": "ladder",
  "🐦": "pigeon", "🕊️": "white pigeon", "📫": "mailbox", "📪": "mailbox", "📬": "mailbox", "📭": "mailbox",
  "🪑": "chair", "🖨️": "office printer", "🍝": "spaghetti", "📶": "wifi router", "📡": "satellite dish",
  "🖥️": "computer monitor", "🧾": "receipt paper", "📝": "sticky note", "☕": "coffee cup", "🔑": "house key",
  "📟": "wireless router", "🦆": "mallard duck", "🦢": "swan", "☁️": "cumulus cloud", "🌥️": "cloud sun",
  "📅": "wall calendar", "🌧️": "rainy street", "🗑️": "trash can curb", "🌮": "taco", "💻": "laptop",
  "🧺": "laundry basket", "🌴": "palm tree", "🛋️": "couch", "🕯️": "candle", "🌇": "sunset city",
  "🪴": "houseplant", "🎸": "acoustic guitar", "🛒": "shopping cart", "🌙": "moon night sky",
  "🧃": "juice box", "🪞": "mirror", "🚏": "bus stop",
};

const overrides = (() => {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, "tools/photo-overrides.json"), "utf8")); }
  catch { return {}; }
})();
const EXCLUDE = new Set(overrides.exclude || []);
Object.assign(SUBJECTS, overrides.subjects || {});

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function loadContent() {
  const ctx = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, "assets/content.js"), "utf8"), ctx);
  return ctx.window.CX_CONTENT;
}

async function search(query, page = 1) {
  // CC0, public domain and CC BY only: commercial use and adaptation allowed.
  const url = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}&license=cc0,pdm,by&mature=false&page_size=20&page=${page}&aspect_ratio=square,wide,tall`;
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": "endless-captcha-photo-fetch (bre@brebuilds.com)" } });
    if (res.status === 429 || res.status >= 500) { await sleep(8000 * (attempt + 1)); continue; }
    if (!res.ok) throw new Error(`Openverse ${res.status} for "${query}"`);
    return (await res.json()).results;
  }
  throw new Error(`Openverse kept failing for "${query}"`);
}

function cropSquare(src, dest) {
  const out = execFileSync("sips", ["-g", "pixelWidth", "-g", "pixelHeight", src], { encoding: "utf8" });
  const w = +out.match(/pixelWidth: (\d+)/)[1];
  const h = +out.match(/pixelHeight: (\d+)/)[1];
  const args = w > h ? ["--resampleHeight", String(SIZE)] : ["--resampleWidth", String(SIZE)];
  execFileSync("sips", [...args, src, "--out", dest], { stdio: "ignore" });
  execFileSync("sips", ["--cropToHeightWidth", String(SIZE), String(SIZE), "-s", "format", "jpeg", "-s", "formatOptions", "72", dest, "--out", dest], { stdio: "ignore" });
}

async function fillSubject(query, credits, POOL) {
  const dir = path.join(PHOTOS, slug(query));
  fs.mkdirSync(dir, { recursive: true });
  const have = credits.filter((c) => c.subject === query && !EXCLUDE.has(c.id) && fs.existsSync(path.join(ROOT, "assets", c.file)));
  if (have.length >= POOL) return have;
  let results;
  try {
    results = await search(query);
    if (POOL - have.length > 6) { await sleep(3500); results = results.concat(await search(query, 2).catch(() => [])); }
  }
  catch (e) { console.warn(`  skipped "${query}": ${e.message} (tiles keep the drawn fallback)`); return have; }
  await sleep(3500); // stay under Openverse's anonymous rate limit
  const used = new Set(credits.map((c) => c.id));
  // Keyword search drifts (a "goose" query returns mountains named Goose). Keep results whose
  // title or tags actually name the subject, best matches first.
  const noun = query.split(" ").pop();
  const score = (r) => {
    const title = (r.title || "").toLowerCase();
    const tags = (r.tags || []).map((t) => (t.name || "").toLowerCase());
    return (title.includes(query) ? 3 : 0) + (title.includes(noun) ? 2 : 0) + (tags.some((t) => t.includes(noun)) ? 1 : 0);
  };
  // No identifiable people: the PRD keeps humor on objects, never on real people.
  const PEOPLE = /\b(people|person|persons|man|men|woman|women|girl|girls|boy|boys|child|children|kid|kids|baby|face|faces|portrait|selfie|adult|crowd|family|friends|couple|bikini)\b/;
  const hasPeople = (r) => (r.tags || []).some((t) => PEOPLE.test((t.name || "").toLowerCase())) || PEOPLE.test((r.title || "").toLowerCase());
  const candidates = results
    .filter((r) => !EXCLUDE.has(r.id) && !used.has(r.id) && r.url && score(r) > 0 && !hasPeople(r))
    .filter((r) => !((r.width && r.width < 300) || (r.height && r.height < 300)))
    .sort((a, b) => score(b) - score(a))
    .slice(0, Math.max(0, POOL - have.length) + 3); // a few spares for failed downloads

  const got = await Promise.all(candidates.map(async (r) => {
    const file = `photos/${slug(query)}/${r.id.slice(0, 8)}.jpg`;
    const dest = path.join(ROOT, "assets", file);
    const tmp = dest + ".dl";
    try {
      const img = await fetch(r.url, { redirect: "follow", signal: AbortSignal.timeout(20000) });
      if (!img.ok || !/image\//.test(img.headers.get("content-type") || "")) return null;
      fs.writeFileSync(tmp, Buffer.from(await img.arrayBuffer()));
      cropSquare(tmp, dest);
    } catch { return null; } finally { fs.rmSync(tmp, { force: true }); }
    return {
      id: r.id, subject: query, file,
      title: r.title || "Untitled", creator: r.creator || "Unknown",
      license: `${r.license === "pdm" ? "Public Domain Mark" : r.license === "cc0" ? "CC0" : "CC BY"} ${r.license_version || ""}`.trim(),
      licenseUrl: r.license_url, source: r.foreign_landing_url || r.url, provider: r.provider,
    };
  }));
  for (const credit of got) {
    if (!credit || have.length >= POOL) {
      if (credit) fs.rmSync(path.join(ROOT, "assets", credit.file), { force: true });
      continue;
    }
    credits.push(credit);
    have.push(credit);
  }
  console.log(`${query}: ${have.length}/${POOL} photos`);
  return have;
}

async function main() {
  const { CHALLENGES } = loadContent();
  fs.mkdirSync(PHOTOS, { recursive: true });
  const creditsPath = path.join(PHOTOS, "credits.json");
  let credits = !REFRESH && fs.existsSync(creditsPath) ? JSON.parse(fs.readFileSync(creditsPath, "utf8")) : [];
  credits = credits.filter((c) => !EXCLUDE.has(c.id));

  const subjectOf = (t) => t[3] || SUBJECTS[t[0]];
  const subjects = [...new Set(CHALLENGES.flatMap((c) => (c.tiles || []).map(subjectOf)))];
  const missing = CHALLENGES.flatMap((c) => (c.tiles || []).filter((t) => !subjectOf(t)).map((t) => `${c.id}: ${t[0]}`));
  if (missing.length) console.warn("No search subject for:", missing.join(", "));

  // Keep as many photos per subject as its busiest challenge needs, plus spares.
  const need = {};
  for (const c of CHALLENGES) {
    const counts = {};
    for (const t of c.tiles || []) if (subjectOf(t)) counts[subjectOf(t)] = (counts[subjectOf(t)] || 0) + 1;
    for (const [s, n] of Object.entries(counts)) need[s] = Math.max(need[s] || 0, n);
  }
  const pools = {};
  for (const s of subjects.filter(Boolean)) {
    pools[s] = await fillSubject(s, credits, Math.min(12, need[s] + 2));
    fs.writeFileSync(creditsPath, JSON.stringify(credits, null, 2) + "\n"); // resume point
  }

  // Assign photos per tile. Repeated subjects within a challenge get different photos;
  // each challenge starts at a different offset so the same goose doesn't star everywhere.
  const map = {};
  for (const c of CHALLENGES) {
    if (!c.tiles) continue;
    const seen = {};
    const offset = [...c.id].reduce((a, ch) => a + ch.charCodeAt(0), 0);
    c.tiles.forEach((t, i) => {
      const pool = pools[subjectOf(t)] || [];
      if (!pool.length) return;
      const k = (seen[subjectOf(t)] = (seen[subjectOf(t)] ?? -1) + 1);
      map[`${c.id}:${i}`] = pool[(offset + k) % pool.length].file;
    });
  }

  const usedFiles = new Set(Object.values(map));
  credits = credits.filter((c) => usedFiles.has(c.file) || pools[c.subject]?.includes(c));
  fs.writeFileSync(creditsPath, JSON.stringify(credits, null, 2) + "\n");
  fs.writeFileSync(path.join(ROOT, "assets/photos.js"),
    "// Generated by tools/fetch-photos.mjs. Tile key -> photo file. Do not edit by hand.\n" +
    `window.CX_PHOTOS = ${JSON.stringify(map, null, 0)};\n`);

  // Remove image files no longer referenced by credits.
  const keep = new Set(credits.map((c) => path.join(ROOT, "assets", c.file)));
  for (const d of fs.readdirSync(PHOTOS)) {
    const dir = path.join(PHOTOS, d);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const f of fs.readdirSync(dir)) if (!keep.has(path.join(dir, f))) fs.rmSync(path.join(dir, f));
    if (!fs.readdirSync(dir).length) fs.rmdirSync(dir);
  }
  console.log(`\n${Object.keys(map).length} tiles mapped, ${credits.length} photos credited.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
