# Endless CAPTCHA — Product Requirements Document

Version 1.0 · October 27, 2026 · Owner: Bre

Status: Build-ready concept specification. Product name and domain are unconfirmed. “Endless CAPTCHA” is a working descriptor, not an approved brand. Proposed implementation defaults below can be adjusted without changing the agreed experience.

## 1. Product concept

A website that appears to be a routine human-verification screen, then leads visitors through an apparently endless series of increasingly ridiculous CAPTCHA challenges. Its comedy comes from the contrast between a familiar, completely serious interface and unreasonable instructions.

The entire opening page is white, with one centered CAPTCHA checkbox and a tiny gray link in the bottom-right corner:

**Add verification to your website**

That link is present from the beginning. It leads to a real offer: website owners can embed these humorous CAPTCHA experiences on their own sites.

The experience should make someone think: “Wait. What?” Then laugh. Then complete one more challenge. Then send it to someone.

## 2. Confirmed creative direction

These requirements reflect the agreed concept and take priority over optional features.

- Plain white screen; one familiar-looking CAPTCHA component centered in the viewport.
- Initial checkbox wording: “I’m not a robot”.
- Convincing CAPTCHA visual language: compact white or pale-gray panels, thin borders, blue instruction header, grainy photographic tiles, restrained controls, and a VERIFY button.
- Complete one challenge and receive another. No conventional winning screen or finite progress bar.
- Increasingly absurd prompts inside an interface that remains serious.
- Exact product-link wording: “Add verification to your website”. Tiny gray text, bottom-right, visible from initial load.
- No introductory headline, hero illustration, visible site navigation, marketing banner, explanatory popup, confetti, or playful game shell on the experience page.
- No extra “What is this?” corner link or delayed sales reveal. The agreed product link handles discovery.

The design principle: **The interface stays credible. The content loses its mind.**

## 3. Audience and jobs to be done

| Audience | Need | Successful experience |
| --- | --- | --- |
| Curious visitor | A quick, surprising internet distraction | Understands the controls immediately; discovers the joke through play |
| Friend receiving a link | Experience the same funny challenge | Can open a shared challenge without registration |
| Creator or streamer | An amusing reaction-worthy sequence | Challenges are readable, surprising, and easy to record |
| Website owner or designer | Add an unusual interactive detail to a site | Previews a widget and copies an embed without needing developer support |

No visitor account is required for the core experience or the initial free embed.

## 4. Goals and boundaries

### Launch goals

1. Deliver the joke within the first three challenges without explaining it in advance.
2. Make continuing feel effortless and consistently rewarding.
3. Make the corner link lead to a working embed offering, not a dead-end sales promise.
4. Learn whether visitors continue, share, and install the widget.

### Outside the first release

- Real bot detection, identity verification, security scoring, or anti-abuse infrastructure.
- Mandatory form gates or interference with purchases and essential site actions.
- User-generated challenge submissions, image uploads, public galleries, or moderation systems.
- Accounts, billing, paid plans, custom domains, and customer dashboards.
- Daily challenges, leaderboards, speedruns, certificates, visible humanity meters, and elaborate game modes.
- Live AI-generated puzzles. Launch content is authored, reviewed, and stored ahead of time.

The standalone experience may briefly look like a verification step, but must not claim that it protects an account, scans a device, or grants access to a nonexistent service. Use an original provider mark, not Google/reCAPTCHA branding or claims of affiliation. The offer page and widget installation instructions explicitly describe the product as entertainment, not security.

## 5. Core visitor journey

1. Visitor opens `/` and sees the checkbox and corner link. No automatic audio or modal.
2. Visitor clicks the checkbox. A short spinner leads to a standard-looking image challenge.
3. The first challenge is ordinary or almost ordinary. Its purpose is to establish the familiar interaction.
4. Visitor selects tiles and clicks VERIFY. A brief processing state produces understated feedback and the next challenge.
5. The second challenge introduces an odd instruction. By the third, the absurdity should be unmistakable.
6. Further challenges mix subjective judgments, impossible classifications, callbacks, and bureaucratic interruptions.
7. The visitor can continue, refresh a challenge, switch to an accessible text equivalent, close the panel, share through the information control, or follow the corner link at any point.
8. Closing the panel returns to the checkbox; it does not navigate away or discard the current session. Reopening resumes play.

