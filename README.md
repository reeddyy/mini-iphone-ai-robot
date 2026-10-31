# Mini — iPhone AI Robot

An experimental **iPhone 12 Pro robot companion** with continuous microphone
input, camera vision and spoken AI replies powered by Alibaba Qwen Omni Realtime.

**Current version:** V3 (experimental). This repo has been structured for GitHub,
but real iPhone/Qwen streaming still requires testing with a compatible Model
Studio pay-as-you-go API key. The existing Alibaba Token Plan should not be used
as the backend of a standalone robot app.

**Quick links:** [Windows setup](#1-local-setup-on-windows) ·
[Security notes](SECURITY.md) · [Automated tests](#tests).

> Keep API keys in a local `.env` file; `.env` is ignored by Git.
> This repository is **public**. Never commit API keys, `.env` files, access codes, or private recordings.

---

## V3 — Live audio + continuous camera vision (iPhone Safari)

**Status:** Implementation starter; server proxy is unit-tested. Real model audio/video must still be tested on your iPhone with your own Alibaba Model Studio pay-as-you-go credentials. No real API key or credit has been used to test this project.

Based on Alibaba Cloud's official WebRTC best practices for `qwen3.8-omni-flash-realtime`. The model accepts streaming microphone audio + video frames and outputs spoken audio. The phone runs the camera, microphone, UI and speaker; a Windows PC only hosts the secure SDP-exchange proxy. The phone's WebRTC streams go directly to Alibaba after connection establishment.

Official references:
- [Alibaba: Qwen-Omni-Realtime](https://help.aliyun.com/en/model-studio/realtime)
- [Alibaba: Browser WebRTC real-time audio/video guide](https://help.aliyun.com/en/model-studio/best-practice-webrtc-omni-realtime)
- [Alibaba: WebRTC connection sequence and session.updated gating](https://help.aliyun.com/en/model-studio/realtime-webrtc-access)
- [Alibaba: Token Plan scope restrictions](https://help.aliyun.com/en/model-studio/more-tools)

## Features

- One WebRTC session for **continuous microphone audio**, **continuous video input** (1 fps by default, optional 2 fps), and **streaming model voice replies**.
- Qwen `semantic_vad` detects speech pauses automatically; **no push-to-talk**.
- Front or rear camera selectable **before** starting. The front camera sees the user facing the screen; rear sees objects on the other side.
- Local camera preview at 20–30 fps; outgoing video is downsampled via `canvas.captureStream(fps)`. If canvas streaming is unavailable, fall back to the original camera track with a requested lower FPS. You can also select **Direct camera · Safari compatibility** before pressing Start.
- Live speech subtitles when the model emits text/transcription events.
- Mute microphone; pause video transmission (local preview remains on); stop everything.
- Automatic stop after **5 minutes by default**, adjustable to 10 or 15 minutes; also stops when the page exits or Safari becomes hidden.
- No media recording or log of transcripts on disk. No persistence of API key in the browser.
- **No-key local preview** mode for free camera/microphone testing; NOT an AI conversation.

## 1. Local setup on Windows

The repository is **public**. You can clone and pull the source code **without a GitHub login**. GitHub authentication is needed only if you want to push changes to the repository.

1. Install [Git for Windows](https://git-scm.com/downloads/win) and [Node.js 22+](https://nodejs.org/). Open PowerShell and optionally verify the installations with `git --version` and `node --version`.
2. Clone the repository once and enter the project folder:

```powershell
git clone https://github.com/reeddyy/mini-iphone-ai-robot.git
cd mini-iphone-ai-robot
```

3. Create a **local** configuration file, which is excluded from Git by `.gitignore`:

```powershell
Copy-Item .env.example .env
notepad .env
```

4. Set `ROBOT_ACCESS_CODE` to your own **secret 10+ character value**. For a free local preview, leave `ALIBABA_API_KEY` and `ALIBABA_WORKSPACE_ID` blank.
5. Start the app:

```powershell
npm start
```

6. Open http://localhost:3000 on the Windows computer. Use the private access code and press **Test local camera and mic**. Browser may request camera/mic access. **This mode has no AI and no usage charges.**

### Getting future updates

No new ZIP download or clone is required. Stop the app with Ctrl+C, open PowerShell inside your existing project folder and run:

```powershell
git pull
npm start
```

Pulling public updates does not need authentication. Keep your `.env` file on your own machine; **never push it or post credentials in issues**. If you have edited tracked source files locally, commit or set aside those edits before pulling.

## 2. Enable live Qwen audio + vision

Use a **Singapore Model Studio pay-as-you-go key** plus the **matching Workspace ID**. The Token Plan subscription endpoint/key is **not permitted for custom application backends** under Alibaba's current terms. It also uses the wrong API protocol for live browser WebRTC. You can use Token Plan interactively in approved programming/agent tools to develop prompts, not as a direct robot backend.

In `.env`:

```dotenv
ROBOT_ACCESS_CODE=your-long-private-code
ALIBABA_API_KEY=sk-your-modelstudio-payg-key
ALIBABA_WORKSPACE_ID=your-singapore-workspace-id
PORT=3000
```

**Do not include** `https://` or a hostname in the Workspace ID. Stop Node using Ctrl+C and run `npm start` again. The backend will construct the official endpoint:

`https://{WorkspaceId}.ap-southeast-1.maas.aliyuncs.com/api/v1/webrtc/realtime?model=qwen3.8-omni-flash-realtime`

The client sends an SDP offer to your own Node backend, the backend forwards it to Alibaba with your secret API key, and returns the SDP answer. The browser's WebRTC session then carries microphone, video and AI spoken audio streams. It does **not** send every frame through Node.

## 3. Open the live robot on iPhone 12 Pro

Safari microphone and camera permissions require a secure context. Open a **second** PowerShell window:

```powershell
winget install -e --id Cloudflare.cloudflared
```

Close/reopen PowerShell after installation if needed. Then start a **protected** temporary HTTPS tunnel (replace with your own email):

```powershell
cloudflared tunnel --url http://localhost:3000 --allowed-mail you@example.com
```

Use the printed `https://....trycloudflare.com` address in **iPhone Safari**. Complete the one-time email verification, enter your robot access code, and select front/rear camera, 1 fps, and a 5 minute limit. Tap **Start live Mini**, then grant microphone/camera permissions.

Say: **“Hello Mini, what can you see in front of you?”**, and try the same question in Chinese: **“你好 Mini，你看到什么？”**

If Safari initially refuses to play the model's voice, tap **Enable speaker audio**, then raise your iPhone volume. Keep the screen awake and Safari foregrounded. If you put Safari in the background, the app intentionally stops the session.

Cloudflare documents the protected `--allowed-mail` Quick Tunnel option: https://developers.cloudflare.com/changelog/post/2026-10-02-protected-quick-tunnels/.

## What is / is not continuous

- **Live audio:** Continuous microphone track during the session; server VAD detects the end of each speech turn and automatically triggers a response.
- **Live visual input:** Camera video is sent to Qwen at 1–2 fps while video is enabled. **It does not generate a new AI reply every second.** It uses the frames to provide context when someone speaks.
- **Proactive observation:** Not implemented in V3; it would require an additional change-detection/trigger loop or AI function logic and may cause higher usage.
- **iOS limits:** A webpage cannot reliably keep capturing mic/video with the screen locked or when Safari is backgrounded. For longer unattended use, consider a dedicated powered device or a native iOS app, subject to iOS capture restrictions.

## Privacy, safety and cost

- Pay-as-you-go **API charges are incurred** during real sessions; Token Plan subscriptions do not offset these charges.
- Qwen may bill current audio/video plus retained history across many turns; costs are not equal to a fixed number of cents per minute. Monitor the Alibaba Cloud console.
- Use 1 fps with video aggregation for lower costs; for a first test start with **one 5-minute session**.
- The server proxies only the setup SDP, not the voice/video data. Video and voice go directly to Alibaba over WebRTC; do not stream private material or record children without appropriate consent.
- Access protection uses a private access code and Cloudflare's email-protected tunnel. The project is a **hobby prototype**, not production-grade auth or budget enforcement. Browser-side timers are best-effort. Keep the server/tunnel closed when you are done.
- Disable any camera-sharing option if you want voice-only mode. Pausing visual sharing does not turn off the local camera; press Stop for that.
- If your iPhone version displays frozen/black camera imagery in the model, try voice-only first, then update iOS/Safari and consider a native iOS client. `canvas.captureStream()` on some older iOS WebKit builds has had bugs.

## Tests

Run `npm test` to verify static serving, config secrecy, credentials checks, rate limits and the mocked WebRTC SDP proxy. Tests **do not call Alibaba** and do not confirm real iPhone compatibility; that requires real credentials and a device.

## Troubleshooting

### Windows: port already in use (`EADDRINUSE`)

If `npm start` reports `listen EADDRINUSE: address already in use 127.0.0.1:3000`, another app is already using port 3000. This is **not** an npm version problem.

**Easiest fix:** Run `notepad .env`, change `PORT=3000` to `PORT=3001`, save the file, run `npm start` again and visit http://localhost:3001. If port 3001 is also occupied, choose another unused port. If using a Cloudflare HTTPS tunnel for iPhone Safari, change its target too: `cloudflared tunnel --url http://localhost:3001` (retain any separate access-protection settings).

**Alternative:** Find the program listening on port 3000 with:

```powershell
Get-NetTCPConnection -LocalPort 3000 -State Listen | Select-Object LocalAddress,LocalPort,OwningProcess
```

Use `Get-Process -Id <PID>` (replace `<PID>` with the displayed OwningProcess number) to identify it. Only if it is an old Mini process you want to close, stop it with `Stop-Process -Id <PID>`. Otherwise, leave it running and change Mini's port.

Node.js v22.13.0 and npm 10.9.2 are sufficient for this project. You do **not** need to upgrade to npm 12, which requires a newer Node.js version.

| Symptom | Next step |
|---|---|
| LOCAL PREVIEW ONLY | Set both `.env` pay-as-you-go variables and restart Node. |
| Authentication 401 | Check the private `ROBOT_ACCESS_CODE`. |
| Server rejects Token Plan | Expected; custom robot app must use pay-as-you-go. |
| Model Studio 403 / 404 | Check Workspace ID, Singapore key, permissions and availability of realtime model. |
| No camera | Use HTTPS, foreground Safari, allow permissions. Try front camera first. |
| Model silent | Tap the audio player's play control or **Enable speaker audio**. Lower output speaker volume to reduce echo. |
| SDP negotiation error | Ensure Node >=22, Safari updated, selected model supports WebRTC and workspaces/region match. |
| Camera preview OK but model cannot see | Stop, select **Direct camera · Safari compatibility**, then restart; you can also try 2 fps. |
| Stops when switching apps | Deliberate privacy/cost behavior in V3. |
| Need to resume | Tap Start again to establish a fresh realtime session; previous conversation context is not persisted. |