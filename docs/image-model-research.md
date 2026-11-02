# Image model recommendation for Mini

Integration research recorded 1 November 2026; public Alibaba documentation rechecked **2 November 2026**. Recommended target: **`qwen-image-3.0`**, one **1024×1024** image per explicit picture request, subject to the user's Singapore account access. Keep `qwen-plus` as the separate game/story-image coordinator. Do not use the image model for voice or game rules.

Earlier guidance used `qwen-image-plus` without a verified successful Singapore request. The supplied Windows logs return HTTP 404 for it. This research records integration-supported newer API IDs and a matching request profile; it does not establish access with your private key or prove that changing a model name fixes the earlier failure.

## What to choose

| Model ID | Recommendation | Evidence and limits |
| --- | --- | --- |
| `qwen-image-3.0` | Default target for ordinary requested illustrations | Registered in the maintained DashScope integration; its merged change reports successful real international calls at 1024×1024. Mini's own live latency/quality comparison is still outstanding. |
| `qwen-image-3.0-pro` | Explicit quality comparison for a special illustration | The same integration reports a successful international call. Treat it as a separate parent choice; we have not measured a quality or latency advantage on this account. |
| `qwen-image-2.0` | Manual fallback if the account cannot use 3.0 | Also exercised successfully in the integration's international regression run. Do not silently switch models after a failed paid attempt. |
| `qwen-image-2.0-pro` | Supported alternative, rather than the default choice for this update | Registered by the maintained adapter. It is not a demonstrated improvement for Mini without a like-for-like device/provider comparison. |
| `qwen-image-plus` | Retain only for a separately verified older-model setup | It currently returns 404 in the supplied logs; repeating it is not evidence of access. |

This is a product recommendation based on current API-integration evidence. It is not a benchmark ranking. A smaller single-image request limits work and cost exposure, but does not guarantee a particular response time. Animated faces and rules-checked games remain immediate local rendering; Qwen still composes their scene data dynamically. Full image generation is used for requested illustrations.

## Integration evidence recorded on 1 November

1. **Qwen's official image-model repository** announces Qwen-Image-2.0 on 10 February 2026, describing stronger semantic adherence and a lighter/faster architecture. Its README is useful family-level context; it does not independently document Singapore availability of the later 3.0 API IDs: https://github.com/QwenLM/Qwen-Image#news .
2. **LiteLLM's maintained DashScope image adapter** explicitly supports `qwen-image-2.0`, `qwen-image-2.0-pro`, `qwen-image-3.0` and `qwen-image-3.0-pro`. It uses the native multimodal-generation endpoint, message-based text input and output image URLs: https://github.com/BerriAI/litellm/blob/main/litellm/llms/dashscope/image_generation/transformation.py .
3. **Merged support with reported live international results:** LiteLLM PR #38449, merged 27 August 2026, registers the 3.0 models and includes before/after calls using a real international key. The reported 3.0 and 3.0 Pro requests return HTTP 200 at 1024×1024; 2.0 also passes. These are the maintainer's published results, not calls made with Mini's key: https://github.com/BerriAI/litellm/pull/38449 .
4. **Registry cross-check recorded in that research:** all four model IDs were present in the integration's model catalog, with image-generation capabilities. Prices may depend on region and resolution, so no fixed price or free quota is assumed: https://github.com/BerriAI/litellm/blob/main/model_prices_and_context_window.json .

The earlier research reported blocked access to Alibaba's public pages. That restriction was not reproduced in the 2 November documentation check below. At that documentation-check stage, account access and performance were unverified; the subsequent live check below now verifies one planner request and one generated image. Billing totals, representative performance and iPhone behavior remain unverified.

## Public documentation recheck on 2 November

- The [Qwen API reference](https://www.alibabacloud.com/help/en/model-studio/qwen-api-via-dashscope), updated **27 October 2026**, still names `qwen-plus` as a plain-text model for the Singapore workspace endpoint. Keep it as Mini's JSON planner.
- The [OpenAI-compatible Chat reference](https://www.alibabacloud.com/help/en/model-studio/compatibility-of-openai-with-dashscope), updated **13 October 2026**, documents the Singapore `/compatible-mode/v1` route used by the planner.
- The [Qwen-Image API reference](https://www.alibabacloud.com/help/en/model-studio/qwen-image-api), updated **22 October 2026**, uses `qwen-plus` as a chat model orchestrating a separate image tool. Its retrieved image-model table lists the 2.0 family; it does not establish this user's access to the non-Pro `qwen-image-3.0` ID.
- The [recommended-models page](https://www.alibabacloud.com/help/en/model-studio/models), updated **28 October 2026**, highlights `qwen-image-3.0-pro` for image generation. A general recommendation does not establish regional entitlement or a successful Mini request for another model ID.

The user reported `ALIBABA_VISUAL_MODEL=qwen-plus` and `ALIBABA_IMAGE_MODEL=qwen-image-3.0` in their private setup. The template now uses these selections as well. Neither the original documentation retrieval nor the template update made a paid API call. A subsequent authorized live check is recorded below. Do not claim that all 3.0 variants are confirmed for this account or silently change model/region after a failure.

## Live verification on 2 November

After the user supplied secure access to the running Windows deployment, its model metadata listed `qwen-image-3.0`. A subsequent real `qwen-plus` planner request returned a validated artwork plan in 1.73 s, and one real `qwen-image-3.0` request returned a 1024×1024 PNG in 6.57 s. The synthetic purple-kitten/yellow-ball subject was visible in the result. The test session grant was revoked; no private camera/child media was supplied. See [the live report and generated test image](LIVE_REVIEW_2026-11-02.md).

This confirms these configured models worked through that backend for those requests. No 3.0 Pro/fallback-model comparison, physical iPhone test, voice-transport success or representative latency/quality benchmark is implied.

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

Parent settings → **Troubleshooting → Connection and picture setup → Check image model setup · free** can inspect account metadata without making a picture request; a listed ID still does not prove generation entitlement. If 3.0 returns an access/model error, keep the diagnostic's exact stage, HTTP status and provider code. Correct access or explicitly configure an available alternative, then restart the Windows server to clear the persistent image-failure block. Never silently retry across models/regions. The original documentation research made no paid request. The separate authorized live integration check above made one planner and one image attempt successfully; future tests should remain deliberately bounded.
