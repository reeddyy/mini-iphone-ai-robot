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
3. Leave `ALIBABA_IMAGE_MODEL` blank for scenes and games without generated artwork. For Mini’s requested pictures, the researched target is `qwen-image-3.0` with a 1024×1024 request; see [model recommendation and evidence](image-model-research.md). To enable artwork, configure a model available in your Singapore workspace that supports the synchronous multimodal image-generation request/response described below. Image requests now default to the native Singapore host (`ALIBABA_IMAGE_ENDPOINT=singapore`); `workspace` is an explicit alternative for accounts using that route. The server supplies the workspace header in both cases. Models requiring asynchronous task polling are not supported by this adapter. The example model names in tests are fixtures, not evidence of account access.
4. Run `npm start`, refresh the HTTPS Safari page, and start a short parent-authorized session. **Show visual stories and games** enables the planner. **Allow newly generated pictures** is separate, off by default, and resets on Stop. This picture consent is never included in saved settings.

### If the generated-pictures checkbox is disabled

Read the explanation next to the checkbox. Stop any running session before changing picture permission, and enable **Show visual stories and games** first. If the server reports that pictures are not configured, add an image model to your existing private Windows `.env`; `git pull` does not modify that file. Use `qwen-image-3.0` as the recommended target if your Singapore account enables it. The standard and Pro variants use the same native API; see [the research notes](image-model-research.md).

```dotenv
ALIBABA_IMAGE_MODEL=qwen-image-3.0
ALIBABA_IMAGE_ENDPOINT=singapore
```

Replace an existing blank `ALIBABA_IMAGE_MODEL=` line rather than adding a duplicate. Keep your current API key and workspace settings. Stop the Windows server with Ctrl+C, save `.env`, run `npm start`, and refresh Safari. You can then tick picture permission before starting a new session. A configured name enables the checkbox; actual account access is checked only when a picture is requested. This adapter requires the synchronous multimodal generation API, so a model using asynchronous task polling will need a different adapter.

### Visual error after every spoken turn

For normal chat/story turns, the planner waits for Mini's completed spoken-reply transcript and then decides how to illustrate it. `ALIBABA_VISUAL_MODEL` must be a chat model returning JSON drawing instructions. Putting `qwen-image-plus` there sends an image-generation model a chat-planning request and causes repeated visual errors. Keep these settings separate:

```dotenv
ALIBABA_VISUAL_MODEL=qwen-plus
ALIBABA_IMAGE_MODEL=qwen-image-3.0
ALIBABA_IMAGE_ENDPOINT=singapore
```

After editing the existing private Windows `.env`, restart the Mini server and refresh Safari. The updated app detects Qwen image-generation models in the planner setting, displays the correction in Parent setup and disables those visual calls until corrected. Voice and separately configured camera awareness remain available. This setup check does not call a provider, automatically change your model selection or verify model access in your account.

### If visuals still fail with the correct models

Parent setup now shows the **loaded planner and artwork model names** and the **Last visual issue**. A line such as `VISUAL_ACCESS · planner · qwen-plus · HTTP 403 · AccessDenied` identifies the failed stage without exposing an API key or transcript. `planner` fails before artwork generation begins; `artwork` identifies the separate image request. Copy this line for troubleshooting. It remains in the current tab after Stop and clears on a new session, Pause/Resume or refresh; it is never saved to browser storage.

| Diagnostic | Meaning / next check |
| --- | --- |
| `VISUAL_AUTH` | Provider credentials rejected; check Singapore key/workspace configuration |
| `VISUAL_ACCESS`, `VISUAL_QUOTA` | Model permissions, billing or quota; voice access does not establish access to other models |
| `VISUAL_MODEL_UNAVAILABLE` | Configured model or API route unavailable in this workspace; the line includes the model and HTTP status |
| `VISUAL_REQUEST` | Provider rejected request parameters; an allowlisted parameter or `JSON_REQUIRES_NON_THINKING` hint may be shown |
| `VISUAL_RESPONSE_JSON`, `VISUAL_PLAN_INVALID`, `VISUAL_OUTPUT_LIMIT` | Invalid/incomplete drawing instructions; one invalid plan may recover on the next child turn; repeated invalid output pauses planning |
| `VISUAL_NETWORK`, `VISUAL_TIMEOUT` | Windows server connectivity or a timed-out operation |
| `VISUAL_GATEWAY` | Tunnel returned a sign-in/error page instead of the Mini JSON API |
| `IMAGE_DOWNLOAD`, `IMAGE_FORMAT`, `IMAGE_DESTINATION` | Image generation returned an unusable or unreachable picture result |

