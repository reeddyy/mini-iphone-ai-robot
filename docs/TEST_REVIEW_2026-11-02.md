# Browser review and scenario results — 2 November 2026

Reviewed application baseline **`63db2d2`** (application/configuration inherited from `6c07960`). This run reviewed and tested the app; the usability finding below has not been fixed. No live Qwen calls or paid image requests were made.

## Finding: startup errors are hidden from the parent

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

## Checks run

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

Download the public-domain adult fixture as documented in [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md); never substitute a private child's photo. The full browser suite deliberately triggers persistent artwork suppression, so restart its fixture before other suites. Run scripts sequentially: they control the same browser tab. The exploratory script exits **1** while any expectation fails and writes its JSON/screenshot output under `/tmp`; the two known failed expectations are preserved in this report and committed screenshots. It is a manual diagnostic, separate from the passing `npm test` suite.

## Live validation still needed

The provided HTTPS tunnel needs its ngrok Basic Authorization header before the app can be reviewed remotely. Mini's parent code is separately required for protected diagnostics and session startup. These credentials should be supplied through the environment's secure secret settings, restricted to that host, rather than chat or repository files. The existing server keeps its own Alibaba key; testing its deployment does not require copying that API key here.

A draft containing the two secure credential requirements was saved successfully; it requires environment publication before use. Follow [LIVE_TESTING.md](LIVE_TESTING.md) to prepare the tunnel header privately and supply the separate Mini code. No secret values were entered or activated during this review.

After authenticated access is available, check the deployed version/configuration and read-only diagnostics first. Actual speech recognition, audible Qwen replies, image generation/account entitlement, real provider latency and physical iPhone behavior remain unverified. Simulated transcripts, a 1-pixel fixture image or a successful JSON response cannot demonstrate those outcomes. Cloud browser/WebRTC network limitations may require completing the voice portion directly on the iPhone.
