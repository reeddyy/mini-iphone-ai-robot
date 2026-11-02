# Authenticated live-deployment review — 2 November 2026

The user's environment secrets became ready, and authenticated requests reached the live Mini deployment. **The deployed UI, `qwen-plus` planning and one `qwen-image-3.0` generation passed. End-to-end voice and physical iPhone Safari remain unverified.**

No credentials, private tunnel hostname, SDP contents, session grants, camera frames or child recordings are included in this report. The test used a synthetic kitten/ball story prompt. Application code was not changed for this review.

## Access and free diagnostics

Both required bindings (`MINI_TUNNEL_AUTH_HEADER`, `MINI_PARENT_ACCESS_CODE`) were confirmed saved as **Environment** secrets, restricted to the supplied tunnel host, and subsequently reported **ready**. The runtime variables became available. The previously observed HTTP 401 was resolved without disabling ngrok protection or moving the Alibaba key off Windows.

| Live endpoint | Result |
| --- | --- |
| `GET /` | HTTP 200; Mini page with the current `startupError` fix. |
| `GET /api/config` | HTTP 200; realtime mode, voice `qwen3.8-omni-flash-realtime`, planner `qwen-plus`, image model `qwen-image-3.0`, Singapore image route. |
| `POST /api/diagnostics/post` | HTTP 200; Mini confirmed the POST reached the server. No provider call. |
| `POST /api/parent/models` | HTTP 200 with a complete metadata result; configured `qwen-image-3.0` was listed. This check itself did not generate an image. |

## Browser checks against the actual deployment

Chromium **154.0.8037.57** opened the real HTTPS deployment through the configured session proxy. TLS verification stayed enabled, using the environment-provided CA certificates in an isolated temporary browser certificate store. The initial browser trust-store issue was a cloud test setup limitation, not an observed certificate defect on the user's site.

- The page reported a secure context and realtime mode. Camera and Pictures defaulted on; there was no active app session on load.
- The page and its 14 JavaScript/CSS assets returned HTTP 200; favicon returned 204. No failed page-network requests were recorded.
- At **320×568, 390×844, 430×932 and 844×390**, the home had no horizontal overflow and its start control stayed within the viewport.
- Pressing Start with an empty code showed the inline error inside the open parent sheet, focused the code field and started no session. [Live screenshot](images/live-parent-validation-2026-11-02.png).

These were remote Chromium/mobile-layout checks, not Safari or a physical iPhone. The live page did not capture a microphone or camera for these checks.

## Bounded real-provider checks

The test created one valid browser-generated WebRTC offer, made one authorized SDP request with visuals/images enabled and camera/cloud-awareness disabled, then exercised the existing visual APIs. This tested signaling and the planner/image backend independently of a connected voice conversation. It did not inject a mocked model response or call an unprotected test-only server route.

| Step | Result | Observed request time |
| --- | --- | --- |
| Realtime SDP exchange | HTTP 200, valid SDP answer, visual-session grant issued. | 0.97 s |
| `qwen-plus` visual planning | HTTP 200, schema-validated `artwork` action with image prompt and ticket. | 1.73 s |
| `qwen-image-3.0` generation | HTTP 200, valid **1024×1024 PNG**, **1,665,193 bytes**. | 6.57 s |
| Revoke test visual grant | HTTP 200. Browser test peer also closed. | 0.38 s |

Only **one paid planner attempt and one image-generation attempt** were made. No microphone/camera media was streamed. The SDP request also reached the real provider; these observations do not establish an invoice total or a financial cap. Request times are single observations from this cloud-to-Windows-to-provider path; the image request includes the server's image download. They are not latency benchmarks or phone measurements.

The [actual generated picture](images/live-qwen-image-3-kitten-2026-11-02.png) shows the requested purple kitten and yellow ball in a sunny garden, with an AI-generated watermark. This verifies one successful generation with the user's configured backend. It does not prove quality, suitability or availability for every future request/model/account. [Sanitized request-result receipt](live-provider-results-2026-11-02.json).

## Voice/Safari limitation

The cloud browser completed local ICE gathering with **zero connection candidates**, before any real voice session was attempted. A successful SDP HTTP exchange alone does not prove a usable audio/video connection. No ASR result, Qwen spoken response, interruption behavior or physical speaker playback is claimed from this run.

The remaining device test needs the user to operate iPhone Safari. Authenticated access to the website does not provide remote control of the phone. Suggested bounded sequence:

1. Keep Windows Mini/ngrok running; open the protected HTTPS page in iPhone Safari. Set Stop after to 5 minutes and turn Camera off for the initial voice check.
2. Enter the parent code and approve Start. Check that Mini asks its opening question and answers a short English reply; then request Mandarin. Interrupt one answer and verify it listens again.
3. Request one picture only if wanted, then use Back to Mini and verify voice stays available. The remote image backend has already passed the one-image test above.
4. Stop; optionally begin a separate parent-approved camera session to show an ordinary toy. Verify the local preview and the distinction between live objects and generated pictures.
5. Press Stop and check that microphone/camera indicators clear. Test backgrounding separately. Record safe diagnostic codes and observations, without sharing credentials or private child recordings.

No new application defect was found by these live HTTP/UI/planner/image checks. Physical-device speech, recognition accuracy, real-world camera understanding and longer-session reliability remain to be checked.
