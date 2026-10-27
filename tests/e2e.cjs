const { chromium } = require("playwright");
const BASE = "http://localhost:4540";
const OUT = process.argv[2] || ".";
const fail = [];
const ok = (cond, msg) => { if (!cond) fail.push(msg); console.log((cond ? "PASS " : "FAIL ") + msg); };

async function shownIds(page) {
  return page.evaluate(() => (window.cxEvents || []).filter((e) => e.name === "challenge_shown").map((e) => e.id));
}
async function playOne(page) {
  const before = (await shownIds(page)).length;
  for (let attempt = 0; attempt < 4; attempt++) {
    if (await page.locator(".cx-inter .cx-box").isVisible().catch(() => false)) {
      await page.click(".cx-inter .cx-box");
    } else {
      const label = (await page.textContent(".cx-verify")).trim();
      if (label !== "Skip") {
        const tiles = page.locator(".cx-tile[aria-pressed='false'], .cx-textopt input:not(:checked)");
        if ((await tiles.count()) && !(await page.locator("[aria-pressed='true'], .cx-textopt input:checked").count())) await tiles.first().click();
      } else if (attempt === 0 && Math.random() < 0.5) {
        await page.locator(".cx-tile").first().click();
      }
      await page.click(".cx-verify");
    }
    const t0 = Date.now();
    while (Date.now() - t0 < 4000) {
      if ((await shownIds(page)).length > before) return true;
      const err = await page.locator(".cx-msg.is-err").count();
      if (err && !(await page.locator(".cx-panel.is-busy").count())) break;
      await page.waitForTimeout(100);
    }
    if ((await shownIds(page)).length > before) return true;
  }
  return false;
}

