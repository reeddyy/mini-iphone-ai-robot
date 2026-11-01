# Optional visual awareness

Mini can react to a person appearing, a clear visible smile, or a wave during a quiet moment of a live session. These reactions do not recognise who someone is or establish how they feel. There is no face enrollment, identity matching, face database or emotion classifier.

## Enable and control

1. Pull the update, restart the server and refresh Safari. Keep the existing private API key and Singapore workspace in `.env`.
2. In Parent setup, enable camera sharing, then **Notice visible smiles, waves and arrivals**. The separate awareness option is off by default. A compatible vision chat model must be enabled in the same Model Studio workspace: `ALIBABA_AWARENESS_MODEL` defaults to `qwen-vl-plus`, independently of scene planning and artwork models.
3. Optionally enable **Allow an occasional spoken hello**. It is also off by default. Otherwise reactions are silent expressions: a curious greeting, a wink at a wave or a smile back.
4. Start a short parent-authorized paid session. Allow a quiet moment and keep faces/hands clear in the camera view. The awareness status and Pause/Resume control are in Parent setup. All awareness and greeting consent resets on Stop and is excluded from saved settings.

Pausing awareness stops its extra snapshot requests and reactions. The already-authorized realtime camera stream continues. **Pause visual sharing** pauses both realtime sharing and awareness while leaving the local preview running; **Stop** releases camera/microphone capture. Muting the microphone also suspends awareness checks and reactions, while ordinary camera sharing continues unless separately paused.

## What happens

The browser samples a small local camera thumbnail every two seconds while awareness is eligible to run. Pixel changes and native `FaceDetector`, when available, gate observations. Native face detection is optional and may be unavailable in Safari; local pixel-motion gating remains available. Neither gate establishes identity or an expression.

When a check is due, the browser sends two temporary JPEG frames, about two seconds apart and at most 320×240 each, to `/api/visual/observe`. The server sends them to the configured vision model through the workspace's OpenAI-compatible chat endpoint. The model can return only person present, face visible, smiling, waving and confidence. Unknown fields, including identity or emotion labels, are rejected. Model instructions require clear presence across both frames and hand movement for a wave; a raised hand alone is insufficient. This cannot guarantee perception accuracy.

Local policy accepts only observations with confidence of at least 0.85, reacts to changes and limits reactions to eight per session. Confidence is the model's report, not a calibrated probability. Continuous smiles or held gestures do not repeatedly trigger reactions. Greetings after an observed absence require at least 20 seconds. Reactions are at least 30 seconds apart, and optional spoken hellos at least 60 seconds apart. Smiles never trigger speech. These are gentle fixed reactions, not model-generated comments on someone's emotional state.

Checks wait until at least six seconds after voice/playback/touch activity and local microphone noise. They pause during speech, pending replies, audio playback, local narration, visual activities, mute, camera pause and the final session minute. Hiding Safari stops the whole session. New speech or a newer activity cancels pending observations; stale results cannot trigger a reaction. Optional hellos use the existing Safari narration path, temporarily disabling the outgoing microphone only while speech actually starts and restoring it afterwards. They do not send `response.create` or start an additional realtime model turn.

## Cost, privacy and limitations

Awareness adds separate paid vision calls in addition to any realtime camera streaming, scene planning or artwork. There is at least 15 seconds between observation attempts, a slower 45-second heartbeat for an unchanged scene, and a maximum of 40 attempts per grant. Reaching the eight-reaction budget also stops further observations for that session. Cancellation or provider failure may still incur charges. These limits are not a guaranteed financial spending cap; set provider quotas and billing alerts.

An observation error pauses awareness without an automatic retry. The parent may explicitly Resume after at least 15 seconds, or leave awareness off and continue voice chat. Model availability is account-specific; a configured name is not proof of access. The app does not silently substitute a model or switch to another region.

Camera snapshots and tiny motion samples stay in application memory and are not written to disk or browser storage by Mini. Temporary frames are discarded on interruption, pause and Stop; the provider's own processing and retention policies still apply. No family identities, face embeddings or expression history are stored. The parent-issued grant separately scopes awareness and visual-scene calls, expires within 60 minutes and is revoked on Stop on a best-effort basis.

This is sampled awareness, not continuous gesture tracking. Brief waves can be missed, and lighting, framing, glasses, occlusion and model errors can cause missed or incorrect cues. A visible smile does not prove happiness. Check-ins should follow what a child says; the app does not diagnose distress from a face. Adult supervision remains necessary.

## Verification

Automated tests exercise observation validation, consent scopes, frame bounds, server rate/total limits, confidence/cooldown policy, conversational gating, cancellation and consent reset. Chromium checks use synthetic camera imagery and simulated Qwen output through the real capture, HTTP and UI paths. Optional speech is mocked for microphone-restoration checks. No real people's images or paid provider calls were used. Live Qwen perception accuracy, model access, latency and physical iPhone Safari audio/camera behavior remain unverified here.
