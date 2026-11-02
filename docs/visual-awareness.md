# Local camera reactions

Mini V6.5 uses on-device MediaPipe Face Mesh for its normal camera-reaction UI. It no longer waits for separate Qwen vision calls. The legacy cloud observation API remains available for older clients, but the current page does not request its grant or call it.

## Use camera reactions

Open the gear → parent settings. **Camera** defaults on, with local reactions and quiet-time hellos included. Confirm Start to allow capture; turn Camera off first for voice-only play. Camera choices stay for this visit and default on after refresh; they are not saved to storage. This works in free camera preview as well as live AI. In preview, camera frames remain local; in a paid session, enabled camera video still streams to Qwen for ordinary visual conversation.

The first use downloads about 11 MB of pinned assets from your own Mini server; versioned assets can be cached afterwards. There is no third-party model CDN or extra cloud-vision charge. Recent Safari with worker WebGL, OffscreenCanvas and transferable ImageBitmap support is needed. If the worker cannot run, Troubleshooting → Camera and microphone explains that local reactions are unavailable and provide Retry; voice chat continues. Initialization times out after 45 seconds. Physical iPhone compatibility/performance still needs device testing.

## Observable reactions

- A single face's position guides Mini's eyes and head tilt.
- A visible smile held across two samples can make Mini smile; a separate visible-smile cue can remain on the face while Mini listens. A one-eye wink or sufficient head movement can produce a wink or curious expression.
- Up to four samples per second run in a dedicated worker. One expression cue can appear every 1.5 seconds; there is no eight-reaction exhaustion limit. Holding a smile does not repeatedly trigger it.
- Gaze and visible expression reactions can continue during Mini's audio and games. Detected child speech keeps listening priority. No camera reaction interrupts existing audio. Frames are reduced to at most 320×240 inside the worker before landmark inference. Troubleshooting reports local reaction FPS and processing time, without uploading those frames.
- Occasional spoken hellos are enabled with camera reactions. They wait for a quiet moment, do not overlap narration or a game, have at least 60 seconds between greetings, and are limited to two per session. They use Safari narration without starting an extra paid AI turn.

These are approximate geometry checks, not an emotion classifier. A smile does not establish happiness; no face result is used to infer distress, identity or intent. Hand waves and full-body gestures are not tracked by this face model. Lighting, glasses, camera angle, distance and face variation can cause misses or false reactions. Ask what the child says they need rather than diagnosing feelings from appearance.

## Pause and privacy

**Pause local reactions** stops inference and resets gaze. **Pause visual sharing** pauses both realtime video sharing and local reactions while retaining the local preview. **Stop Mini** terminates the worker and releases camera/microphone tracks. Hiding Safari stops the session. In-flight bitmaps and stale landmark results cannot animate a paused/stopped session.

Camera bitmaps are transferred only to the local worker and closed after inference. Transient landmarks are reduced to geometry and discarded; no face embeddings, family identities, camera recordings or expression history are stored or uploaded by this feature. The already-authorized realtime feed remains subject to Qwen's processing policies. `ALIBABA_AWARENESS_MODEL` is unnecessary for local reactions.

The main page retains its strict no-evaluation script policy. The pinned ML library's evaluation requirement is scoped to its dedicated worker; it accepts local image bitmaps only. Asset origins and the minimal upstream worker-context correction are documented in [third-party notices](../THIRD_PARTY_NOTICES.md).

## Validation and device check

Unit/API tests cover geometry, cooldowns, consent, quiet-only speech, continuous eligibility during games, stale-result cancellation, retry and teardown. Chromium runs real landmark inference on a public-domain NASA adult photo, plus synthetic microphone/camera sessions and mobile viewport checks. No private/child photo or paid provider call was used. This confirms the local inference path works in Chromium; it does not establish child-cue accuracy or iPhone performance.

On your iPhone, first try the free preview: keep the front camera at face height in good light, check **Local reactions on · face in view** in parent settings, then smile, tilt your head, pause reactions and Stop. Verify gaze/reactions pause and the iPhone capture indicators clear on Stop. Then test during a live story. If the tracker reports an error, update Safari/iOS, use Retry once, or leave reactions off while chatting.

## Camera responsiveness and detail

The source camera targets a smooth 30 fps preview. AI sharing defaults to 2 fps and can be lowered to 1 fps for less data. Direct/compatibility mode limits the outbound sender rather than slowing the source camera and face tracker. Canvas mode uses a paced draw timer, keeps portrait/landscape proportions and refreshes the current frame at speech boundaries. It does not run a continuous full-rate canvas-copy loop.

Choose **AI camera detail → Sharper toys and text** for a larger outgoing frame (up to a 960-pixel long edge), with more data; Balanced uses up to 640 pixels. A sharper frame can help visible detail but does not guarantee recognition or lower provider latency. The parent monitor shows the whole frame rather than cropping it. Camera diagnostics separate targets from actual outbound frame/byte counters when browser WebRTC stats are available. “No sent video packets confirmed” means the preview alone is not evidence that Qwen received video.

Qwen is instructed to use the newest incoming camera view for “look”/“what is this”, and to distinguish it from a generated picture on the screen. Local geometry reactions and Qwen's semantic scene understanding are different paths: improving local tracking does not prove cloud recognition accuracy. No additional cloud vision polling or automatic paid response is introduced by these changes.
