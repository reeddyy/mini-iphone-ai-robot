# Image model recommendation for Mini

Researched 1 November 2026. Recommended target: **`qwen-image-3.0`**, one **1024×1024** image per explicit picture request. Keep `qwen-plus` as the separate game/story-image coordinator. Do not use the image model for voice or game rules.

Earlier guidance used `qwen-image-plus` without a verified successful Singapore request. The supplied Windows logs return HTTP 404 for it. This research identifies supported newer API IDs and a matching request profile; it does not establish access with your private key.

## What to choose

| Model ID | Recommendation | Evidence and limits |
| --- | --- | --- |
| `qwen-image-3.0` | Default target for ordinary requested illustrations | Registered in the maintained DashScope integration; its merged change reports successful real international calls at 1024×1024. Mini's own live latency/quality comparison is still outstanding. |
| `qwen-image-3.0-pro` | Explicit quality comparison for a special illustration | The same integration reports a successful international call. Treat it as a separate parent choice; we have not measured a quality or latency advantage on this account. |
| `qwen-image-2.0` | Manual fallback if the account cannot use 3.0 | Also exercised successfully in the integration's international regression run. Do not silently switch models after a failed paid attempt. |
| `qwen-image-2.0-pro` | Supported alternative, rather than the default choice for this update | Registered by the maintained adapter. It is not a demonstrated improvement for Mini without a like-for-like device/provider comparison. |
| `qwen-image-plus` | Retain only for a separately verified older-model setup | It currently returns 404 in the supplied logs; repeating it is not evidence of access. |

This is a product recommendation based on current API-integration evidence. It is not a benchmark ranking. A smaller single-image request limits work and cost exposure, but does not guarantee a particular response time. Animated faces and rules-checked games remain immediate local rendering; Qwen still composes their scene data dynamically. Full image generation is used for requested illustrations.

## Evidence reviewed

1. **Qwen's official image-model repository** announces Qwen-Image-2.0 on 10 February 2026, describing stronger semantic adherence and a lighter/faster architecture. Its README is useful family-level context; it does not independently document Singapore availability of the later 3.0 API IDs: https://github.com/QwenLM/Qwen-Image#news .
2. **LiteLLM's maintained DashScope image adapter** explicitly supports `qwen-image-2.0`, `qwen-image-2.0-pro`, `qwen-image-3.0` and `qwen-image-3.0-pro`. It uses the native multimodal-generation endpoint, message-based text input and output image URLs: https://github.com/BerriAI/litellm/blob/main/litellm/llms/dashscope/image_generation/transformation.py .
3. **Merged support with reported live international results:** LiteLLM PR #38449, merged 27 August 2026, registers the 3.0 models and includes before/after calls using a real international key. The reported 3.0 and 3.0 Pro requests return HTTP 200 at 1024×1024; 2.0 also passes. These are the maintainer's published results, not calls made with Mini's key: https://github.com/BerriAI/litellm/pull/38449 .
4. **Current registry cross-check:** all four model IDs are present in the integration's model catalog, with image-generation capabilities. Prices may depend on region and resolution, so no fixed price or free quota is assumed: https://github.com/BerriAI/litellm/blob/main/model_prices_and_context_window.json .

Alibaba's public API page and the supplied console link are blocked by this cloud environment's outbound policy. I could not read the current first-party regional availability table or the account's enabled models. The public integration evidence supports the recommendation; the private account's permissions, billing, provider latency and iPhone behavior remain unverified.

## Windows configuration

Stop the live session, then stop the Windows Node server with Ctrl+C. Run `git pull`. Edit the **existing** private `.env` and replace the existing model lines (do not create duplicates):

```dotenv
ALIBABA_VISUAL_MODEL=qwen-plus
ALIBABA_IMAGE_MODEL=qwen-image-3.0
ALIBABA_IMAGE_ENDPOINT=singapore
```

Keep the existing pay-as-you-go API key and Singapore workspace. Do not switch to a Token Plan/Coding Plan key. Run `npm start`, then refresh Safari. Review **Pictures** in parent settings; it defaults on when configured. Every new paid session still needs parent confirmation, including extra image charges. Picture choices stay for this visit and default on after refresh.

The artwork request uses:

```text
POST https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation
model: qwen-image-3.0
input.messages: [{role: user, content: [{text: prompt}]}]
parameters.n: 1
parameters.size: 1024*1024
```

The server alone supplies its Bearer key and workspace header. Mini's 2.0/3.0 profiles use 1024×1024, prompt expansion remains disabled, and older configured models retain their original resolution. No API key or image-generation access is tested just by updating code or changing the model name.

Parent settings → **Troubleshooting → Connection and picture setup → Check image model setup · free** can inspect account metadata without making a picture request; a listed ID still does not prove generation entitlement. If 3.0 returns an access/model error, keep the diagnostic's exact stage, HTTP status and provider code. Correct access or explicitly configure an available alternative, then restart the Windows server to clear the persistent image-failure block. Never silently retry across models/regions. A real one-picture test would use the parent's normal paid-session consent; no paid request was made during this research.
