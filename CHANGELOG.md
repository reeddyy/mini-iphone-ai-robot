# Changelog

## Unreleased — Child controls and gentler conversation

- Route artwork through the documented Singapore native API with the workspace header, retain an explicit workspace-route option and include the chosen route in diagnostics. Add validated artwork fallback drawings, replace them on successful image decode, and disable further paid image calls after a model/access/quota rejection for the current grant.
- Anchor ordinary illustrations to Mini's completed spoken reply instead of independently planning from the child request. Narrate game moves/results from browser state and speak tapped story choices from the returned scene message; suppress competing realtime game audio and restore ordinary Qwen voice after game turns. Preserve interruption, child turn-taking, Mandarin narration and media cleanup.
- Replace generic visual failures with safe planner/artwork diagnostics including loaded model, HTTP status and allowlisted provider code. Pause repeated planner requests after failure and add parent Pause/Resume controls while voice continues. Retain the safe diagnostic in tab memory after Stop for troubleshooting.
- Accept complete JSON fences and empty/null optional placeholders from Qwen before strict drawing validation, add compact ordinary-chat examples and increase the bounded planner output/time allowance. Preserve rejection of executable content, invalid game rules and unsafe image destinations; do not retry provider calls automatically.
- Detect Qwen image-generation models mistakenly assigned to `ALIBABA_VISUAL_MODEL`. Explain the separate chat-planner and artwork settings before a session, block invalid planning calls without provider charges, and preserve voice/camera-awareness availability. Add regression coverage for the reported per-turn visual failure.
- Fix repeated ngrok Basic Auth password prompts during visual chat and camera awareness. Send Mini grants in a dedicated header while preserving browser-managed tunnel credentials for planning, pictures, observations and revocation. Add HTTP gateway regression coverage and a browser check with one initial password challenge across all visual routes.
- Explain why generated-picture consent is disabled (server setup, visual-scenes preference or an active session), and add inline Windows image-model configuration steps. Keep picture consent off by default and do not make paid calls to check configuration.
- Add separately consented camera awareness: local motion/native face-presence gates, bounded two-frame Qwen vision observations, and quiet-time face reactions to presence, visible smiles and waves. No face enrollment, identity matching, emotion labels or recordings.
- Add optional Safari-spoken hellos, off by default, with microphone restoration and interruption. Respect conversation/audio, activities, touch, mute, camera pause, page visibility and the final minute of a session. Limit reactions to eight per session and observation attempts to 40, at least 15 seconds apart. Provider errors pause awareness until manual resume; Stop aborts checks, revokes the shared grant and resets consent.
- Add Qwen-directed scene planning for arbitrary visual subjects using validated drawing primitives, emoji, text, motion and choices. Keep a compact Mini beside scenes, with a persistent Stop control and Back to Mini.
- Add generic locally scored choice duels (including scissors-paper-stone), exact count activities and visual story choices. Mini commits its random duel move before the child chooses; spoken selections can use Qwen interpretation.
- Add optional, separately consented artwork generation through a configured synchronous image model. Use parent-session grants, single-use image tickets, request limits, cancellation, bounded image downloads and non-executable rendering. Image consent is never saved.
- Validate the visual protocol, authorization, provider requests, consent and interruption races with mock tests and local Chromium checks. No live or paid provider calls were made; image model availability and iPhone Safari remain device checks.
- Add a shared tic-tac-toe scene with a compact Mini face, tappable numbered squares, X/O marks, turn indicators, winning-line highlights, New round and Back to Mini. English/Mandarin spoken requests and positions use the same local rules. Free touch play never opens media or AI; voice remains inside the existing paid session. Stopping, hiding the page, changing activity or resetting cancels pending moves.
- Coordinate facial reactions into interruptible sequences; only show speaking/listening cues after audible playback transitions. Child speech mutes interrupted playback, and late events from old replies cannot consume the new turn.
- Add a session-only story checkpoint (hero, setting, goal and ending) and three animal-riddle rounds with easier clues. Synchronize instructions between turns without requesting extra model responses; disable optional synchronization if the provider rejects it.
- Add a three-round local copy-the-taps game that never opens media or connects to AI. Optional soft sounds default off; entering a voice or preview session cancels local play.
- Simplify parent startup, use a balanced pause by default, and show microphone/camera sharing on the child screen. Opt-in saved settings contain only whitelisted non-sensitive choices, with a separate Forget action; camera sharing resets on stop.
- Add a repeatable six-scenario companion benchmark guide in `docs/companion-benchmark.md`. Live provider and competitor measurements remain unrun.
- Redesigned Mini as a soft lavender character with oversized glossy plum eyes, rosy cheeks and a small smile. Added distinct delight, curiosity, wink, surprise, reassurance and resting expressions; the mouth still follows incoming audio. Preserved keyboard/touch access and reduced-motion support.
- Preserve microphone mute during permission requests and live media attachment; wire the local input meter into free preview.
- End capture on direct English/Mandarin spoken stop commands, with a gentle resting message. Keep Stop available independently of transcription.
- Require backend-verified parent reauthorization for paid extensions; clear codes and discard late responses after cancellation or stop.
- Expose blocked-audio recovery beside Mini's face.
- Vary local opening questions and include their exact text in the model instructions.
- Apply the follow-up preference to both model instructions and local speech. Allow quiet acknowledgements, meaningful story choices and complete story endings.
- Show a last-minute break notice without extra model calls, and clear displayed transcripts on stop.
- Add regression coverage for media races, stop commands, authorization, late responses, audio recovery and conversation preferences. Live provider and iPhone Safari behavior remain device checks.