The site has no final “You won” state. A finite launch library supports continued play through shuffled content, authored variants, and callbacks. Do not claim unlimited unique content.

## 6. Visual and interaction specification

| Element | Requirement |
| --- | --- |
| Page background | Solid white; no decorative texture, gradient, or scene |
| Initial checkbox | Approximately 300 × 76 px on desktop; familiar proportions; neutral sans-serif |
| Challenge panel | Approximately 360–400 px wide; responsive to available viewport width |
| Instruction area | Blue background, small lead-in, larger bold target, optional small supporting instruction |
| Image grid | Default 3 × 3, nine equally sized photographic tiles; thin gutters |
| Selected tile | Familiar blue selection treatment and checkmark; selection must also be announced to assistive technology |
| Footer | Refresh, accessible alternative, information control; right-aligned VERIFY or SKIP |
| Feedback | Small, restrained status text within the component |
| Corner link | Visually quiet gray text, roughly 11–12 px, padded click target; accessible contrast and visible keyboard focus |
| Provider identity | Small original mark/name, finalized before release; no recognizable third-party service logo |

Center the visible component on desktop. On short mobile screens, prioritize fitting the challenge and controls without clipping; allow vertical scrolling. Keep the corner link clear of device safe areas and prevent overlap with the challenge. If fixed placement would overlap, put it below the component aligned right.

Use conventional interface typography and modest spacing. Photographs should resemble mundane verification imagery: streets, cars, houses, objects, and everyday scenes. Avoid polished AI illustration or a cartoon aesthetic. Downsample deliberately while keeping objects identifiable. Use owned, commissioned, generated, or appropriately licensed assets with recorded provenance.

Proposed timing: 400–900 ms processing delays; no deliberate delay above 1.5 seconds. Preload the next challenge. Disable duplicate submission while processing. Reduced-motion preferences suppress nonessential motion without removing status feedback.

## 7. Challenge engine

Implement explicit states: idle, loading challenge, selecting, verifying, feedback, next challenge, recoverable error, and closed. Content and transitions must be separate from presentation.

### Selection and progression rules

- Authored opener sequence establishes normal → unusual → absurd.
- After the opener, select from eligible challenges using an escalation tier and recent-history exclusion.
- Ship at least 24 reviewed challenges, including at least eight authored variants or callbacks across the collection.
- Avoid repeating an exact challenge within the previous 12 presented challenges when the eligible pool allows it.
- Refresh replaces the current challenge and never strands the visitor at an unavailable tier.
- Persist current challenge and recent history in session storage; a new session can begin with the opener again.
- Use configurable, deterministic response rules per challenge. Randomness chooses content, not arbitrary endless rejection.
- Objective challenges use defined answer sets. Subjective challenges may accept any nonempty selection and branch feedback by choice.
- Impossible challenges must have an escape: SKIP or progression after at most one scripted rejection. Frustration is a punchline, not a permanent state.
- Never require a timed response to continue.

### Minimum content record

| Field | Purpose |
| --- | --- |
| id, version | Stable content and analytics identity |
| type | Image grid, checkbox interstitial, or text alternative |
| tier, tags | Escalation and content selection |
| leadIn, target, instruction | Displayed challenge copy |
| assets | Image references, text descriptions, license/provenance |
| answerPolicy | Exact set, any selection, choice-based, or scripted impossible |
| responses | Authored success, retry, skip, and callback text |
| maxScriptedRetries | Explicit limit on comedy rejection |
| nextRules | Optional authored transition or callback condition |
| accessibleVariant | Equivalent text interaction and response rules |
| enabled | Remove a challenge without changing rendering code |

Store content in a versioned local manifest for launch. A CMS is optional later.

## 8. Initial editorial direction

The system sounds like a mildly dysfunctional verification provider. It never adds “LOL,” explains its punchlines, or breaks into marketing copy mid-challenge. Humor targets situations, objects, and fictional characters; do not build prompts around humiliating identifiable people or guessing sensitive personal traits.

