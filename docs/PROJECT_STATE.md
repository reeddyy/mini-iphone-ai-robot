# Mini project state and development memory

Updated **2 November 2026 (Asia/Singapore)**. Read this first when continuing in a new chat or replacement cloud workspace. This is a curated handoff, not a transcript of every prior conversation. The user requested durable documentation because an earlier chat/workspace could not be resumed.

## Repository and current baseline

- Public repository: https://github.com/reeddyy/mini-iphone-ai-robot
- Published branch: `main`. The previous cloud checkout used a local branch named `work` and pushed with `git push origin HEAD:main`.
- Application version: **6.6.0**. No package-version bump accompanied the settings/template changes.
- Current application behavior includes the startup/game-exit/story-narration fixes and the proactive learning update below; model/configuration selections remain as established in **`6c07960`**. Use `git log -5 --oneline` and the current remote for the latest code/documentation commit.
- Latest feedback: Mini was weak at camera reactions, conversation initiative and maths/science teaching. The user confirmed **“Local reactions on · face in view”** on iPhone. The update adds deferred camera invitations, planner-independent play ideas, one quiet-time check-in and checked bilingual mini-lessons. **223 Node tests, 13 new proactive browser scenarios, the nine-checkpoint child replay and all existing browser suites pass**, including real local landmark inference. Physical iPhone voice/audio and the updated experience still need device checks. See [the proactive review](PROACTIVE_REVIEW_2026-11-02.md).

| Commit | Shipped change |
| --- | --- |
| `9cc8dc1` | Generated pictures, session-safe visual closing, camera improvements and bilingual playful learning. |
| `bf98c0e` | Simplified grown-up settings, enabled feature defaults, explicit startup confirmation, automatic safe preference storage and regression coverage. |
| `6c07960` | Updated `.env.example`: image-model default, current setup instructions and removal of the unnecessary legacy awareness setting from the template. |
| `63db2d2` | Published project memory, recovery guide, agent entry point and refreshed documentation. |
| `a8e05e5` | Published the browser scenario review, screenshots and manual failure/recovery checks. |
| `0ed14b1` | Published secure credential setup instructions for pending live-deployment checks. |
| `1788409` | Fixed visible parent startup errors; verified 197 Node tests and all 9 exploratory browser scenarios. |
| `f257153` | Recorded authenticated live HTTP/UI, one planner request and one real image, separately from unverified voice transport. |
| `414a10d` | Fixed local game-to-chat exits and empty story-choice narration after the 23-checkpoint child review. |

These commits were pushed to GitHub `main`. See [CHANGELOG.md](../CHANGELOG.md) for release history and [RECOVERY.md](RECOVERY.md) for a fresh checkout. The subsequent browser review is recorded in [TEST_REVIEW_2026-11-02.md](TEST_REVIEW_2026-11-02.md).

## What the app is

Mini is a voice-first English/Mandarin companion for a six-year-old, opened in **iPhone Safari**. The user's existing installation is on Windows, historically in `D:\Ai-projects\mini-iphone-ai-robot`, with a protected ngrok HTTPS tunnel. Verify their current path and port when diagnosing a device; do not assume this cloud machine is their Windows installation.

The child screen has an animated face, short status, optional pictures/games and a pinned Stop control. Spoken requests move between chat, stories, riddles, toy descriptions and local rule-based games within the ongoing voice session. Generated pictures are still images with local motion, not generated video. No SVG/sketch substitute is shown after an image failure.

There are no external npm dependencies, build step, native iOS app or database. Node.js 22+ serves plain HTML/CSS/JavaScript. The backend proxies WebRTC SDP setup; live microphone/video and Qwen audio then travel over the browser's WebRTC connection. Separate planner/image requests go through the backend.

## User decisions to preserve

The user asked for the grown-up settings to be easy, minimal and default on. The main sheet keeps only **access code, language, Stop after, Camera and Pictures**. Free local games and Troubleshooting are collapsed below it.

