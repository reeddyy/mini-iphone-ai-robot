# Qwen-directed visual responses

Mini can change its display when a child asks for something visual. Qwen chooses and composes the scene; the browser renders it and runs supported interactions. Subjects are open-ended within a small drawing protocol. Adding a cat, rocket, jellyfish or another expression does not require a new subject-specific component.

| Child request | Rendering path |
| --- | --- |
| “Become a cat with starry whiskers” | Qwen composes ears, eyes, whiskers and stars from shapes, text/emoji and preset motion |
| “Show three apples” | Qwen selects the count activity; the browser creates exactly three tappable apples |
| “Play scissors, paper, stone” | Qwen supplies move labels, symbols and win relationships; local rules commit Mini's move and score rounds |
| “Take our story to the moon” | Qwen composes a new scene and optional continuation choices |
| “Paint a picture of a moon garden” | Optional image backend, only when configured and consented; otherwise a vector/emoji scene |
| “Back to Mini” | Clear the scene and restore the full companion face |

The renderer supports ellipses, rounded rectangles, lines, polygons, literal text, emoji and five motion presets. A scene contains at most 32 nodes and six choices. Supported game mechanics are tic-tac-toe, exact counting, choice activities and 2–5 move duels. New subjects and complete pairwise duel rules can be generated dynamically; entirely new game engines cannot. The planner is instructed to offer a supported alternative for other mechanics.

## Enable on Windows

1. Stop the server, run `git pull` and `npm test` in the existing project, and keep your private `.env`.
2. The planner reuses `ALIBABA_API_KEY` and `ALIBABA_WORKSPACE_ID` from the Singapore pay-as-you-go setup. Its default is `ALIBABA_VISUAL_MODEL=qwen-plus`; use a compatible JSON-output chat model enabled in that workspace. Model availability is account-specific.
3. Leave `ALIBABA_IMAGE_MODEL` blank for scenes and games without generated artwork. To enable artwork, configure a model available in your Singapore workspace that supports the synchronous multimodal image-generation request/response described below. Models requiring asynchronous task polling are not supported by this adapter. The example model names in tests are fixtures, not evidence of account access.
4. Run `npm start`, refresh the HTTPS Safari page, and start a short parent-authorized session. **Let Qwen create visual scenes** enables the planner. **Allow newly generated pictures** is separate, off by default, and resets on Stop. This picture consent is never included in saved settings.

Each completed child turn can add a paid planning call even if the result is “keep this screen”. Existing board positions are handled locally. Story buttons request another plan; a spoken story-choice interpretation can require one bounded continuation call. Counting and hand-game buttons calculate results locally. Artwork adds an image-model call and download. There are no automatic provider retries. Per grant, the server allows 60 planning attempts, at most eight per minute, and four image attempts. Cancellation can still incur charges. Configure provider quotas and billing alerts independently.

Without live AI credentials, the existing free preview, tap game and tic-tac-toe remain available; they do not simulate a successful Qwen connection.

## Request and rendering flow

The existing Realtime voice connection supplies the completed child transcript. `/api/visual/plan` sends the request, current validated scene and language to the workspace's `/compatible-mode/v1/chat/completions` endpoint with JSON output. It receives one of `keep`, `clear`, `scene`, `character`, `activity`, `interact` or `artwork`.

The shared schema rejects unknown fields, executable attributes, remote assets and excessive sizes on both server and browser. Rendering uses DOM/SVG creation and literal `textContent`, never generated scripts or markup. Motion comes from local CSS. Mini stays visible above the scene and Stop remains accessible. New speech, a newer request, leaving the scene and Stop cancel pending work; stale replies cannot overwrite a newer scene.

The voice model receives displayed scene summaries and local game results through its existing between-turn checkpoint mechanism. Voice and visual generation run separately, so they may finish at different times and can disagree; instructions discourage claims about pictures before a visible checkpoint. There is no automatic spoken narration of tapped story choices. Live consistency, latency and child-friendly content require supervised evaluation.

Artwork uses `/api/v1/services/aigc/multimodal-generation/generation` with text messages, one image, `1328*1328`, prompt extension and watermark parameters. It expects a synchronous `output.choices[].message.content[].image` OSS URL. The server downloads bounded PNG/JPEG/WebP bytes without forwarding API credentials. The browser decodes a temporary blob URL. There is no permanent image gallery or stored conversation history.

The workspace and protocol paths follow Alibaba's [official DashScope SDK configuration](https://github.com/dashscope/dashscope-sdk-python/blob/main/dashscope/_config.py) and [image adapter](https://github.com/dashscope/dashscope-sdk-python/blob/main/dashscope/resources/images.py). Qwen's [image-generation model](https://github.com/QwenLM/Qwen-Image) is a separate capability from the existing realtime voice model. The integration does not assume every voice account can use an image model.

## Verification and limits

Automated tests cover arbitrary scene subjects, protocol rejection, deterministic rule results, parent-session grants, consent, single-use tickets, request limits and cancellation. Local Chromium checks use simulated provider responses with the real renderer and HTTP endpoints, including phone widths and reduced motion. No paid provider calls were made during implementation. Live Qwen planning, image-model access, content quality and physical iPhone Safari behavior remain unrun here.

Prompts encourage gentle age-appropriate content, but structural validation is not child-content certification. Adult supervision and provider content protections remain necessary. Transcripts, scenes, grants and downloaded artwork stay in application memory; the provider's own retention policies still apply.