| Stage | Prompt example | Response or behavior |
| --- | --- | --- |
| Ordinary | Select all images containing traffic lights. | Standard defined answer set |
| Almost normal | Select all images containing a boat. | Includes a gravy boat; accept the authored interpretation |
| Clearly strange | Select all images containing a suspicious goose. | Every tile contains a goose; any nonempty selection progresses |
| Subjective | Select all houses where the HOA president lives. | “Your concern has been recorded.” |
| Impossible | Select the printer that works. | No qualifying tile; SKIP progresses: “Humanity confirmed.” |
| Bureaucratic | Please verify that you completed the previous verification. | Checkbox interstitial |
| Callback | Select the goose you previously cleared. | Uses stored prior choice; refresh remains available |
| Escalated | Select all images containing emotional baggage. | Assorted luggage; “Additional baggage detected.” |
| Absurd | Select all motorcycles. | Spaghetti tiles; one scripted retry at most, then advance |
| Recursive | Verify verification. | “Verification requires additional verification.” |

Additional system copy:

- “Please select all applicable geese.”
- “Your previous answer has raised additional questions.”
- “Please remain human.”
- “Your request has been forwarded to another checkbox.”
- “We detected hesitation.”

These are seed concepts. Final assets, answer rules, and accessible equivalents must be authored together before a challenge ships.

## 9. Offer page and embed product

The corner link opens `/embed` in the same tab. Preserve the play session so Back or “Return to verification” restores it.

The offer page can explain the product openly. Suggested headline: “Make your visitors question their humanity.” Supporting copy: “Ridiculous CAPTCHA-style challenges for your website. Entertainment only. Absolutely no useful security.”

### Launch offering

- A live preview of the same component.
- A curated default challenge pack.
- Choice of a single challenge or a short three-challenge sequence.
- A copyable iframe embed with a descriptive title and accessible sizing instructions.
- Brief placement examples: 404 pages, personal sites, Easter eggs, and optional interactive sections.
- A clear description that completion does not prove a visitor is human or protect a form.
- A completion state for the short embed: “Verification complete. Probably.” and an optional Try again control.
- A small provider link leading back to the standalone experience.

The standalone website is endless; the default embedded experience is bounded so it behaves respectfully inside someone else’s site.

### Integration requirements

- Host the widget on a dedicated `/widget` route with allowlisted configuration values.
- Use an iframe to isolate styles and scripts from the host website.
- Widget loads independently; failure must not block the host page or its forms.
- No required host cookies, credentials, or access to the parent document.
- Provide a fixed, responsive default container; use validated postMessage events only if automatic resizing is introduced.
- Any future completion event is a game event, never a trusted security token.
- No visitor-supplied HTML or executable script in configuration.
- Show a recoverable fallback when assets fail to load.

### Potential paid expansion — unvalidated

Custom copy, themed packs, brand assets, attribution removal, and usage reporting may become paid offerings if installation demand supports them. Pricing is deliberately undecided. Do not build billing before observing real installs and requests for customization.

## 10. Sharing and discovery

Keep sharing off the main page chrome. The familiar information control can open a small panel explaining the parody and offering “Copy this challenge link.” It must also work by keyboard and return focus on close.

A shared URL can identify an approved challenge and variant; it must not contain personal data or arbitrary content. Shared links start with the linked challenge, then continue into the sequence. Unknown or retired IDs fall back to the standard opener.

Provide readable page metadata and a static social preview. The shared preview may tease the premise, but the actual experience page retains the white-screen presentation. No forced signup or sharing gate.

## 11. Accessibility, privacy, and reliability

