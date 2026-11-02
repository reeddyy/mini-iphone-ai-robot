# Image/Auto-language voice stability — 2 November 2026

The user reported voice repeatedly breaking after a few conversations, especially around generated pictures with Language set to Auto. The exact stop text was:

> Last session ended: Qwen error (code=unknown, type=invalid_request_error). Session stopped; copy the code shown below.

The client was explicitly calling `stopMini()` for this event when an optional context update was no longer marked pending. Local tests reproduced the same shutdown after both an acknowledgement and a timeout. This confirms a client error-handling defect; it does not establish why the live provider rejected that request or prove a Wi-Fi fault.

## Fix

- Once voice/media are ready, a nonfatal request rejection pauses optional picture/language/activity instruction updates and keeps the current peer, microphone and camera. A delayed rejection remains recoverable after its acknowledgement/timeout. There is no automatic retry loop or new paid connection.
- Initial setup errors and coded authentication, permission, quota/rate-limit, expired-session and server failures still take the fatal path. A pending optional update no longer swallows a genuine fatal rate-limit error.
- Picture loading/paused states do not send voice settings. Completed image states are coalesced; updates wait for remote playback to finish and for the provider's automatic turn to complete, including the gap before `response.created` arrives. Local lesson readiness no longer makes that provider turn appear finished early.
- There is one optional checkpoint update in flight, at most one every two seconds. The latest state is used when it can be sent. An acknowledgement timeout is tied to its particular request, avoiding stale timers affecting a later one.
- Voice checkpoints omit image-generation prompts/motion and retain the displayed scene/game facts. Optional control messages have an application limit of 16 KiB, or the peer's smaller reported SCTP limit. Oversized updates are skipped without closing voice. This is an app safeguard, not a claim about an undocumented Qwen limit.

Language Auto, pictures, local reactions, lessons and the minimal grown-up controls remain available. The initial voice instructions already support bilingual conversation. If optional updates are rejected, the app shows **“Optional picture/language checkpoint updates paused … Voice session kept open.”** This preserves the session without claiming that an actual failed network/peer has recovered. In that degraded state, Qwen may lack the newest screen checkpoint; local visuals/game rules remain separate.

The normal session deadline, Stop/background teardown, explicit Start confirmation and four-image-attempt limit remain. A budget decline or an image HTTP failure is separate from a fatal voice-session error. No `.env`, API-key or model change is needed.

## Evidence

Read-only authenticated GETs confirmed that the live configuration is realtime with planner/images available, and the deployed scripts match `fc80187` after normalizing Windows CRLF line endings. This rules out an older deployed source for those files; it does not establish which source a previously opened Safari tab retained. No paid Qwen request was used for this verification.

Before the fix, three new local regressions failed: delayed invalid-request rejection after acknowledgement, the same rejection after timeout, and a fatal rate-limit error incorrectly ignored while an optional update was pending.

After the fix:

| Check | Actual result |
| --- | --- |
| Node suite | **242 passed, 0 failed**, including the reported error, audio/provider-turn gating, coalescing, size guard and genuine fatal errors |
| New browser stability journey | **9/9 passed**, **29 simulated child turns** in one session |
| Media workload | Four decoded **1024-pixel PNGs**, actual synthetic mic/camera capture and active local tracking worker |
| Rejection handling | Two injected `invalid_request_error` events after acknowledgement; same peer/channel/tracks remained active |
| Conversation after rejection | Twenty English/Mandarin turns; no settings retry or new peer |
| Other failures | Injected temporary image HTTP 503 and the normal four-picture decline; voice/capture remained available |
| Control traffic | Two final-visible-scene updates, 13,453 and 13,455 bytes, neither while remote audio was active; none after updates were paused |
| Teardown | Stop released all capture and revoked the fixture grant |

The [sanitized receipt](image-voice-stability-results-2026-11-02.json) contains scenario names/counts and control/processing metrics, without credentials, grants, SDP, private hostname, recordings or child transcripts. The 1024-pixel image is a previously generated synthetic kitten PNG reused locally for decode/load tests; these requests were not new live generations or artwork-quality checks.

All existing browser suites passed again: minimal parent settings, **9/9 child journey**, picture closing/media cleanup, **8/8 narration**, **9/9 exploratory scenarios**, **13/13 proactive scenarios** and the full companion smoke including real local landmark inference. No live paid model calls were made for the fix or these checks.

## Reproduce and device acceptance

Use the fixture/synthetic Chromium setup in [companion-benchmark.md](companion-benchmark.md), then run `node scripts/image-voice-stability-browser.mjs`. The fixture's optional `/__fixture/large-images` mode reuses the committed safe PNG; `/__fixture/reset` restores the tiny default image for other checks.

ASR, Qwen replies, provider error events and the connected transport adapter were scripted. Actual synthetic capture, image decoding and local processing were real. This proves the client behavior under the reported event sequence, not actual Qwen voice delivery or physical iPhone audio/network reliability. The live provider's underlying rejection reason remains unknown because the reported event had no code/parameter; raw provider messages are not logged as they may echo private conversation content.

After Windows `git pull`, server restart and Safari refresh, keep Auto and Pictures on in a supervised five-minute visit. Try a few English/Mandarin turns, a picture, Back to Mini and a story choice. If a problem remains, report the safe visible error and whether **Last session ended** changed; this distinguishes a new fatal stop from the recoverable optional-update warning. Physical Safari stability remains the final acceptance check.