- All available features default on: story/game planning, generated pictures, playful learning, follow-ups, local camera reactions, bounded quiet-time hellos and local play sounds.
- Camera and Pictures remain visible switches. A parent enters the access code and confirms every new session. Confirmation names microphone/camera sharing and paid image usage. Cancellation starts neither media capture nor paid requests. Free preview also has a local-capture confirmation.
- Fresh defaults: Auto English/Mandarin, 15 minutes, front camera, balanced camera detail, quiet-voice sensitivity, balanced speech pacing and 2 AI camera frames/sec. The source camera targets smooth local preview separately.
- A playful personality follows the child automatically. Separate personality, favourite-topic, preference-note, memory, frame-rate, follow-up, visual-planning, awareness, greeting and sound switches were removed.
- Language, duration and the four remaining camera/microphone troubleshooting choices are remembered automatically. Camera/Pictures choices last for the visit, survive Stop, and default on again after refresh. They are not saved to storage. Old feature-off flags and preference notes do not enter new sessions; Reset settings clears old stored preferences/notes.
- Stop, hiding Safari and page departure release microphone/camera capture, cancel pending work and stop local inference. Another session requires a fresh Start confirmation. There is no automatic paid reconnect.
- Keep English/Mandarin continuity, speech interruption, short age-appropriate turns, gentle learning and a visible Stop control.
- Explicit English/Mandarin chat requests leave counting, hand games and tic-tac-toe locally without another planner request. Preserve capture and restore ordinary voice playback for the current response, including late transcript ordering. A story continuation with no message uses its displayed title for local narration.
- Latest product direction: bilingual, proactive, positive, fun and educational. Mini supplies short topic-aware invitations without depending on Pictures/planner access, and checked local maths/science turns inside the conversation. Keep the child's ability to skip/change topics, use kind hints, leave time for answers and suppress new invitations after explicit declines, distress or requests for quiet.

This development-memory file is separate from Mini's child-session state. The removed preference-note feature remains removed. Do not add transcript/media storage to satisfy a request to preserve development context.

## Models and configuration

The user reported these model selections in their private Windows configuration; no private key, workspace ID or access code is included here:

```dotenv
ALIBABA_VISUAL_MODEL=qwen-plus
ALIBABA_IMAGE_MODEL=qwen-image-3.0
ALIBABA_IMAGE_ENDPOINT=singapore
```

| Job | Current model/configuration | Integration |
| --- | --- | --- |
| Live voice and optional camera understanding | `qwen3.8-omni-flash-realtime`, selected in `server.mjs` | Singapore workspace WebRTC endpoint. |
| Story/image prompts and game choices | `ALIBABA_VISUAL_MODEL=qwen-plus` | Chat Completions returning validated JSON; this model does not generate pixels. |
| Actual pictures | `ALIBABA_IMAGE_MODEL=qwen-image-3.0` | Synchronous native multimodal image API; one 1024×1024 image per Mini request. |
| Local smile/wink/head reactions | Bundled MediaPipe Face Mesh | On-device worker; no separate Qwen vision-model setting. |

Explicit picture requests can bypass the planner while retaining authorization, single-use tickets and image budgets. Other visual turns may make an additional paid planning request. Normal session limits are 60 planning attempts and 4 image attempts. Application timers/limits are not provider-enforced financial caps.

The backend retains a legacy cloud observation endpoint and a `qwen-vl-plus` fallback for older clients. The current UI declines cloud-awareness grants and does not call that endpoint. Removing `ALIBABA_AWARENESS_MODEL` from the example did not delete the legacy API.

`.env.example` is a public template. `npm start` reads the private **`.env`**; `git pull` never updates it. Leave the API key and workspace ID empty for free preview. Use matching Singapore pay-as-you-go credentials for live sessions; do not substitute a Token Plan/Coding Plan key. The template/server port default is **3000**; existing Windows/cloud preview instructions commonly use **3001**. Match the browser and tunnel to the actual `.env` port.

### Model evidence and uncertainty