## 6.4.0 — Expressive Little Companion

- Redesigned Mini's face with large eyes, pink cheeks, ears, a small antenna, natural blinking and a gentle smile, all in self-contained CSS.
- Added expressive listening/thinking/talking states, speaking animation from the existing remote-audio meter, and animation for local Safari spoken prompts.
- Made happy/proud/surprised/curious reactions respond to Mini's own generated reply text without analysing the child's emotion.
- Preserved tap/peekaboo reactions across status updates and respected reduced-motion accessibility preferences.
- Kept the established V6.3 conversational UI, Qwen WebRTC connection, parent authorization, opt-in camera sharing and billing timeouts unchanged.
- Added static resource and face-state tests. Visual appearance and iPhone audio timing still require device testing.

## 6.3.0 — Just talk to Mini

- Removed all four Talk/Guess/Story/Show buttons from the child screen. One expressive face and live conversation are now the primary interface.
- Tucked live microphone level and AI hearing diagnostics into the collapsed Parent setup section; structured error codes remain visible on the main screen if a model error occurs.
- Tuned Qwen's Chat instructions to understand natural requests in English and Mandarin for storytelling, animal guessing games, show-and-tell, and casual conversation without button selection.
- Added small browser-local intent classification from a provided speech transcript ONLY for choosing an appropriate single Safari follow-up. It does not send new provider events, create additional responses or persist any transcripts.
- Preserved Qwen VAD, model-error safeguards, follow-up questions, camera opt-in, parent authorization and paid-session time limits.
- Added tests proving the child menu is gone and natural language requests do not create competing Qwen control events.
- New child-facing behaviour and speech naturalness still require live iPhone/Safari tests; CI does not make billable AI calls.

## 6.2.0 — Mini asks the next question (experimental)