Persistent planner access/configuration errors and repeated invalid plans pause further planning calls for that session, so ordinary conversation does not repeatedly send failing paid requests. Voice chat and local rules continue; the child sees one simple resting message rather than technical details. **Resume visual responses** in Parent setup only re-enables planning for the next spoken request; the button does not itself call a model. Fix account/configuration issues before resuming. Artwork failures are reported separately and do not disable vector scenes. Failed or cancelled provider requests can still incur charges.

An artwork 404 means the provider could not serve that model on the requested route; it does not by itself establish which account permission or regional model is missing. The default image route is now `https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation`, with `X-DashScope-WorkSpace`. Voice and scene planning retain their existing workspace routes. No automatic model, endpoint or region retry is made. A model/auth/access/quota rejection disables further paid image attempts across all grants in this server process; future plans are told to compose drawings instead. Correct model access and restart the Windows server before trying artwork again.

Artwork plans can include a matching vector/emoji `fallback` made from the same validated drawing primitives. It appears while the image is being generated and remains if generation fails. A successful decoded image replaces it. This uses the original planning response, without another planning or image call. Parent diagnostics still report the image failure, so a fallback is not presented as proof that the image model works.

The planner accepts a complete JSON code fence and empty/null known optional placeholders before strict validation, since some models include these even for ordinary-chat `keep` responses. Unknown properties, non-empty forbidden scene fields, unsafe nodes and invalid game rules remain rejected. There is no generated-code execution or automatic provider retry. The planner has a 40-second request timeout and a 4096-token output ceiling; these do not guarantee provider availability or response quality.

Each completed child turn can add a paid planning call even if the result is “keep this screen”. Existing board positions are handled locally. Story buttons request another plan; a spoken story-choice interpretation can require one bounded continuation call. Counting and hand-game buttons calculate results locally. Artwork adds an image-model call and download. There are no automatic provider retries. Per grant, the server allows 60 planning attempts, at most eight per minute, and four image attempts. Cancellation can still incur charges. Configure provider quotas and billing alerts independently.

Without live AI credentials, the existing free preview, tap game and tic-tac-toe remain available; they do not simulate a successful Qwen connection.

## Request and rendering flow

The existing Realtime voice connection supplies the completed child transcript and Mini's spoken-reply transcript. Normal chat/story planning waits for that reply, then `/api/visual/plan` sends the child request, bounded `spokenReply`, current validated scene and language to the workspace's `/compatible-mode/v1/chat/completions` endpoint with JSON output. The planner is instructed to preserve the spoken characters, setting, objects and options, rather than invent a parallel story. It receives one of `keep`, `clear`, `scene`, `character`, `activity`, `interact` or `artwork`. If the reply transcript is missing, visuals pause with `VISUAL_SPEECH_CONTEXT` rather than generate an unrelated narrative.

The shared schema rejects unknown fields, executable attributes, remote assets and excessive sizes on both server and browser. Rendering uses DOM/SVG creation and literal `textContent`, never generated scripts or markup. Motion comes from local CSS. Mini stays visible above the scene and Stop remains accessible. New speech, a newer request, leaving the scene and Stop cancel pending work; stale replies cannot overwrite a newer scene.

The voice model receives displayed scene messages, choices, object labels and local game results through its existing between-turn checkpoint mechanism. Visuals can arrive after the spoken reply because planning now depends on that reply. The generated illustration still requires model interpretation; perfect semantic accuracy is not guaranteed.

Tic-tac-toe, hand-game and counting results use a different source of truth: the browser's actual state. During an active local game turn, Mini suppresses the competing realtime game audio and speaks validated moves/results through Safari speech synthesis. Touch results and story-choice continuations are narrated from the same local state or returned scene message. Ordinary chat returns to the existing Qwen voice after leaving the game. Safari's voice may sound different and may need a face tap to unlock playback. Child speech interrupts narration; queued result narration waits until the child finishes. No extra `response.create` or paid TTS model is used. Live audio timing, narration quality and model interpretation still need supervised iPhone evaluation.

