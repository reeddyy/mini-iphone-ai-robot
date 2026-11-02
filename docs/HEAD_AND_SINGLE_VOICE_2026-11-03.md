# Head tracking and original voice only

Reviewed **3 November 2026 (Asia/Singapore)**. The user reported a fixed right-tilted head and two different companion voices. They explicitly chose **Original voice only**, with local game and lesson cues on screen.

## Changes and evidence

Normal live conversation already selects **Qwen Tina**. Local openings, games and checked lessons previously used a separate Safari device voice. Preferring a female device voice did not make it identical to Tina. Live local cues now display text and return before creating a device utterance, waiting for voices or disabling the microphone. Late voice-catalog events cannot start narration. The earlier [device-voice report](NARRATION_REVIEW_2026-11-02.md) remains historical; its safeguards apply only to preview speech.

This choice makes the local opening, camera/follow-up invitations, game moves, story-choice text and checked lesson feedback **visual only**. Tina speaks ordinary live replies after the child answers or makes a request. Conflicting remote game/checked-answer audio remains muted so local rules stay authoritative; normal conversation restores the existing live-audio path. No extra generated voice turn, TTS model, setting or paid reconnect is introduced. Captions remain readable after completion and clear on the next child turn or Stop. Model instructions accurately describe displayed prompts.

Previously, absolute landmark roll set the head angle directly, so an angled camera/face could start Mini tilted. A stalled worker/capture could then hold the last pose indefinitely. Camera tilt also shared an expression variable inside the floating animation. Rotation now uses its own CSS property outside those keyframes. The first valid face establishes neutral; later roll accounts for camera aspect ratio, is smoothed and is bounded to 14 degrees. Motion still works with reduced decorative motion. Losing fresh landmarks clears gaze, tilt, smile and the old face-in-view status after about 1.2 seconds. A six-second stall can restart only the local tracker twice; repeated stalls show Retry. Recovery reuses capture and the voice peer. Paused preview playback resumes the existing video element. Stale worker/capture callbacks cannot overwrite the replacement tracker. These are code-backed fixes; the exact physical phone failure was not independently reproduced.

The proactive browser check also caught a regression caused by changing spoken questions to instant visual cues: the following provider reply could cancel a prematurely scheduled quiet hint. The local lesson now schedules one hint after that provider turn finishes. Both transcript orders pass; silence is not scored and never creates a prompt loop.

## Validation

| Check | Result | Scope |
| --- | --- | --- |
| `npm test` | **251 passed, 0 failed** | Mocked providers; calibration/aspect, bounded recovery, paused preview, live no-speech, captions, quiet hint ordering and existing regressions. |
| `scripts/head-tracking-browser.mjs` | **8/8** | Actual synthetic capture/CSS; scripted landmarks/frozen worker; neutral, both directions, smile/gaze, reduced motion, stale reset, recovery with the same peer/capture, pause and Stop. |
| `scripts/narration-browser-smoke.mjs` | **8/8** | Tina configured; zero device utterances; English/Mandarin opening/game/lesson captions, rapid resets, chat restoration, same microphone/camera and Stop. |
| `scripts/proactive-companion-browser.mjs` | **13/13** | Camera captions, chat engagement, checked maths/science, English/Mandarin, skipping, real six-/14-second waits and one quiet hint. |
| `scripts/child-journey-browser.mjs` | **9/9** | Story choices, exact counting, hand game, bilingual exits and media cleanup with visual-only local helpers. |
| Parent settings / companion close | **Passed** | Defaults/consent, no capture on Cancel, layouts, picture closing/abort, existing tracks and Stop. |
| Exploratory browser scenarios | **9/9** | Visible errors, permission recovery, voice-only capture, background/deadline simulation and keyboard focus. |
| Image/Auto stability | **9/9** | 29 scripted turns, four decoded 1024-pixel fixture pictures, delayed request errors, image failure/budget and same media session. |
| Full companion smoke | **Passed** | Real local MediaPipe inference on the public-domain NASA adult photo; mobile UI, pictures/failure, reactions and teardown. |

The companion-close suite initially saw image counts left by the preceding child suite. Resetting fixture counters resolved that harness mismatch; application code did not need a change for it. All browser provider calls above went to the local fixture. ASR, Qwen replies/audio events and peer behavior were scripted. No live paid provider call, private/child media, recording or child transcript was used. Actual iPhone audio, Safari timing, tracking accuracy on children and real Qwen transport reliability remain unverified.

Committed receipts: [head tracking/recovery](head-results-2026-11-03.json), [single live voice](single-voice-results-2026-11-03.json) and [current proactive/learning checks](proactive-results-2026-11-03.json). Earlier 2 November receipts are preserved unchanged. Reproduction setup and the other commands are in [companion-benchmark.md](companion-benchmark.md); run browser scripts sequentially against a fresh fixture or reset its counters between suites.

## Apply and check on iPhone

Stop the Windows server, run `git pull` and `npm start`, then refresh Safari. Preserve the private `.env`; no model/configuration change is needed.

1. In a short parent-approved session with Camera on, let Mini find the face. Its starting head pose should be upright; tilt left/right, shift position and smile. Pause/resume local reactions and check that the head recalibrates.
2. Answer the on-screen opening, chat in English/Mandarin, play tic-tac-toe and ask for maths/science. Local helper cues should stay on screen without a device voice. Say “Can we just talk?” / “我们聊聊天吧” and check that Tina resumes ordinary chat.
3. Keep Auto/Pictures on if wanted, try a picture, return to Mini and continue chatting. Stop must release camera/microphone. The earlier [optional-update stability fix](IMAGE_VOICE_STABILITY_2026-11-02.md) remains in place.

If head tracking still fails, record only the local-reactions status and any safe error code, plus the iOS version. A fixture pass is not a physical-device acceptance result. [Project memory](PROJECT_STATE.md) and [recovery steps](RECOVERY.md) preserve this decision and the remaining check.
