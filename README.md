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

Safari camera and microphone capture require a **secure HTTPS origin**. You can use **Safari alone** on an iPhone, with no iOS app installation. Keep Mini running at `http://localhost:3001` on Windows and use an HTTPS tunnel from your PC.

### Recommended for Safari-only iPhone: ngrok + Google sign-in

This option needs an ngrok account and the ngrok agent **only on Windows**. The iPhone uses Safari; no iPhone app, VPN, or Cloudflare Quick Tunnel email PIN is required.

1. On Windows, install [ngrok](https://ngrok.com/download/windows) and create/sign in to your [ngrok account](https://dashboard.ngrok.com/). One installation option is:

```powershell
winget install ngrok -s msstore
```

2. Copy your account's ngrok **authtoken** from the dashboard and add it locally. Replace the placeholder; never publish the actual token or paste it into chat:

```powershell
ngrok config add-authtoken "PASTE_YOUR_NGROK_AUTHTOKEN_HERE"
```

3. In the existing Mini project folder, create a **local, Git-ignored** traffic policy and open it in Notepad:

```powershell
Copy-Item ngrok-policy.example.yml ngrok-policy.yml
notepad ngrok-policy.yml
```

Replace `your-google-account@example.com` with the **exact email address of your own Google account**, then save. This example requires Google OAuth and **denies any other signed-in email**. Simply enabling Google OAuth without this restriction would allow all Google accounts. Do not commit your `ngrok-policy.yml`.

4. Keep `npm start` running in one PowerShell window (with `PORT=3001`). In **another** PowerShell window in the Mini project folder, start the protected tunnel:

```powershell
ngrok http 3001 --traffic-policy-file .\ngrok-policy.yml
```

5. Open the **HTTPS Forwarding URL printed by ngrok** in Safari on your iPhone 12 Pro. The free plan may show an initial browser warning—continue only if this is the URL you just created. Sign in with the approved Google account, then enter Mini's separate `ROBOT_ACCESS_CODE`. Tap **Test tunnel POST (free)** twice, then try **Start live Mini** if both tests succeed.

Your free ngrok account gets an assigned development domain, with request and bandwidth limits. Ngrok provides HTTPS but the URL is otherwise internet-reachable: **keep gateway authentication enabled (Google OAuth with an exact-email restriction, or Basic Auth)**, use a separate private robot access code, and stop ngrok when not testing. Do not use an unprotected public endpoint for live camera/audio access.

References: [ngrok Windows install](https://ngrok.com/download/windows) · [ngrok OAuth & traffic policy](https://ngrok.com/docs/share-localhost/auth) · [ngrok free plan limits](https://ngrok.com/docs/pricing-limits/free-plan-limits)

### Alternative ngrok login: password instead of Google

If you reach the ngrok Google login but cannot complete it, you can use **HTTP Basic Authentication** instead—still over HTTPS and still using only Safari on the iPhone. This is a separate, local password; the public repository contains only a placeholder. Ngrok supports this as a Traffic Policy action.

```powershell
cd D:\Ai-projects\mini-iphone-ai-robot
git pull
Copy-Item ngrok-password-policy.example.yml ngrok-password-policy.yml
notepad ngrok-password-policy.yml
```

In Notepad, replace `CHANGE-TO-A-STRONG-UNIQUE-PASSWORD-AT-LEAST-20-CHARACTERS` with a **new unique password of at least 20 characters**. The username is `mini`. The sample policy blocks anonymous connections. Keep this local file private; it is Git-ignored.

To generate a random password on Windows (save it in your own password manager):

```powershell
node -e "console.log(require('crypto').randomBytes(20).toString('hex'))"
```

After saving, stop the previous ngrok tunnel with Ctrl+C, leave `npm start` running on port 3001, and run:

```powershell
ngrok http 3001 --traffic-policy-file .\ngrok-password-policy.yml
```

In Safari, open the ngrok HTTPS URL and sign in when the **browser's username/password prompt** appears, using `mini` and your new tunnel password. This is **not** your ngrok account password and **not** Mini's `ROBOT_ACCESS_CODE`. Enter the robot access code later, inside Mini, and tap **Test tunnel POST (free)** before starting any chargeable AI session.

If Google sign-in fails with a `403` page after choosing an account, compare the email written in local `ngrok-policy.yml` against the identity used in Safari. If Google itself reports `400`, `redirect_uri_mismatch`, or `access_denied`, report the exact displayed error rather than changing any Mini or Alibaba credentials.

Never run ngrok without either your configured Google restriction or Basic Auth; do not paste your passwords into chat or commit local policy files. This is suitable for prototype testing, not a production security design.

### Alternative: Tailscale Serve (requires an iPhone VPN app)

[Tailscale Serve](https://tailscale.com/docs/features/tailscale-serve) supplies an HTTPS URL reachable **only within your private tailnet**. It does not expose Mini publicly and avoids Cloudflare Quick Tunnel email-session issues.

1. Install [Tailscale on Windows](https://tailscale.com/download/windows) and [Tailscale on iOS](https://tailscale.com/download/ios), sign in on both with the same Tailscale account, and ensure the iPhone's VPN connection is on.
2. Keep Mini running on Windows: `npm start` (for this example, `PORT=3001` in `.env`).
3. Open a second PowerShell window on Windows:

```powershell
tailscale serve 3001
```

4. Follow any prompt to enable HTTPS for the tailnet. Tailscale displays a URL such as `https://your-pc.your-tailnet.ts.net`. Open **the exact URL displayed** in iPhone Safari. Tailscale must remain connected on both devices.
5. Enter Mini's private `ROBOT_ACCESS_CODE`, select the camera settings and tap **Start live Mini**.

Keep the Serve terminal open for testing; use Ctrl+C to stop. Do **not** use `tailscale funnel`—that publishes your service on the internet.

### Alternative: email-protected Cloudflare Quick Tunnel

Install `cloudflared`, then start a protected tunnel from a **second** PowerShell window (replace the email with yours and use your local Mini port):

```powershell
winget install -e --id Cloudflare.cloudflared
cloudflared tunnel --url http://localhost:3001 --allowed-mail you@example.com
```

Close/reopen PowerShell after installation if `cloudflared` is not recognized. Open the displayed `https://....trycloudflare.com` URL in iPhone Safari, complete the email PIN challenge, and enter Mini's separate private access code.

**Known Cloudflare issue (October 2026):** Some `--allowed-mail` Quick Tunnel sessions expire shortly after sign-in; subsequent POST requests return a **plain HTTP 401**, including Mini's `/api/realtime/sdp` request. This matches [cloudflare/cloudflared issue #1752](https://github.com/cloudflare/cloudflared/issues/1752). If localhost works but Safari reports a generic SDP HTTP 401 behind the email-protected tunnel, use **ngrok with Google OAuth** instead (no iPhone app needed). **Do not disable email protection to bypass the problem** on a public URL.

With a working HTTPS method, say: **"Hello Mini, what can you see in front of you?"** and try **"你好 Mini，你看到什么？"**. If Safari refuses to play the model's voice, tap **Enable speaker audio** and raise the iPhone volume. Keep Safari open and the screen awake; backgrounding Safari intentionally stops the session.

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

### Safari SDP HTTP 401 behind a protected Cloudflare Quick Tunnel

On the iPhone, complete the Cloudflare email PIN sign-in, then open Mini. Tap **Test tunnel POST (free)** before pressing Start. This sends a small POST request of the same content type as the WebRTC setup, but **does not call Alibaba or charge for AI**. Repeat the test after 10 seconds.

- **POST reached Mini successfully:** The origin was reachable at that moment. If a later test returns 401, the Cloudflare authentication session may have expired.
- **POST blocked: HTTP 401:** Mini's test endpoint does not require the robot code; the 401 is coming from the tunnel or another gateway. A [reported protected Quick Tunnel bug](https://github.com/cloudflare/cloudflared/issues/1752) matches this pattern. Use Tailscale Serve as the preferred workaround.
- **POST succeeds repeatedly but the real SDP still fails:** Verify the robot's private access code and check Windows logs. A Model Studio 401 appears as a backend 502; a wrong Mini code appears as a JSON 401.

Do not disable Cloudflare protection on a public URL as a workaround.

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
| Authentication 401 from Mini | Check `ROBOT_ACCESS_CODE` in `.env` and the code entered in Safari; restart Mini after editing `.env`. A **generic non-JSON SDP HTTP 401** may be caused by the [Cloudflare `--allowed-mail` session-expiration bug](https://github.com/cloudflare/cloudflared/issues/1752); if localhost works, try ngrok with Google OAuth and an exact-email allowlist. |
| Server rejects Token Plan | Expected; custom robot app must use pay-as-you-go. |
| Model Studio 403 / 404 | Check Workspace ID, Singapore key, permissions and availability of realtime model. |
| No camera | Use HTTPS, foreground Safari, allow permissions. Try front camera first. |
| Model silent | Tap the audio player's play control or **Enable speaker audio**. Lower output speaker volume to reduce echo. |
| SDP negotiation error | Ensure Node >=22, Safari updated, selected model supports WebRTC and workspaces/region match. |
| Camera preview OK but model cannot see | Stop, select **Direct camera · Safari compatibility**, then restart; you can also try 2 fps. |
| Stops when switching apps | Deliberate privacy/cost behavior in V3. |
| Need to resume | Tap Start again to establish a fresh realtime session; previous conversation context is not persisted. |