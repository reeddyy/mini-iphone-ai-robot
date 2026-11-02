# Recover Mini after a lost chat or cloud workspace

The durable source of development context is **GitHub `main`**, including [PROJECT_STATE.md](PROJECT_STATE.md) and [AGENTS.md](../AGENTS.md). A ChatGPT local-chat URL, cloud filesystem or `/tmp` screenshot may no longer be accessible. These documents preserve decisions and next steps; they do not restore the original chat transcript or private credentials.

Latest accepted behavior: **Tina is the only live-session voice**. Local openings, games, checked lessons and invitations appear on screen, as the user explicitly chose. Earlier device-narration notes are historical. Head tracking now calibrates neutral and recovers local stalls without reconnecting voice. Read [the 3 November handoff](HEAD_AND_SINGLE_VOICE_2026-11-03.md) before changing either path.

## Continue in a new coding session

Give the new session access to https://github.com/reeddyy/mini-iphone-ai-robot and this instruction:

> Continue work on Mini from the latest GitHub main. Read AGENTS.md, docs/PROJECT_STATE.md and docs/RECOVERY.md first. Summarize the recorded state and remaining checks before changing behavior. Preserve the minimal default-on grown-up settings and parent Start confirmation. Use mocked providers for automated checks; do not make paid calls just to restore context.

For a fresh cloud workspace:

```sh
git clone https://github.com/reeddyy/mini-iphone-ai-robot.git
cd mini-iphone-ai-robot
git log -5 --oneline
git status --short
node --version
npm test
```

Node.js **22+** is required. There are no external npm dependencies or build step, so no `npm install` is needed. The tests do not require `.env` or real AI credentials. If the workspace already contains a checkout, inspect its branch and local changes before pulling. Preserve edits; do not force-reset them to match this guide.

On 2 November 2026, a clean local clone of application/configuration baseline `6c07960` passed all 194 tests without installation. The preview-configuration procedure below also parsed successfully with blank API credentials. This verifies the local recovery steps; private Windows credentials and physical iPhone checks remain separate.

To run a free local preview in a fresh cloud checkout, create an ignored configuration only if one does not already exist:

```sh
node --input-type=module <<'JS'
import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
if (!existsSync('.env')) {
  const template = readFileSync('.env.example', 'utf8')
    .replace(/^ROBOT_ACCESS_CODE=.*$/m, 'ROBOT_ACCESS_CODE=' + randomBytes(24).toString('hex'))
    .replace(/^PORT=.*$/m, 'PORT=3001');
  writeFileSync('.env', template, {mode:0o600, flag:'wx'});
  console.log('Created ignored free-preview configuration; no API credentials supplied.');
} else {
  console.log('Preserved existing .env.');
}
JS
npm start
```

This generates a local preview access code without printing it; it is not the user's Windows parent code. Keep API credential fields blank for this preview. A fresh managed environment needs its own current network/authentication setup; do not reuse an old environment ID or claim old credentials are still ready. Use its runtime guidance before remote operations.

For browser checks, follow [companion-benchmark.md](companion-benchmark.md). The local fixture supplies mocked Qwen responses without loading `.env`. Use a fresh temporary Chromium profile, synthetic media and a fresh fixture process as documented. Shut down those test processes afterwards.

## Update the existing Windows installation

The known installation path was `D:\Ai-projects\mini-iphone-ai-robot`; use the actual existing folder if different. Stop Mini with Ctrl+C, then:

```powershell
cd D:\Ai-projects\mini-iphone-ai-robot
git status --short
git pull --ff-only
npm test
npm start
```

If Git reports local changes or a divergent branch, preserve and reconcile them before updating. Do not replace the existing `.env` with `.env.example`. Keep the protected ngrok tunnel targeting the actual `PORT`, and refresh Safari after restarting Mini.

The template and server default to **3000**; this user's earlier Windows/cloud-preview setup used **3001**. The localhost URL, ngrok target and `.env` port must agree. A port conflict is a reason to choose an unused port or identify the old process, not to overwrite credentials.

Current model selections are:

```dotenv
ALIBABA_VISUAL_MODEL=qwen-plus
ALIBABA_IMAGE_MODEL=qwen-image-3.0
ALIBABA_IMAGE_ENDPOINT=singapore
```

Updating Git changes the example, not the private configuration. Model selection and model-ID metadata do not verify account-specific generation access. Details and evidence are in [image-model-research.md](image-model-research.md).

## What needs a separate private backup

GitHub restores source, vendored model assets, tests, public examples and these handoff notes. It intentionally does not restore:

- The Windows `.env`: actual API key, workspace ID, parent access code and local port choices.
- Actual ngrok authtoken, local restricted traffic-policy files, tunnel passwords or other private access configuration.
- Unsaved local edits, browser-only preferences, running sessions or temporary cloud files.

Keep any required configuration backup in private storage under the user's control, outside this public repository. Do not paste credentials into chat, issues or the handoff. If credentials are lost, recover or rotate them through the appropriate account rather than guessing from examples. Existing Windows files are not deleted by losing this cloud session.

## Before ending another session

1. Update PROJECT_STATE.md and the affected feature/setup docs with the actual decisions, code/config commits, validation and remaining checks.
2. Check `git status --short` and `git diff --check`. Stage only intended source/docs; exclude secrets and recordings.
3. Commit the handoff. When publication is authorized, fetch/check the current remote and push to the intended branch without force. If a remote update conflicts, preserve both changes and reconcile them.
4. Verify the pushed commit with `git ls-remote origin refs/heads/main` and report the commit/link. State plainly if any work remains only local.

Do not rely on another session automatically having the old chat. The root agent instructions and README link make the repository handoff discoverable after a fresh clone.
