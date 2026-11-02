# Browser review and scenario results — 2 November 2026

Original review baseline: **`63db2d2`** (application/configuration inherited from `6c07960`). The usability finding below was subsequently fixed and verified on the same day. The original observations remain below for traceability. No live Qwen calls or paid image requests were made.

## Fix verification

Startup errors now appear in an alert directly below the parent access-code field. Invalid codes are marked and focused. Editing the code or retrying clears stale feedback. Permission-denial messages explain how to restore browser access or choose voice-only play. Late permission failures after Stop are ignored.

- **197 Node tests pass**, including new checks for inline validation/focus, denied-media recovery guidance and late rejection after Stop.
- **All 9 exploratory browser scenarios pass**, including the two original failures and an added explicit voice-only retry after a simulated denial. That retry uses a real synthetic microphone track and releases it on Stop.
- The **parent-settings browser suite passes** after the fix. The other two existing browser suites passed in the preceding review; they were not rerun for this focused UI change.
- Fixed screenshots: [access-code validation](images/startup-code-fixed-2026-11-02.png), [permission guidance](images/startup-permission-fixed-2026-11-02.png).

At the fix-verification stage, physical Safari and Qwen/API access were unverified. The subsequent [live review](LIVE_REVIEW_2026-11-02.md) now verifies authenticated UI/planner/image checks; physical Safari voice/media remain unverified. The fix adds visible feedback without starting capture or retrying provider requests automatically.

## Original finding: startup errors hidden from the parent — resolved

**Priority: medium.** Two browser scenarios failed the same usability requirement: a parent should see why Start did not work inside the open grown-up settings sheet.

| Reproduction | Expected | Observed |
| --- | --- | --- |
| Open the gear and press Start with an empty access code. | A visible error near the access-code field/Start button, with focus or an accessible announcement. | Capture stays off, but the code error is written to the child-screen status behind the modal. No error appears inside the visible parent sheet. |
| Enter the fixture code, then simulate a rejected camera/microphone permission request. | Visible permission guidance and a clear recovery action inside the sheet. | Startup stops safely and no paid request is made. The reason is written behind the modal and into last-session history inside collapsed Troubleshooting. The visible sheet gives no explanation. |

The real Chromium checks used pointer events against visible controls. Permission denial was injected as a `NotAllowedError`; it was not an actual iPhone permission prompt. Screenshots: [missing code](images/review-blank-code-2026-11-02.png), [permission denied](images/review-permission-denied-2026-11-02.png).

Relevant code paths:

- `public/app.js`, `startMini()`: early code/secure-context validation calls `setStatus()`.
- `public/app.js`, `setStatus()`: updates the child-screen status outside the parent dialog.
- `public/app.js`, startup catch/`stopMini()`: stores failure in `sessionEndStatus` and updates that same outside status.
- `public/index.html`: `sessionEndStatus` is nested in the initially closed Troubleshooting details.

Recommended fix: reuse a single visible inline error region in the main parent panel for validation and startup failures, focus the code field when appropriate, and retain detailed last-session history under Troubleshooting. Preserve the minimal controls, enabled defaults and parent Start confirmation.

## Original review checks

| Check | Result | What was real and what was simulated |
| --- | --- | --- |
| `npm test` | **194 passed, 0 failed** | Actual Node test runner; mocked providers/media events. |
| `scripts/parent-settings-browser-smoke.mjs` | **Passed** | Real Chromium DOM and synthetic media; provider fixture. Four phone-sized portrait/landscape views, enabled defaults, legacy preferences, Cancel, voice-only play, Stop, storage and Reset. |
| `scripts/companion-close-browser.mjs` | **Passed** | Actual synthetic microphone/camera tracks, decoded fixture PNG and CSS animation; scripted signaling/provider events. Image close, interrupted image work and optional update failures preserve capture; Stop releases it. |
| `scripts/companion-browser-smoke.mjs` | **Passed** | Actual local MediaPipe worker inference using a public-domain adult photo, synthetic capture, DOM/rendering and mocked provider responses. Model metadata, immediate board, image decoding/failure suppression and mobile layouts passed. |
| `scripts/scenario-review-browser.mjs` | **6 passed, 2 failed, 0 harness errors** | Visible pointer/keyboard interaction plus deliberate failure/event injection. Both failures correspond to the single parent-error-visibility finding above. |
| User-provided live deployment | **Blocked by expected ngrok Basic Auth** | Real HTTPS GET requests to `/` and `/api/config` returned HTTP 401 with `WWW-Authenticate: Basic realm="ngrok"`. Application content behind the gateway was not reached. No credentials were guessed. |

