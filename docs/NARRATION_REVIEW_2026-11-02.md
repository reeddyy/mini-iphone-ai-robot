# Opening, game and lesson voice fix — 2 November 2026

The user reported that asking to play “tic tik toe” changed Mini to a deep male, mumbled voice. They then confirmed the same problem with the opening and lessons. Those all share the device speech-synthesis path; normal realtime conversation uses Qwen's **Tina** voice.

## Diagnosis and change

The old local voice picker preferred language region/default status without considering voice identity. For example, with the synthetic installed catalog `Daniel / en-GB` and `Samantha / en-US`, it selected Daniel. It reselected on every utterance, so a late or reordered Safari voice list could also change the narrator between activities. This identifies a code path consistent with the report; the user's actual installed voice list was not inspected.

The picker now prefers familiar installed female voices in the correct language, ahead of regional/default choices, and retains the selected voice per language for the page visit. English and Mandarin have separate selections; Cantonese/Hong Kong variants are excluded from Mandarin. If the selected voice is removed, another eligible voice can be chosen. There is no stored voice preference or new parent control.

Safari's voice catalog is warmed on page load. If it is initially empty, the first narration can wait up to 700 ms for `voiceschanged`, with the microphone still enabled. If no catalog arrives, narration has a bounded device-language fallback. Voice rate/pitch use natural defaults (`1`), rather than slowing or altering pitch.

Local `cancel()` and `speak()` now have an 80 ms separation. Rapid resets replace queued speech with the latest sentence, and Stop removes pending starts/catalog listeners. Old speech callbacks cannot clear the newer narration or restore its microphone early. The existing microphone behavior remains: capture is not muted while waiting for speech; it is temporarily muted only when local synthesis actually starts, then restored after that narration ends.

The missing-end-event guard now allows 12–30 seconds according to text length/language. A longer lesson is not treated as finished at a fixed 12 seconds. If the guard expires, the device output is cancelled before the microphone is restored, preventing lingering narration from feeding back into capture.

English tic-tac-toe speech also uses clear mark names:

| Before | After |
| --- | --- |
| “You are X. Mini is O.” | “You play crosses. Mini plays circles.” |
| “Mini placed O at center.” | “Mini put a circle in the center square.” |

The visual board and rule checkpoints still use canonical `X`/`O`; game rules and results are unchanged. Chinese narration continues to say 叉/圆. Qwen audio remains muted during local game/checked-lesson narration and returns when the child leaves the game.

**For grown-ups → Troubleshooting → What Mini hears and says** now shows **Game and lesson voice**, including the selected name and language. This is a diagnostic line, not another setting. No `.env`, model or API-key change is needed.

## Verification

- **233 Node tests passed**, including female-over-regional selection, stable voice identity, Mandarin dialect selection, delayed catalog arrival, one speech start despite catalog/timer races, cancelled starts, rapid replacement, stale callbacks and microphone restoration.
- `node scripts/narration-browser-smoke.mjs`: **8/8 passed**. The local browser used actual synthetic microphone/camera capture with a scripted voice catalog/engine. It checked opening → game → lesson continuity, an actual board tap, clear cross/circle text, rapid New round, English/Mandarin switching, regular-audio restoration and Stop. The engine fixture simulates clipping if speech starts within 50 ms of cancellation; no utterance was clipped. See [the sanitized receipt](narration-results-2026-11-02.json).
- The proactive browser harness now waits for asynchronous local narration to finish instead of assuming `speak()` is immediate. Its results are recorded with the other regression checks in [project state](PROJECT_STATE.md).
- The **13 proactive scenarios**, **nine-checkpoint child journey**, parent-settings and picture-close/media-cleanup suites passed again. The real landmark suite passed in the preceding update and was not rerun for this voice-only fix.
- No paid model or live audio-generation requests were made for this fix.

These tests verify selection, text, ordering and cleanup. The voice catalog and synthesis were scripted; **they do not establish how the selected voice sounds on iPhone**. The code cannot make a device voice identical to Qwen Tina, and voice gender/quality metadata is not standardized. If no suitable named voice is installed, the available/default voice may still sound different. Physical Safari listening is the remaining acceptance check.

## Apply and check on iPhone

Stop the Windows server, `git pull`, restart `npm start` and refresh Safari. In a short supervised session, listen to the opening, request tic-tac-toe, make one move, then try “Teach me maths” and “请用中文回答”. Check for a stable local voice and clear game words. Read the new diagnostic voice name if it still sounds deep or unclear. No child recording or credential is needed to report that name.

To reproduce the automated check, use the loopback fixture and synthetic Chromium setup in [companion-benchmark.md](companion-benchmark.md), then run `node scripts/narration-browser-smoke.mjs`. It needs no private `.env` and contacts no live AI provider.