(async () => {
  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  const errors = [];

  // ---- desktop standalone ----
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
  await page.goto(BASE + "/");
  await page.screenshot({ path: OUT + "/01-landing-desktop.png" });
  ok((await page.textContent(".corner a")).trim() === "Add verification to your website", "corner link exact text");
  ok(await page.locator(".cx-panel").isHidden(), "panel hidden on load");
  await page.click(".cx-box");
  await page.waitForSelector(".cx-panel:not([hidden])");
  await page.waitForTimeout(200);
  await page.screenshot({ path: OUT + "/02-first-challenge.png" });
  let ids = await shownIds(page);
  ok(ids[0] === "traffic-lights", "opener 1 = traffic lights (" + ids[0] + ")");

  // answer traffic lights correctly
  for (const i of [0, 2, 5, 8]) await page.click(`.cx-tile[data-i="${i}"]`);
  await page.click(".cx-verify");
  await page.click(".cx-verify").catch(() => {}); // double click guard
  await page.waitForTimeout(2600);
  ids = await shownIds(page);
  ok(ids[1] === "boat", "opener 2 = boat (" + ids[1] + ")");
  ok(ids.length === 2, "double submit did not double-advance (" + ids.length + ")");
  await page.screenshot({ path: OUT + "/03-boat.png" });

  // wrong boat answer -> scripted retry message
  await page.click('.cx-tile[data-i="0"]');
  await page.click(".cx-verify");
  await page.waitForSelector(".cx-msg.is-err", { timeout: 3000 });
  ok((await page.textContent(".cx-msg")).includes("missed"), "boat retry message shown");
  await page.screenshot({ path: OUT + "/04-boat-retry.png" });
  for (const i of [0, 2, 3, 5]) await page.click(`.cx-tile[data-i="${i}"]`);
  await page.click(".cx-verify");
  await page.waitForTimeout(2600);
  ids = await shownIds(page);
  ok(ids[2] === "suspicious-goose", "opener 3 = goose (" + ids[2] + ")");
  await page.screenshot({ path: OUT + "/05-goose.png" });

  // close + reopen resumes
  await page.keyboard.press("Escape");
  ok(await page.locator(".cx-panel").isHidden(), "Escape closes panel");
  await page.click(".cx-box");
  await page.waitForSelector(".cx-panel:not([hidden])");
  ok((await page.textContent(".cx-target")).includes("goose"), "reopen resumes same challenge");

  // play 25 more
  let stuck = 0;
  for (let n = 0; n < 25; n++) { if (!(await playOne(page))) { stuck++; console.log("stuck on", (await shownIds(page)).slice(-1)); break; } }
  ok(stuck === 0, "25 further challenges advanced without getting stuck");
  ids = await shownIds(page);
  const recentDupes = ids.slice(3).some((id, i, a) => a.slice(Math.max(0, i - 11), i).includes(id));
  console.log("sequence:", ids.join(" > "));
  ok(!recentDupes, "no repeat within 12");
  ok(new Set(ids).size >= 20, "variety: " + new Set(ids).size + " unique");
  await page.screenshot({ path: OUT + "/06-later.png" });

  // text mode
  await page.click(".cx-alt");
  await page.waitForTimeout(100);
  await page.screenshot({ path: OUT + "/07-textmode.png" });
  const hasText = (await page.locator(".cx-textopt").count()) > 0 || (await page.locator(".cx-inter").count()) > 0;
  ok(hasText, "text mode renders");
  await page.click(".cx-alt").catch(() => {});

  // info panel + share
  await page.click(".cx-info-btn");
  ok(await page.locator(".cx-info").isVisible(), "info panel opens");
  await page.screenshot({ path: OUT + "/08-info.png" });
  await page.keyboard.press("Escape");
  ok(await page.locator(".cx-info").isHidden(), "Escape closes info");

  // offer link + back restores
  const before = (await shownIds(page)).slice(-1)[0];
  await page.click(".cx-panel"); // keep open
  await page.click(".corner a");
  await page.waitForURL(/embed/);
  await page.waitForTimeout(800);
  await page.screenshot({ path: OUT + "/09-embed.png", fullPage: true });
  await page.click("#back");
  await page.waitForURL(BASE + "/");
  await page.waitForTimeout(300);
  ok(await page.locator(".cx-panel").isVisible(), "back from offer restores open panel");
  const after = await page.evaluate(() => (window.cxEvents || []).filter((e) => e.name === "challenge_shown").map((e) => e.id).slice(-1)[0]);
  ok(after === before, `back restores same challenge (${before} vs ${after})`);

  // shared link
  const p2 = await (await browser.newContext()).newPage();
  await p2.goto(BASE + "/?c=working-printer");
  await p2.click(".cx-box");
  await p2.waitForSelector(".cx-panel:not([hidden])");
  ok((await p2.textContent(".cx-target")).includes("printer"), "shared link starts at that challenge");
  await p2.click(".cx-verify"); // Skip
  await p2.waitForTimeout(2600);
  const ids2 = await p2.evaluate(() => window.cxEvents.filter((e) => e.name === "challenge_shown").map((e) => e.id));
  ok(ids2[1] === "traffic-lights", "after shared challenge, sequence continues with opener (" + ids2[1] + ")");
  const p3 = await (await browser.newContext()).newPage();
  await p3.goto(BASE + "/?c=retired-nonsense");
  await p3.click(".cx-box");
  await p3.waitForSelector(".cx-panel:not([hidden])");
  ok((await p3.textContent(".cx-target")).includes("traffic"), "unknown shared id falls back to opener");

  // ---- mobile 320 ----
  const m = await (await browser.newContext({ viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true })).newPage();
  m.on("pageerror", (e) => errors.push("mobile pageerror: " + e.message));
  await m.goto(BASE + "/");
  await m.screenshot({ path: OUT + "/10-mobile-landing.png" });
  await m.tap(".cx-box");
  await m.waitForSelector(".cx-panel:not([hidden])");
  await m.waitForTimeout(200);
  await m.screenshot({ path: OUT + "/11-mobile-challenge.png", fullPage: true });
  const sw = await m.evaluate(() => document.documentElement.scrollWidth);
  ok(sw <= 320, "no horizontal scroll at 320 (" + sw + ")");
  const overlap = await m.evaluate(() => {
    const a = document.querySelector(".cx-panel").getBoundingClientRect();
    const b = document.querySelector(".corner a").getBoundingClientRect();
    return !(b.top >= a.bottom || b.bottom <= a.top || b.left >= a.right || b.right <= a.left);
  });
  ok(!overlap, "corner link does not overlap panel on mobile");
  await m.goto(BASE + "/embed");
  await m.waitForTimeout(600);
  await m.screenshot({ path: OUT + "/12-mobile-embed.png", fullPage: true });
  const sw2 = await m.evaluate(() => document.documentElement.scrollWidth);
  ok(sw2 <= 320, "embed page no horizontal scroll at 320 (" + sw2 + ")");

  // ---- widget on a separate origin ----
  const host = await (await browser.newContext()).newPage();
  host.on("pageerror", (e) => errors.push("host pageerror: " + e.message));
  await host.goto(BASE + "/embed");
  const snippet = await host.textContent("#code");
  const hostHtml = `<!doctype html><html><body><h1>Test host</h1><form id="f"><input name="x" value="1"><button>Send</button></form>${snippet.replace(/http:\/\/localhost:4540/, "http://127.0.0.1:4540")}</body></html>`;
    await host.goto("http://localhost:4541/");
  const frame = await (await host.waitForSelector("iframe")).contentFrame();
  await frame.waitForSelector(".cx-box");
  await frame.click(".cx-box");
  await frame.waitForSelector(".cx-panel:not([hidden])");
  for (let n = 0; n < 3; n++) {
    const t0 = Date.now();
    const cnt = await frame.evaluate(() => window.cxEvents.filter((e) => e.name === "challenge_shown").length);
    if (await frame.locator(".cx-inter .cx-box").isVisible().catch(() => false)) await frame.click(".cx-inter .cx-box");
    else {
      const lbl = (await frame.textContent(".cx-verify")).trim();
      if (lbl !== "Skip") {
        const target = await frame.textContent(".cx-target");
        if (target.includes("boat")) for (const i of [0, 2, 3, 5]) await frame.click(`.cx-tile[data-i="${i}"]`);
        else await frame.locator(".cx-tile").first().click();
      }
      await frame.click(".cx-verify");
    }
    while (Date.now() - t0 < 5000) {
      const done = await frame.locator(".cx-anchor.is-done").count();
      const c2 = await frame.evaluate(() => window.cxEvents.filter((e) => e.name === "challenge_shown").length);
      if (done || c2 > cnt) break;
      await frame.waitForTimeout(100);
    }
  }
  await host.waitForTimeout(300);
  await host.screenshot({ path: OUT + "/13-widget-complete.png" });
  ok((await frame.textContent(".cx-label")).includes("Verification complete. Probably."), "three-challenge widget completes");
  await frame.click(".cx-again");
  ok((await frame.textContent(".cx-label")).includes("robot"), "Try again resets widget");
  const formOk = await host.evaluate(() => !!document.querySelector("#f input").value);
  ok(formOk, "host form untouched");

  // widget with assets blocked still doesn't break host
  const host2 = await (await browser.newContext()).newPage();
  await host2.route("**/assets/**", (r) => r.abort());
  await host2.route("https://fonts.googleapis.com/**", (r) => r.abort());
    let hostErr = false;
  host2.on("pageerror", () => { hostErr = true; });
  await host2.goto("http://localhost:4541/");
  await host2.waitForTimeout(800);
  ok(!hostErr && (await host2.locator("#f button").isVisible()), "host page fine when widget assets fail");

  ok(errors.length === 0, "no page errors: " + errors.join(" | "));
  await browser.close();
  console.log(fail.length ? `\n${fail.length} FAILED` : "\nALL PASS");
  process.exit(fail.length ? 1 : 0);
})();