On **2 November 2026**, public Alibaba documentation was retrieved successfully: the [Qwen API reference](https://www.alibabacloud.com/help/en/model-studio/qwen-api-via-dashscope), updated 27 October, still names `qwen-plus` for Singapore text requests. The [Qwen-Image API reference](https://www.alibabacloud.com/help/en/model-studio/qwen-image-api), updated 22 October, also uses `qwen-plus` as an orchestrating chat model. This supports retaining the planner setting.

The `qwen-image-3.0` recommendation originally came from the published integration evidence recorded in [image-model-research.md](image-model-research.md). Public pages and model-ID metadata alone do **not** prove account-specific generation access. The subsequent [authenticated live review](LIVE_REVIEW_2026-11-02.md) did verify one real `qwen-plus` plan and one `qwen-image-3.0` generation through the user's configured backend; broad quality, latency and other-model guarantees remain unsupported.

Earlier repository notes report `qwen-image-plus` HTTP 404 on Windows. That was an older-model failure. The subsequent real `qwen-image-3.0` request succeeded; `qwen-image-plus` itself was not retested. Persistent image model/auth/access/quota failures suppress artwork until the server restarts; voice can continue. Keep safe stage/model/HTTP/provider diagnostics for a real account check instead of guessing or retrying across models.

## Source map

| Location | Responsibility |
| --- | --- |
| `server.mjs` | Static serving, parent authentication, SDP exchange, grants, budgets, visual APIs and diagnostics. |
| `public/index.html`, `public/app.js` | Screens, controls, session orchestration, WebRTC, capture, startup confirmation and teardown. |
| `public/mini-child-ui.js`, `mini-kids.js`, `mini-extras.js` | Expressions, narration, conversation instructions and browser helpers; some legacy helpers remain without UI controls. |
| `public/mini-learning.js` | Bounded topic-aware invitations, bilingual checked maths/science mini-lessons, hints and session-only progress; no child-profile storage. |
| `public/mini-language.js`, `mini-camera.js` | Session language continuity and separate preview/outbound camera pacing. |
| `public/mini-board.js`, `mini-activities.js`, `mini-visuals.js`, `mini-visual-schema.js` | Local game rules, activity state, visual rendering and bounded scene protocol. |
| `public/mini-local-awareness.js`, `mini-face-worker.js`, `public/vendor/mediapipe/` | On-device landmarks and observable geometry reactions. |
| `visual-provider.mjs`, `picture-request.mjs`, `model-catalog.mjs` | Planner/image provider adapter, direct picture intent and metadata-only model checks. |
| `awareness-provider.mjs`, `public/mini-awareness.js` | Legacy cloud observation path; not the current UI's normal reaction mechanism. |
| `tests/`, `scripts/`, `.github/workflows/ci.yml` | Node tests, local Chromium checks and CI. |
| `README.md`, `SECURITY.md`, `docs/` | User setup, security properties, architecture, evidence, recovery and validation. |

## Validation actually completed

On **2 November 2026**, after the settings changes:

- `npm test`: **194 passed, 0 failed**. Providers/media events are mocked; CI needs no live key.
- `node scripts/parent-settings-browser-smoke.mjs`: passed using the local fixture and synthetic media. Covered 320×568, 390×844, 430×932 and 844×390 layouts, enabled defaults, legacy preference handling, Cancel before capture/paid requests, voice-only play, Stop teardown, safe persistence and Reset.
- `node scripts/companion-close-browser.mjs`: passed using mocked signaling/provider responses and real synthetic capture. Covered picture flow, local animation/reduced motion, the same live microphone/camera after Back to Mini, optional update failures, cancellation and Stop cleanup.
- `.env.example` parsed successfully after `6c07960`; API credential fields remained blank. `git diff --check` passed before the pushes.
- The recovery procedure was checked in a clean local clone of `6c07960`: no private `.env` was copied, a generated free-preview configuration parsed with blank API credentials and port 3001, and all **194 tests passed** again without npm installation. The handoff's relative documentation links were also checked.

Reproduction steps and what each test proves are in [companion-benchmark.md](companion-benchmark.md). The full landmark smoke test was not rerun during the settings/documentation work; it was subsequently rerun successfully during the browser review below.

A [settings reference screenshot](images/parent-settings-2026-11-02.png) is committed with this handoff. It uses the test fixture's saved Mandarin/5-minute choices; fresh defaults are Auto/15 minutes. Original `/tmp` screenshots/logs are disposable and not needed for recovery.

## Remaining checks and next work

### Subsequent browser review on 2 November 2026

All 194 Node tests and all three existing Chromium suites passed, including real local MediaPipe inference with the public-domain adult fixture. A new visible-control exploratory check (`scripts/scenario-review-browser.mjs`) recorded **6 passes and 2 failed usability expectations**, with no harness errors. Both failures have the same cause: missing-code and permission-denied startup errors are not visible inside the open parent dialog. That original review did not change application behavior; the subsequent fix is recorded below. See the [report, screenshots and reproduction steps](TEST_REVIEW_2026-11-02.md).

Real HTTPS GETs to the user's live tunnel returned **401 Basic Auth** for both the page and `/api/config`. This is expected gateway protection, not an application defect. The app behind it and live Qwen were not reached. Live work requires secure, host-restricted credentials for the ngrok Authorization header and Mini parent code; do not request or record their values in chat/public docs. The user's backend can retain its Alibaba key. Preserve the review before any environment reconfiguration/restart.

Initially, a configuration draft was confirmed saved for personal secrets `MINI_TUNNEL_AUTH_HEADER` and `MINI_PARENT_ACCESS_CODE`, restricted to the provided tunnel hostname. At that initial stage the tool returned `requires_publish: true` and no values were supplied or activated; the later active Environment bindings are recorded below. [LIVE_TESTING.md](LIVE_TESTING.md) explains preparing the full Basic header locally, entering both values in secure environment settings and following applicable save/publish/apply steps. Recheck readiness after publication; do not reuse the old draft as evidence of active credentials.

### Startup-feedback fix verified on 2 November 2026

The user asked about fixes after the review. Startup validation and failures now appear in one visible alert below the parent access-code field. Invalid codes focus that field and set its invalid state; typing or retrying clears old errors. Permission denial gives browser-permission and voice-only recovery guidance. Capture, parent confirmation, enabled defaults and Stop remain intact; a late permission rejection after Stop cannot resurrect an error/session.

`npm test` now passes **197/197** tests, including three new regressions. The exploratory browser script now passes **9/9** scenarios, including both formerly failing cases and a real synthetic-microphone retry after a simulated denial. The parent-settings browser suite also passes. Fixed-state screenshots and verification are in [the review report](TEST_REVIEW_2026-11-02.md). The other two full browser suites passed in the immediately preceding review and were not rerun for this focused UI fix. No paid Qwen calls were made. The fix ships in the same Git commit as this memory update; use the latest remote log to identify it.

### Authenticated live review on 2 November 2026

The user saved both fields as **Environment** secrets, scoped to the supplied ngrok host. The service confirmed saved bindings and then `ready` state; both runtime variables became available. Authentication now works. Do not ask the user to re-enter or republish these values while readiness remains valid. Recheck active readiness if this environment is replaced.

The live page, `/api/config`, free POST diagnostic and protected model metadata all returned HTTP 200. The actual deployed UI has the startup-feedback fix. Remote Chromium passed all four mobile home-layout views and inline empty-code validation with HTTPS verification enabled. The browser completed ICE gathering with zero candidates, so no end-to-end voice/media success is claimed.

A bounded API integration check then made one authorized SDP exchange (200, valid answer), **one real `qwen-plus` plan** (200, 1.73 s) and **one real `qwen-image-3.0` generation** (200, 6.57 s, 1024×1024 PNG). The purple kitten/yellow-ball test image matched the synthetic subject. The test grant was revoked (200) and the peer closed. No microphone/camera stream or child recording was sent. These are single observations, not a benchmark or billing-total guarantee. See [the live report, evidence image and safe result receipt](LIVE_REVIEW_2026-11-02.md).

The prior draft/401 paragraphs above describe the setup history and are superseded by this confirmed active state. No new application defect was found in this live pass. Next work is the following physical-device validation:

1. Physical iPhone Safari microphone/audio playback, local landmark support, interruptions, Stop capture indicators and portrait/landscape behavior.
2. The actual spoken WebRTC conversation on iPhone. HTTP signaling passed, and planner/image access is verified; cloud ICE produced no candidates, so audible voice and media transport remain unverified.
3. Live English/Mandarin conversation quality, educational accuracy and actual image quality/latency. Automated prompts and fixtures cannot prove these.

### Child-style play-through and fixes on 2 November 2026

The user asked to use the companion like a child. A bounded protected live run exercised 23 checkpoints, using **one real signaling grant, five real `qwen-plus` planner requests and two real `qwen-image-3.0` pictures**. Eleven other planner replies, ASR and voice replies were scripted; microphone/camera capture used synthetic tracks. These counts are additional to the earlier single-plan/single-image check. The grant was revoked and all tracks ended. Rechecking ICE after obtaining actual synthetic capture still produced zero candidates, so actual Qwen speech/audio and physical Safari were not validated.

The initial 22 passes/one failure are preserved. After counting three apples, “我不想数了，我们聊聊天吧。” received a real planner `keep` and left the counting screen active. Explicit chat exits now close all three local games without planning, clear game/narration state and restore voice handling while retaining capture. Tests cover transcript-before-response and response-before-transcript ordering without replaying interrupted old audio. Both real story plans also omitted their message; a story-choice continuation could therefore supply no narration. The renderer now uses its displayed title as fallback, and the planner is explicitly instructed to supply a short branch narration.

Verification: **201/201 Node tests**, **9/9 new local child-journey replay checkpoints**, parent-settings and companion-close browser suites pass. The exploratory browser scenarios also passed again. Fix verification used local providers only; no further paid calls were made. The full landmark suite was not rerun for these changes; its earlier result stands separately. The original two real images visually preserved the blue dinosaur/yellow backpack/forest, and the continuation added the selected rainbow bridge. This does not establish general story quality or latency.

See [CHILD_REVIEW_2026-11-02.md](CHILD_REVIEW_2026-11-02.md), its sanitized original observations/local replay receipt and four screenshots. `scripts/child-journey-browser.mjs` reproduces the fixes against loopback fixtures without credentials; `tests/fixtures/child-journey-plans.json` preserves the exact synthetic plans. No private URL, auth header, grant, SDP or child recording is committed. The live Windows app still needs the normal pull/restart/Safari refresh to get these code changes. Next work is supervised physical Safari voice, camera, interruption, backgrounding and full-duration-expiry validation; do not repeat paid calls merely to reconstruct this review.

### Proactive bilingual play and checked learning on 2 November 2026

The user reported three weak areas: proactive facial/motion reactions, engagement/continuation and science/maths education. They confirmed the iPhone was already finding a face, so the work targets response policy and behavior rather than adding another vision service.

Local camera cues can now wait up to 15 seconds for quiet, including visible smiles, winks and head movement. Stronger gaze/head movement and a persistent smile response make reactions clearer. Spoken camera invitations wait for six quiet seconds, have a 20-second cooldown and an eight-per-session limit; continuous visual tracking remains available. Speech waits through AI/child audio, local narration, games, planning, a learning question, parent setup, mute and backgrounding. No feeling is inferred and no hand/full-body tracking was added.

Ordinary chat now has topic-aware local invitations even with Pictures/planner access off. Substantive statements can receive one after six seconds; an unanswered question can receive one check-in after 14 seconds. At most one scheduled invitation per child turn, 24 per session; never loop on silence. Child speech, touch, mute and Stop cancel pending work. Explicit declines, distress and requests for quiet suppress new conversation/camera invitations without necessarily ending capture.

`mini-learning.js` adds actual checked turns beyond prompt guidance: small addition/subtraction within ten, triangle sides, plants/light, the Sun as a star, insect legs, rolling predictions and melting ice. Mini teaches, asks, checks English/Mandarin words/digits/choices, gives one concrete hint, then explains and returns to play. It spaces automatic offers through conversation, alternates maths/science, raises arithmetic gently after successful checks, allows skipping/topic changes and restates the same challenge on a language switch. A science mistake does not lower maths readiness. Qwen remains responsible for broader conversation/teaching.

Locally spoken invitation/lesson context enters optional session checkpoints without an extra `response.create`. Checked local feedback stays authoritative for display/speech; the browser review caught and fixed the old `response.done` fallback otherwise narrating a conflicting Qwen answer when visuals were off. The new frontend module is registered in the server's explicit static allowlist, and the asset test now checks every script/stylesheet referenced by the page. Stop clears the helper/local prompt. No transcript history or child learning profile is stored.

Validation: **223/223 Node tests**, **13/13 proactive browser scenarios**, **9/9 child replay**, parent-settings, companion-close, **9/9 exploratory scenarios** and the full companion browser smoke all pass. The full smoke ran real MediaPipe inference on the documented public-domain adult image; the proactive suite used synthetic landmark output, actual synthetic capture, scripted voice and real six-/14-second waits. It checked wrong-answer hints, Mandarin switching, science answers, skipping, one quiet hint without scoring silence, same-track capture, context and Stop. No paid model calls were made for this update. [The report, receipt and screenshots](PROACTIVE_REVIEW_2026-11-02.md) and `scripts/proactive-companion-browser.mjs` preserve reproduction evidence.

The physical iPhone's face-in-view status is user-confirmed; the updated interactions, ASR/Qwen audio and speech synthesis have not been exercised on that device. Normal Windows pull/restart/Safari refresh is still required. The current cloud runtime status returned `unknown` for the two existing secret bindings; these local checks did not use them. Recheck current readiness if live work is requested rather than assuming the historical ready state or asking the user to re-enter values prematurely.

Do not mark the remaining physical checks as passed or launch paid tests merely to recreate lost context. Restore the repository first, read the current user request, and continue from these recorded facts.

## Keeping this memory useful

After meaningful work, update this file's date, decisions, relevant commits, completed validation and unresolved items. Update feature docs when labels/defaults change. Preserve older releases as clearly marked history in CHANGELOG.md. Commit/push the handoff when authorized and verify the remote contains it; a successful local save alone does not survive loss of the cloud workspace.
