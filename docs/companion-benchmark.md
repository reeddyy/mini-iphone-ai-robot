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
| Speech/display agreement | Ask for a story with a named hero and place, continue it by voice and a displayed choice, then play a hand game and tic-tac-toe. Simulate unavailable artwork in a development fixture. | Illustration uses completed spoken details; choice narration matches its scene message; game narration uses actual choices/moves/results; unrelated realtime game audio is suppressed; normal Qwen voice returns; fallback depicts the requested subject |

Run at least five repetitions per supported voice scenario in a quiet room. Use adult volunteers and invented content first. Device audio output matters: generated text and an open socket do not establish audible success. Do not record children's voices or retain their transcripts for benchmarking.

Report the median and slowest observed audible delay and interruption time, plus counts of completed, failed, unsupported and unrun trials. With a larger sample, report p95. Do not assign a zero or a passing score to an unrun trial. Note whether interruptions are handled by the device, provider or both.

## Mini validation available here

`npm test` exercises simulated provider events, media teardown, delayed audio completion, stale responses after interruption, bilingual fixed story choices, three riddle rounds, settings persistence, parent authorization, local tap play, the visual protocol, planner grants and image tickets. Local Chromium checks also exercised novel vector composition, story-choice continuation, exact counting, precommitted hand-game moves, artwork decoding, cancellation and phone widths through the real HTTP endpoints with simulated provider responses. These do not establish live Qwen speech/visual quality, actual image-model access or iPhone Safari timing.

The parent diagnostic “First audible reply” uses the local remote-stream audio meter, gated on playback being unmuted and unpaused. It measures from the provider's end-of-speech event, not from the physical moment the child stopped talking. It is unavailable if the audio meter cannot run. A blocked speaker, failed audio route or OS volume setting still needs a human listening check.

Live Qwen and physical competitor trials require the user's configured devices and credentials and remain unrun until performed explicitly. Instruction checkpoint updates do not create extra model responses, but their context can still affect provider token usage.

Awareness tests validate strict cue output, consent/scopes, observation budgets, cooldowns, late-result cancellation and teardown. Local Chromium uses synthetic canvas frames and simulated observations to exercise capture, HTTP and expression rendering; it does not measure face, smile or wave recognition accuracy. Spoken greetings in those checks use mocked speech synthesis, not iPhone audio hardware.
