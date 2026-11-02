# Generated images and animated visuals

Mini V6.6 uses actual generated images for character and story visuals. It does not create or display SVG drawings, sketch previews or substitute illustrations. The app animates still images with allowlisted float, bounce, wiggle and pulse effects; it does not request generated video.

## Picture requests

With parent-authorized picture permission, explicit requests such as “Show me a cat”, “Draw a dancing jellyfish astronaut” and Mandarin equivalents go straight to the configured image model. Subjects are open-ended, not a catalog of pre-coded characters. A generation ticket is minted by the server and the image request still uses the same scoped grant and four-image budget. An explicit picture request does not add a separate paid planning call.

Other visual story turns use a compact Qwen response containing an image prompt, title, motion and optional story choices. It is anchored to the child's request and Mini's completed spoken reply. If pictures are not permitted or available, Mini explains that parent setup is needed and continues voice chat. It does not substitute a drawing. An image failure produces a simple child-facing message and a precise parent diagnostic; persistent model/auth/access/quota failures block new image attempts until the Windows server restarts.

The image API receives a child-appropriate illustration instruction and the requested subject, with consistent narrated details when available. Generated content can still be inaccurate or unsuitable; no live quality or content-safety guarantee is made. Camera imagery is not supplied to this image route.

## Interactive games

Tic-tac-toe remains a real local board, opening immediately without a planning call. Counting, choice activities and complete 2–5 move duels use local controls and rules. Qwen can supply labels, rules and choices; it cannot replace playable controls with a generated screenshot or invent results. Games therefore remain usable without image-generation permission. Tapped story choices can request the next generated illustration and its matching narration.

## Windows setup

Stop the live session and the Windows server, run `git pull`, then replace the existing model lines in the private `.env`:

```dotenv
ALIBABA_VISUAL_MODEL=qwen-plus
ALIBABA_IMAGE_MODEL=qwen-image-3.0
ALIBABA_IMAGE_ENDPOINT=singapore
```

Keep the existing Singapore pay-as-you-go key and workspace. Run `npm start`, refresh Safari, then review **Pictures**, which defaults on when configured, before starting a parent-authorized session. Stories and game planning are enabled automatically. Picture choices stay for this visit and default on after refresh; every new paid session still needs parent confirmation including image charges. Research and model access limits are in [image model research](image-model-research.md). The console catalog is not proof of entitlement for a particular key; no paid API test was made here.

Qwen Image 2.0/3.0 requests use one 1024×1024 image, without provider prompt expansion. Older configured image models retain their original resolution. The native image endpoint is `https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation`; workspace routing is an explicit server setting. There is no automatic model/region fallback. Troubleshooting → Connection and picture setup includes a read-only model-ID check that does not generate a picture.

## Back to Mini and the camera

**Back to Mini** cancels pending visual work and changes the local view. It does not stop WebRTC, revoke the session grant, reacquire camera/microphone capture or send a new Qwen settings update. A delayed acknowledgement cannot refresh context just because a picture closed. New interactions may update context later; failed optional updates leave voice/camera connected.

The camera source remains rendered outside the parent dialog, with a larger monitor in settings using the same stream. Closing settings or a picture can resume that existing video element without starting another camera or paid session. A parent-only last-session-end reason helps diagnose an actual stop. **Stop Mini**, page departure and hiding Safari still release capture for privacy.

## Protocol, costs and errors

The protocol accepts only `keep`, `clear`, `artwork`, `activity` and `interact`. Image prompts are bounded to 800 characters; motion uses fixed presets; choices and game rules are strictly bounded. Unknown markup, nodes, drawing fallbacks, scripts, URLs and arbitrary CSS are rejected. Model text is never executed. Image bytes must come through the authenticated server adapter, match PNG/JPEG/WebP signatures and satisfy download-size/destination limits. Browser-to-Mini requests preserve tunnel credentials using `X-Mini-Visual-Session`; the API key stays on Windows.

There are at most 60 visual requests (8 per minute) and 4 image attempts per session. Failed or cancelled requests may still incur provider charges. These are application limits, not a provider billing guarantee. One invalid coordinator response can recover on the next child turn; repeated invalid responses pause coordination. Safe diagnostics include stage/model, HTTP/provider code and a canonical validation field, never raw child/model output. Voice continues through visual failures.

Unit/API tests cover arbitrary picture routing, consent, budgets, animation, canonical game results, rejected drawing payloads, image-download restrictions and live-session preservation on close. Browser tests use actual synthetic camera/microphone capture and mocked Qwen/image responses. Physical iPhone/Qwen accuracy, latency, account permissions and generated-image quality remain unverified here.
