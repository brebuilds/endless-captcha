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
- `assets/tiles.js` draws each tile as a grainy, slightly crushed fake photo (emoji on a canvas scene). Output is deterministic per tile.
- `assets/captcha.css` is the component's styles. It deliberately has one look and no dark mode.
- `tests/e2e.cjs` is a headless Playwright run of the acceptance checks (below).

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

Last run (2026-10-27): **28/28 pass**. The run checked:

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
- no console errors

## Not done yet (PRD items that need a human or a decision)

- **Photography.** Tiles are drawn emoji with grain, not photos. The PRD asks for mundane photos with recorded provenance. Swapping them in is a content job; the engine doesn't change.
- **Name and domain.** Undecided (PRD section 15).
- **Analytics sink.** Events fire to `window.cxEvents` and to Vercel Analytics `va()` if it's installed. Nothing is collected until a provider is added.
- **Playtests.** Five observed playtests (PRD section 12), with the bar at 4 of 5 getting the joke by challenge three.
- **Manual screen-reader pass** with VoiceOver and NVDA. The ARIA wiring is in place but hasn't been tested with a real screen reader.
- **Deploy.** Not deployed. Publishing is Bre's call.
