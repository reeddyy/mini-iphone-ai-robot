# Local camera reactions

Mini V6.5 uses on-device MediaPipe Face Mesh for its normal camera-reaction UI. It no longer waits for separate Qwen vision calls. The legacy cloud observation API remains available for older clients, but the current page does not request its grant or call it.

## Turn it on

Open the gear → parent settings. Before starting, enable **Allow AI to see the camera**, then **Mirror smiles and head movement**. Both choices reset on Stop and are excluded from saved settings. This works in free camera preview as well as live AI. In preview, camera frames remain local; in a paid session, enabled camera video still streams to Qwen for ordinary visual conversation.

The first use downloads about 11 MB of pinned assets from your own Mini server; versioned assets can be cached afterwards. There is no third-party model CDN or extra cloud-vision charge. Recent Safari with worker WebGL, OffscreenCanvas and transferable ImageBitmap support is needed. If the worker cannot run, parent settings explain that local reactions are unavailable and provide Retry; voice chat continues. Initialization times out after 45 seconds. Physical iPhone compatibility/performance still needs device testing.

## Observable reactions

- A single face's position guides Mini's eyes and head tilt.
- A visible smile held across two samples can make Mini smile. A one-eye wink or sufficient head movement can produce a wink or curious expression.
- Up to four samples per second run in a dedicated worker. One expression cue can appear every six seconds; there is no eight-reaction exhaustion limit. Holding a smile does not repeatedly trigger it.
- Gaze and visible expression reactions can continue during Mini's audio and games. Detected child speech keeps listening priority. No camera reaction interrupts existing audio.
- **Occasional spoken hello** is a separate off-by-default option. It waits for a quiet moment, does not overlap narration or a game, has at least 60 seconds between greetings, and allows at most two per session. It uses Safari narration without starting an extra paid AI turn.

These are approximate geometry checks, not an emotion classifier. A smile does not establish happiness; no face result is used to infer distress, identity or intent. Hand waves and full-body gestures are not tracked by this face model. Lighting, glasses, camera angle, distance and face variation can cause misses or false reactions. Ask what the child says they need rather than diagnosing feelings from appearance.

## Pause and privacy

**Pause local reactions** stops inference and resets gaze. **Pause visual sharing** pauses both realtime video sharing and local reactions while retaining the local preview. **Stop Mini** terminates the worker and releases camera/microphone tracks. Hiding Safari stops the session. In-flight bitmaps and stale landmark results cannot animate a paused/stopped session.

Camera bitmaps are transferred only to the local worker and closed after inference. Transient landmarks are reduced to geometry and discarded; no face embeddings, family identities, camera recordings or expression history are stored or uploaded by this feature. The already-authorized realtime feed remains subject to Qwen's processing policies. `ALIBABA_AWARENESS_MODEL` is unnecessary for local reactions.

The main page retains its strict no-evaluation script policy. The pinned ML library's evaluation requirement is scoped to its dedicated worker; it accepts local image bitmaps only. Asset origins and the minimal upstream worker-context correction are documented in [third-party notices](../THIRD_PARTY_NOTICES.md).

## Validation and device check

Unit/API tests cover geometry, cooldowns, consent, quiet-only speech, continuous eligibility during games, stale-result cancellation, retry and teardown. Chromium runs real landmark inference on a public-domain NASA adult photo, plus synthetic microphone/camera sessions and mobile viewport checks. No private/child photo or paid provider call was used. This confirms the local inference path works in Chromium; it does not establish child-cue accuracy or iPhone performance.

On your iPhone, first try the free preview: keep the front camera at face height in good light, check **Local reactions on · face in view** in parent settings, then smile, tilt your head, pause reactions and Stop. Verify gaze/reactions pause and the iPhone capture indicators clear on Stop. Then test during a live story. If the tracker reports an error, update Safari/iOS, use Retry once, or leave reactions off while chatting.
