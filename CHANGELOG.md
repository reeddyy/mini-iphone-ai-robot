# Changelog

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