- Every control is keyboard reachable, labeled, and visibly focused. Space/Enter toggles tiles; selection state is conveyed programmatically.
- Announce instructions, verification feedback, and challenge changes without disruptive repeated announcements.
- Provide a text-based alternative with comparable humor. Do not display a fake audio control that does nothing; use a suitable accessible-alternative control until audio is implemented.
- Escape closes overlays and restores focus. The page never traps navigation or the browser Back button.
- Include adequate text contrast and generous invisible touch padding around compact icons and the corner link.
- Collect minimal interaction analytics. No fingerprinting, cursor surveillance, submitted personal information, or claims of biometric analysis.
- Expose privacy/product details through the information panel and offer page without adding new homepage marketing chrome.
- Lazy-load nonessential content and compress images. Target usable initial interaction within 2 seconds on a representative midrange phone and ordinary mobile connection; measure during implementation.
- Asset failure produces a real retry/skip option, not an indistinguishable comedy failure. Analytics failure must not interrupt play.

## 12. Analytics and validation

Track anonymous events: experience_loaded, checkbox_started, challenge_shown, challenge_submitted, challenge_advanced, challenge_skipped, accessible_mode_selected, share_copied, embed_offer_opened, embed_code_copied, widget_loaded, and widget_completed.

Attach only necessary properties such as challenge ID/version, tier, source route, sequence position, and elapsed time. Do not capture raw text answers. Distinguish standalone sessions from embedded sessions. Aggregate verified third-party widget loads separately from preview loads; copying code is not proof of installation.

Primary questions:

1. Do people recognize the interaction without instructions?
2. Do they reach challenge three and understand the joke?
3. Do they voluntarily continue beyond challenge five?
4. Which challenges cause delighted continuation versus confused exits?
5. Do visitors copy links or open the embed offer?
6. Do copied embeds become real third-party loads and completed plays?

Before launch, conduct five lightweight observed playtests. Proposed gate: at least four participants start without coaching and recognize the joke by challenge three. Treat this as a qualitative check, not market validation. Establish quantitative continuation and conversion baselines after launch rather than inventing success benchmarks.

## 13. Release acceptance criteria

- On desktop and mobile, initial load contains only the CAPTCHA component and the exact corner-link text on white.
- No marketing reveal, extra corner link, or popup appears after challenge two.
- The first three challenges follow the intended escalation; subsequent submissions continue the experience.
- All 24 launch challenges have assets, response rules, accessible alternatives, and reviewed copy.
- No impossible challenge can block progress; refresh and skip behavior are tested.
- Repeated clicks cannot create overlapping transitions or duplicate challenge advances.
- Closing and reopening resumes the session; Back from the offer restores it.
- The page remains usable at 320 px width and with enlarged text; controls and the corner link do not overlap.
- Keyboard and screen-reader testing covers opening, selecting, submitting, switching mode, information, and closing.
- The embed can be copied and installed on a separate test origin; single and three-challenge modes finish as specified.
- Widget failures do not affect host navigation or form submission.
- Missing images, retired shared IDs, disabled storage, and analytics failure have usable fallbacks.
- No third-party CAPTCHA logos, real-security claims, or misleading verification tokens appear.

## 14. Delivery sequence

**Milestone 1 — Prove the joke:** Build the white page, checkbox, panel, corner link, and five representative challenges. Test comedic timing and visual credibility before expanding content.

**Milestone 2 — Complete the experience:** Add the state engine, 24-challenge library, escalation, session continuity, accessible alternatives, recoverable errors, and challenge sharing.

**Milestone 3 — Make the offer real:** Build the offer page, widget route, single/three-challenge configuration, copyable iframe, and installation instructions. Verify on a separate website.

**Milestone 4 — Validate and launch:** Run observed playtests, mobile/accessibility checks, performance checks, and analytics verification. Adjust weak challenges and publish when the acceptance criteria pass.

## 15. Remaining decisions

| Decision | Proposed default |
| --- | --- |
| Public name/domain | Keep undecided until naming and availability review; CAPTCHaos remains a candidate |
| Technology | Use the existing preferred web stack; keep challenge content framework-independent |
| Image source | Owned/licensed/generated mundane photography; review realism and provenance |
| Monetization | Free initial embed; validate custom-pack demand before billing |
| Broader game modes | Revisit only after the core loop and embeds show engagement |

The launch should feel like one small, suspiciously persistent verification box. Everything built around it should help that experience work—not explain the joke before someone gets to enjoy it.
