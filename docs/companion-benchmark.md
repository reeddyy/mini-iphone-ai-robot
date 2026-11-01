# Companion interaction benchmark

Use the same scenarios when comparing Mini, Loona DeskMate, LOOI, and Reachy Mini. This is a repeatable evaluation plan, not a claim that the other products have been tested. Record hardware, app/firmware, provider/model, language and network conditions. Mark unsupported features separately from failures.

## Scenarios

| Scenario | Procedure | What to measure |
| --- | --- | --- |
| Short answer | Answer an animal clue with one word, then try “I don't know.” | Response success; time from end of speech to first audible reply; whether the next clue helps |
| Interruption | Start speaking halfway through a reply. Also tap Mini during its local opening voice. | Time until the old playback is inaudible; whether the mic stays enabled; whether the new answer responds to the interruption |
| Two languages | Request a story in English, choose the hero in Mandarin, then switch back. | Correct interpretation and natural language switching; repeated clarification requests |
| Story continuity | Request a story; choose cat, forest, and star across three turns. Ask where the hero is. | All three choices retained; short coherent scenes; a natural ending without another generic question |
| Show-and-tell | Start with camera off, ask “Can you see my toy?”, then explicitly opt in on a new session. | Honest camera-off response; visible sharing status; relevant description only when frames are available |
| Stop and handoff | Say “Mini, stop” or “Mini，别说了”; repeat with the Stop button; test an extension with the wrong parent code. | Capture released; no auto-reconnect; parent code required to add time; graceful resting state |
| Shared visual game | Ask for tic-tac-toe, choose top left, try the occupied square again, then choose a Mandarin position; restart while a move is pending. | Visible, correct board; one legal Mini move per child move; no invented placements; winning line highlighted; reset has no ghost moves; full face returns on exit |
| Novel visual subject | Ask for a cat face, then a jellyfish astronaut, then a smiling purple submarine. | Meaningful new composition without a subject-specific component; usable phone layout; expression/motion; time until visible |
| Choice duel and counting | Ask for scissors-paper-stone, choose by voice and touch, then request three apples and count them. | Mini chooses before the child; correct win/tie/lose result; exactly three objects; one count per tap |
| Visual continuation | Start a story with a novel character and setting; choose a displayed path, interrupt a pending scene, then return to Mini. | Relevant next scene; voice/visual consistency; latest request wins; full face restored; Stop remains accessible |
| Optional artwork | With a compatible model configured, compare pictures off/on in separate sessions. Request a painting, cancel it, then Stop. | Consent enforced; actual model access; visible loading/failure state; decoded picture; no late picture after cancellation; observed extra cost |
| Camera awareness | With adult volunteers and awareness opted in, enter view, hold a visible smile and wave; repeat with poor lighting, camera pause and while someone speaks. | Correct observable cues; false reactions; time to react; cooldowns; no identity/emotion claims; no interruptions; no snapshots after pause/Stop; extra cost |
| Speech/display agreement | Ask for a story with a named hero and place, continue it by voice and a displayed choice, then play a hand game and tic-tac-toe. Simulate unavailable artwork in a development fixture. | Illustration uses completed spoken details; choice narration matches its scene message; game narration uses actual choices/moves/results; unrelated realtime game audio is suppressed; normal Qwen voice returns; no substitute drawing after image failure |

Run at least five repetitions per supported voice scenario in a quiet room. Use adult volunteers and invented content first. Device audio output matters: generated text and an open socket do not establish audible success. Do not record children's voices or retain their transcripts for benchmarking.

Report the median and slowest observed audible delay and interruption time, plus counts of completed, failed, unsupported and unrun trials. With a larger sample, report p95. Do not assign a zero or a passing score to an unrun trial. Note whether interruptions are handled by the device, provider or both.

## Mini validation available here

`npm test` exercises simulated provider events, media teardown, delayed audio completion, stale responses after interruption, bilingual fixed story choices, three riddle rounds, settings persistence, parent authorization, local tap play, the visual protocol, planner grants and image tickets. Local Chromium checks also exercised novel image prompts and allowlisted animation, story-choice continuation, exact counting, precommitted hand-game moves, artwork decoding, cancellation and phone widths through the real HTTP endpoints with simulated provider responses. These do not establish live Qwen speech/visual quality, actual image-model access or iPhone Safari timing.

The parent diagnostic “First audible reply” uses the local remote-stream audio meter, gated on playback being unmuted and unpaused. It measures from the provider's end-of-speech event, not from the physical moment the child stopped talking. It is unavailable if the audio meter cannot run. A blocked speaker, failed audio route or OS volume setting still needs a human listening check.

Live Qwen and physical competitor trials require the user's configured devices and credentials and remain unrun until performed explicitly. Instruction checkpoint updates do not create extra model responses, but their context can still affect provider token usage.