The live tunnel hostname and any credentials are omitted from this public report. Authentication protection is not an application defect.

### Exploratory browser scenarios

| Scenario | Result | Observation |
| --- | --- | --- |
| Empty access code | Failed usability expectation | Error invisible inside modal; zero capture and zero paid requests. |
| Camera/microphone permission denied | Failed usability expectation | Safe startup failure; explanation invisible inside modal. |
| Voice-only play, mute/unmute, Stop | Passed | Real synthetic audio track changes enabled state; no video track; Stop ends tracks. |
| Stop while media permission is pending | Passed | A deliberately delayed real synthetic stream is stopped when it arrives; session stays ended. |
| Backgrounding | Passed simulation | Injected hidden-document visibility event releases capture; physical Safari background behavior remains untested. |
| Automatic session expiry | Passed simulation | Injected expired deadline releases capture without a new paid request; this was not a five-minute wall-clock trial. |
| Escape from parent dialog | Passed | Real keyboard Escape closes the modal, clears the code and returns focus after the close event. |
| Computer server unavailable | Passed simulation | Injected configuration-fetch failure disables Start and shows a visible parent-facing reason. |

In the real local landmark run, the adult fixture produced a face/smile result. Two warm processing samples reported approximately **6.3 and 6.0 samples/sec**, with **41 and 82 ms** processing times. These samples demonstrate the inference path in this cloud Chromium run; they do not establish iPhone performance or recognition accuracy for children. The camera guide was corrected to describe the current 160 ms minimum adaptive inference interval.

## Reproduce locally without AI charges

Use Node 22+ and Chromium with a fresh temporary profile. Start `node tests/fixtures/companion-smoke-server.mjs` and the synthetic-media Chromium described in [companion-benchmark.md](companion-benchmark.md). The fixture does not read `.env` and supplies every Qwen response locally.

```sh
npm test
node scripts/parent-settings-browser-smoke.mjs
```

With a fresh fixture process for each provider scenario suite:

```sh
node scripts/companion-close-browser.mjs
node scripts/companion-browser-smoke.mjs /tmp/mini-astronaut.png
node scripts/scenario-review-browser.mjs
```

Download the public-domain adult fixture as documented in [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md); never substitute a private child's photo. The full browser suite deliberately triggers persistent artwork suppression, so restart its fixture before other suites. Run scripts sequentially: they control the same browser tab. The exploratory script exits **1** if any expectation fails and writes JSON/screenshots under `/tmp`. The original failed expectations are preserved in the historical observations/screenshots above; the updated script adds an explicit retry check and passes all nine scenarios after the fix. It is a manual diagnostic, separate from `npm test`.

## Original live-access blocker — now resolved

The initial review received ngrok Basic Auth HTTP 401 responses. The user's subsequent Environment secret bindings became saved and ready, and the [authenticated live review](LIVE_REVIEW_2026-11-02.md) passed HTTP/UI checks, real planning and one real picture. No private hostname or credential values are retained here. The existing Windows server kept its Alibaba key.

For future access setup, follow [LIVE_TESTING.md](LIVE_TESTING.md) and verify current runtime readiness rather than relying on an old draft. End-to-end voice and physical Safari remain pending because this cloud browser configuration gathered zero ICE candidates; successful signaling or a generated image does not establish audible voice playback.
