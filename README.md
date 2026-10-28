# Endless CAPTCHA (working name)

A white page with one "I'm not a robot" checkbox. Click it and you get an endless run of
CAPTCHA challenges that start normal and steadily lose their minds. A tiny gray link in the
corner, **Add verification to your website**, leads to a free iframe embed.

Spec: `docs/CAPTCHA-Website-PRD.md` (v1.0, 2026-10-27). Name and domain are
undecided. The provider mark is "CAPTCHaos", a candidate name, set in `assets/captcha.js` (`BRAND`).

## Run it

```sh
npx serve@14.2.4 -l 4540 .     # serve handles clean URLs like /embed and /widget
open http://localhost:4540
```

It's a static site with no build step. On Vercel, `vercel.json` turns on clean URLs and
lets only `/widget` be framed by other sites.

## Routes

| Route | What it is |
|---|---|
| `/` | The endless experience. Nothing on the page but the checkbox and the corner link. |
| `/?c=<challenge-id>` | A shared challenge: it starts there, then continues the normal sequence. Unknown or retired IDs fall back to the opener. |
| `/embed` | The offer page: live preview, single or three-challenge choice, copyable iframe, placement ideas, and an "entertainment only" notice. |
| `/widget?mode=single\|three` | The embeddable, bounded version. It ends on "Verification complete. Probably." with a Try again link. Only `mode` is read; anything else is ignored. |

## Files

- `assets/content.js` holds the challenge manifest: 28 challenges, the openers, and the widget pack. **Add or edit challenges here.**
- `assets/captcha.js` is the component plus engine: states, escalation, history exclusion, callbacks, text mode, the info/share panel, session storage and analytics events.
- `assets/tiles.js` turns each tile's real photo into verification-style imagery: a random crop, washed-out color, grain, a vignette and low-res JPEG. If a photo is missing or fails to load, it falls back to a drawn tile (emoji on a canvas scene).
- `assets/photos/`, `assets/photos.js` and `assets/photos/credits.json` hold the photos, the map from tile to photo, and the license record. All three are generated, so don't edit them by hand.
- `credits.html` (`/credits`) is the attribution page that CC BY photos require. It's linked from the info panel and the offer page.
- `assets/captcha.css` is the component's styles. It deliberately has one look and no dark mode.
- `tests/e2e.cjs` is a headless Playwright run of the acceptance checks (below).

### Photos

Photos come from [Openverse](https://openverse.org), limited to CC0, public domain and CC BY,
which all allow commercial use and modification. They're fetched once and stored in the repo,
never pulled live on a visit.

```sh
node tools/fetch-photos.mjs             # fill in anything missing
node tools/fetch-photos.mjs --refresh   # start over
open http://localhost:4540/tools/photos-review   # contact sheet of every grid
```

- **Search terms** come from the tile's emoji (the `SUBJECTS` map in the script). Give a single tile its own term with a 4th field: `T("🪿", "park", "a goose", "angry goose")`.
- **Results are filtered** to photos whose title or tags actually name the subject, best matches first.
- **To reject a photo**, add its Openverse id (shown on the review sheet) to `tools/photo-overrides.json` under `{"exclude": [...]}`, then rerun the script.
- **To change a subject's search term**, add `{"subjects": {"🪿": "domestic goose"}}`.
- **Look at the review sheet before shipping.** The PRD requires a person to review every image.

### Adding a challenge

Copy an existing entry in `content.js`. Each tile is `[emoji, scene, alt]`. The alt text is also
the label in text mode, so the accessible version comes with every challenge automatically.
Answer policies are `exact`, `any`, `choice`, `impossible`, `callback` and `interstitial`;
the comment at the top of the file explains each one. Set `enabled: false` to retire a challenge.

## How the sequence works

1. The openers always run first: traffic lights (normal), then a boat that includes a gravy boat (almost normal), then a suspicious goose where every tile is a goose (absurd).
2. After that, challenges are picked by escalation tier, which rises every two challenges up to tier 5. Picks lean toward the current tier, with occasional normal ones as lulls. Nothing repeats within the last 12, and two interstitials never come back to back.
3. Callbacks ("Select the goose you previously cleared.", "Select the house you reported earlier.") only show up after their source challenge has been played.
4. Impossible challenges always end. SKIP advances, and a wrong selection gets at most one scripted rejection before moving on. No challenge is timed.

## Tests

```sh
npx serve@14.2.4 -l 4540 .                           # the site
npx serve@14.2.4 -l 4541 <dir with a host index.html> # a separate origin that embeds /widget
CHROME_PATH=<optional chromium> node tests/e2e.cjs <screenshot dir>
```

Last run (2026-10-27): **31/31 pass**. The run checked:

- the exact corner text, and the opener order
- double-submit protection and the scripted retry
- that Escape closes the panel, and that closing then reopening resumes the same challenge
- 25 more challenges with nothing stuck, no repeats within 12, and 24 unique challenges seen
- text mode and the info panel
- that Back from `/embed` restores the open challenge
- shared links, including the unknown-ID fallback
- 320 px width with no overlap and no sideways scroll, on both pages
- the three-challenge widget completing on a separate origin, and Try again
- that the host form is untouched and the host page survives the widget's assets being blocked
- that every tile shows a real photo, blocked photos fall back to drawn tiles, and the credits page lists every photo
- no console errors

## Not done yet (PRD items that need a human or a decision)

- **Final photo review.** The real photos are in, from Openverse, filtered and with credits recorded. A person still needs to go over `/tools/photos-review` and exclude anything off or unflattering.
- **Name and domain.** Undecided (PRD section 15).
- **Analytics sink.** Events fire to `window.cxEvents` and to Vercel Analytics `va()` if it's installed. Nothing is collected until a provider is added.
- **Playtests.** Five observed playtests (PRD section 12), with the bar at 4 of 5 getting the joke by challenge three.
- **Manual screen-reader pass** with VoiceOver and NVDA. The ARIA wiring is in place but hasn't been tested with a real screen reader.
- **Deploy.** Not deployed. Publishing is Bre's call.