- Stronger child-friendly Qwen instructions: every ordinary answer should acknowledge the child's specific reply and end with exactly one relevant question in the SAME audio response. Respect goodbyes, breaks and safety concerns.
- The parent can enable or disable "Keep the conversation going" (on by default).
- Where a completed Qwen transcript has no question, Safari can voice exactly one short activity-appropriate follow-up after a pause. No additional response.create, repeat prompting or paid reconnections.
- The fallback checks the live microphone and the timing of Qwen audio, and is cancelled if the child speaks, the session stops, the game changes, or Qwen already asked a question.
- Follow-up questions are intentionally limited and may sound different or be less context-aware than Qwen. No conversation transcript or audio is persisted.
- Added tests for Qwen questions, child stop requests, English and Mandarin, fallback cancellation, audio overlap and provider request counts.
- Real iPhone Safari audio timing, children's speech and follow-up naturalness need on-device testing; CI only simulates events.

## 6.0.1 — Fix unexpected mid-session Qwen model errors

- Removed extra `response.create` requests while automatic Qwen server VAD is enabled, following Alibaba's documented automatic response flow.
- Mini's first question and new game starters now use local Safari speech synthesis. Qwen replies to the child's actual microphone input.
- Sanitized and exposed the model's documented error code, type and parameter rather than hiding all failures behind a generic "check settings" message.
- Gracefully handles rejected activity instruction updates and failed individual replies when the session can continue.
- Queues game changes while a spoken answer awaits Qwen, preventing overlapping instruction updates.
- Preserves the parent-start requirement, camera opt-in, session timeout and no automatic paid retries.
- Verified using mocked WebRTC events and CI, not with a real child or billable Qwen session.

## 6.0.0 — Conversational Buddy (experimental)

- Corrected V5's major flaw: clicking a game no longer disconnects Qwen or pretends to listen during an offline quiz.
- All four child activity buttons use the **same live AI session**, with updated Qwen instructions for Talk, Guess, Story and Show.
- Requests a spoken opening question on connection and on selecting a game. Uses a single Safari voice fallback if the provider does not start the response.
- Added child-friendly acoustic server VAD with a lower sensitivity threshold for one-word, quiet replies and a normal/noisy-room option.
- Added real-time microphone sound meter, Qwen speech-detected and child transcript indicators, so parents can diagnose whether a reply reached the AI.
- Added simulated model events for conversation starts, voice answers and non-disconnecting activity changes, plus updated browser script tests.
- Model event sequencing and child-audio detection still require actual iPhone testing. No automated test calls Alibaba.

## 5.0.0 — Little Companion for children (experimental)

- Reorganized Safari home around a large expressive face with tap/peekaboo reactions and eye movement.
- Built three simple child actions: original English/Mandarin offline stories, an offline picture-choice quiz, and a Show & Tell cue for parent-enabled live camera.
- Moved all paid-session, camera, microphone and optional memory controls into a collapsed parent setup section.
- Made camera sharing opt-in and require a grown-up confirmation for every paid Qwen session.
- Clear the private robot access code from the page after successful SDP exchange; live AI stops when offline play begins.
- Added child-oriented short conversational prompts focused on safe curiosity and offline play, without personal-data collection or exclusive attachment.
- Added tests for bilingual content, page layout, static scripts, privacy boundaries and JavaScript syntax. New iPhone Safari behaviours require device validation.
- Based on design research into Loona Deskmate and LOOI; no proprietary characters or media copied.

## 4.0.0 — Faster conversations and configurable personality

- Added three VAD pace choices, response-delay indicator, opt-in browser-only preference note and audio-reactive face.
- Extended manual sessions to 60 minutes with timers, confirmations and no automatic paid reconnects.

## 3.0.0 — Live audio and vision prototype

- Safari robot UI with continuous microphone audio and camera video for Qwen Omni Realtime over WebRTC.
- Free local preview mode without API credentials.
- Front/rear camera choice, mute, pause video, session stop and optional direct-camera mode.
- Server-proxied SDP negotiation with API key kept on the server.
- Seven server tests (simulated responses; no real AI connection verified).
- GitHub-ready project with private-repo publishing guide, CI and security notes.

**Next:** Validate iPhone Safari + Alibaba WebRTC end to end, then improve feedback on audio/video status and session cost.
