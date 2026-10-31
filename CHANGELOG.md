# Changelog

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