Awareness tests validate strict cue output, consent/scopes, observation budgets, cooldowns, late-result cancellation and teardown. Local Chromium uses synthetic canvas frames and simulated observations to exercise capture, HTTP and expression rendering; it does not measure face, smile or wave recognition accuracy. Spoken greetings in those checks use mocked speech synthesis, not iPhone audio hardware.

## Reproduce the V6.6 cloud browser smoke check

This uses test doubles for every Qwen call and real local face-landmark inference. It never uses `.env` or sends frames to Alibaba. Download scikit-image's public-domain NASA `astronaut.png` to a temporary path; source and license context are in [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md).

Start `node tests/fixtures/companion-smoke-server.mjs` in a terminal. In another, launch Chromium with a fresh temporary profile, `--headless --disable-dev-shm-usage --disable-background-networking --disable-component-update --disable-sync --no-first-run --use-fake-device-for-media-stream --use-fake-ui-for-media-stream --remote-debugging-port=9228 about:blank` (a sandboxed container may need `--no-sandbox`; do not use that flag for normal browsing). Then run:

```sh
node scripts/companion-browser-smoke.mjs /tmp/mini-astronaut.png
```

The check covers 320×568, 390×844, 430×932 and 844×390 views, parent-dialog focus, metadata-only setup, instant local board, mock image decode/failure without sketch fallback, cross-session failure suppression, real worker smile landmarks, visual reactions during Mini speech, child-speech priority, Stop track cleanup and absence of external requests. Screenshots are written under `/tmp/mini-mobile-*`. Restart the fixture server before rerunning because model failure suppression intentionally lasts for the process. Shut down the fixture/browser afterwards. These results do not substitute for live Singapore Qwen or physical iPhone testing.

For the exact in-app picture-close regression, run `node scripts/companion-close-browser.mjs` against a fresh fixture server and the same synthetic-media Chromium instance. It checks live camera frames and the same enabled microphone track after **Back to Mini**, optional context-error recovery, in-flight generation cancellation, image animation/reduced motion, responsive layouts and full Stop teardown. Signaling is mocked in this test; it does not establish delivery to a real Qwen peer. The managed environment's local WebRTC ICE test exposed no host candidates, so packet-level loopback was not used as passing evidence.

## Playful learning conversation acceptance checks

With **Mini leads playful learning** enabled, the same spoken reply should use the child's particular answer, offer a relevant idea and normally end with one easy invitation. It should not wait for the child to invent every next step, repeat a question that was answered, deliver long lessons or make every remark a quiz.

| Situation | Expected conversational behavior |
| --- | --- |
| Child says “cat” | Use that subject, add a tiny accurate fact or pretend idea, and offer a simple next choice. |
| Child says “I don’t know” | Model one example or offer two easy choices without pressure. |
| Child guesses incorrectly | Acknowledge the attempt, give a useful easier clue and invite another try. |
| A picture becomes visible | If the voice reply had no question, an optional invitation can encourage noticing details, making a sound or starting a tiny story. No extra model turn is started. |
| Child says stop, is tired, closes the picture or mutes | Cancel pending invitations; respect the pause or ending. |
| Follow-ups are off | Respond positively and helpfully, without optional invitations to prolong the conversation. |

These are live Qwen acceptance scenarios, not proof that prompt text guarantees every response. Automated tests cover invitation permission, one-per-turn/cost bounds, cancellation and no extra model-turn dispatch. Evaluate the actual warmth, educational correctness, pace and variety with supervised device sessions.

## Everyday maths and science acceptance checks

Try apples, a toy car and a plant in separate conversations in English and Mandarin. Mini should connect one small idea to the current subject, ask at most one simple question, and wait. Include a correct answer, a mistaken answer and “I don’t know” / “我不知道”. Check that a hint or simpler example helps, a correct answer receives a short explanation, and later difficulty follows the child's demonstrated understanding. Change the topic and turn playful learning off: Mini should respect both. Check arithmetic and science facts manually; prompt-contract tests do not establish live model correctness or educational effectiveness. No grades, timed pressure, ability labels or persistent child learning profile are created.

## English and Mandarin acceptance checks

Use Auto, Prefer English and Prefer Mandarin in separate short supervised sessions. Test “请用中文回答”, “English please”, mixed “我想要一只 blue cat”, and word-learning questions such as “猫用英语怎么说？” A switch should persist for local games and picture invitations; a single learned word should not reset the whole conversation. Mandarin should sound natural and child-friendly, not like a literal English translation. English should remain clear and idiomatic. Avoid correcting accents or overwhelming the child with a full translation after every response. Installed Safari voices affect local narration; Qwen supplies the main conversational voice. Unit/browser language-routing checks do not establish real ASR/TTS pronunciation quality.
