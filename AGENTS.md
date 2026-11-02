# Working on Mini

## Read first

Read [docs/PROJECT_STATE.md](docs/PROJECT_STATE.md) before changing the project. It is the repository's durable development memory: current decisions, shipped commits, validation and unresolved work. Use [docs/RECOVERY.md](docs/RECOVERY.md) when a chat or cloud workspace has been lost. Then read README.md and the documentation relevant to the task.

Repository files and Git history provide continuity; an earlier ChatGPT local-chat link may be inaccessible. Do not claim to remember or have inspected an unavailable conversation. Current user instructions take precedence over recorded preferences.

## Current product decisions

- Keep grown-up settings minimal: access code, language, session length, camera and pictures. Put technical controls under Troubleshooting.
- Available features default on, including camera and pictures. Preserve parent Start confirmation before media capture or paid usage; nothing starts on page load.
- Use a playful personality and follow the child. Removed personality, topic, preference-note and separate feature switches should not return without a new requirement.
- Keep Mini bilingual, proactive, positive, fun and educational. Preserve topic-aware invitations and checked maths/science mini-lessons in English/Mandarin, while respecting quiet, skipping and child-led topic changes. Local prompts must not depend on the paid image planner or create extra generated voice turns.
- Project memory is documentation for developers. It does not mean saving a child's conversations, recordings or identity information.

## Development

- Node.js 22+; plain browser JavaScript and a Node HTTP server. There are no external npm dependencies or build step.
- Use `npm test` for relevant application changes. Browser fixture commands and their limits are in docs/companion-benchmark.md.
- Use local fixtures for automated provider tests. Do not make paid Qwen calls just to validate documentation, settings or model names.
- Keep planner, image-generation and realtime-voice models separate. Public model documentation or metadata does not establish account-specific access.
- Never commit or copy private `.env` values, access codes, tunnel credentials, recordings or transcripts into handoff documents. `.env.example` contains public examples only.
- Preserve existing Windows configuration and local edits. Do not force-reset, force-push or overwrite private configuration to make an update work.

## Before handing off

Update docs/PROJECT_STATE.md and affected user documentation when decisions or behavior change. Record what actually passed, what was mocked, what remains unverified, relevant commits and the next concrete step. Check links and `git diff --check`. When publishing is authorized, push the handoff too and verify the remote; files left only in the cloud workspace or `/tmp` are not a recovery backup.