Artwork uses the native Singapore `/api/v1/services/aigc/multimodal-generation/generation` endpoint by default, with text messages, one image, `1328*1328`, prompt extension and watermark parameters. It expects a synchronous `output.choices[].message.content[].image` OSS URL. The server downloads bounded PNG/JPEG/WebP bytes without forwarding API credentials or the workspace header to storage. The browser decodes a temporary blob URL. There is no permanent image gallery or stored conversation history.

The regional host/protocol paths follow Alibaba's [official DashScope SDK configuration](https://github.com/dashscope/dashscope-sdk-python/blob/main/dashscope/_config.py), [workspace header transport](https://github.com/dashscope/dashscope-sdk-python/blob/main/dashscope/transport/http.py) and [image adapter](https://github.com/dashscope/dashscope-sdk-python/blob/main/dashscope/resources/images.py). Qwen's [image-generation model](https://github.com/QwenLM/Qwen-Image) is a separate capability from the existing realtime voice model. The integration does not assume every voice account can use an image model.

## Verification and limits

Automated tests cover arbitrary scene subjects, protocol rejection, deterministic rule results, parent-session grants, consent, single-use tickets, request limits and cancellation. Local Chromium checks use simulated provider responses with the real renderer and HTTP endpoints, including phone widths and reduced motion. No paid provider calls were made during implementation. Live Qwen planning, image-model access, content quality and physical iPhone Safari behavior remain unrun here.

Prompts encourage gentle age-appropriate content, but structural validation is not child-content certification. Adult supervision and provider content protections remain necessary. Transcripts, scenes, grants and downloaded artwork stay in application memory; the provider's own retention policies still apply.

## V6.5 recovery, speed and setup

Explicit tic-tac-toe requests now open the existing local board immediately, including with dynamic visuals enabled. No planner call is needed to open that known game. Other supported games and arbitrary characters/scenes retain Qwen planning. Normal illustrations still wait for the completed spoken reply so their subject and options can match what was narrated. Provider latency and artwork quality remain dependent on the enabled model; this update is not evidence that a particular image model works in your account.

The planner explicitly disables thinking for JSON mode. A complete JSON fence, null optional values, common named/three-digit colours and slightly oversized shape dimensions can be normalized before strict validation. Unknown node types, extra executable fields, URLs and invalid game graphs remain rejected. Safe failure diagnostics include a bounded reason such as NODE_COLOR or SCHEMA_MISMATCH, without raw child/model text. One malformed plan leaves the current scene usable and permits the next explicit child turn; two consecutive malformed plans pause further calls. Access/configuration errors pause immediately. There is no automatic retry.

Artwork uses the prompt's explicit subject, colours, expression and constraints; provider-side prompt expansion is disabled to avoid an additional rewrite. While waiting, the renderer labels its primitive fallback **Sketch preview**. If the full image fails, it says **Sketch only · the full picture is unavailable**. It does not present this fallback as a successful generated picture. Persistent model/auth/access/quota failures disable artwork across all grants until the server restarts. Other requests continue as scenes; voice chat remains available.

In the parent sheet, open **Visual stories, pictures and model setup → Image model setup and diagnostics** and use **Check model IDs · no generation** with the private parent code. The server reads at most three pages of native `/api/v1/models` metadata, caches it for one minute and returns only filtered identifiers. This follows the official DashScope SDK's Models metadata resource. It never runs a paid test, changes `.env`, selects a model or exposes your key. Missing metadata or a catalog entry cannot establish generation entitlement. Your signed-in Singapore catalog and billing/model permissions remain the source for an enabled model supporting the configured native multimodal image API. The observed `qwen-image-plus` 404 has not been reproduced/resolved against your Windows account here.

When optional follow-ups are enabled, a plan can include `followUp` (at most 140 characters), even alongside `keep`. It must build on the same child topic and spoken reply, not introduce a conflicting story. Safari may ask it once after six seconds of quiet, at most six times per session, provided Qwen did not already ask a question and the child/story has not ended. New speech, touch, mute and Stop cancel it. The question comes from the existing planner call; it never triggers `response.create` or a second model turn.
