# Mini — iPhone AI Companion (V6.4)

Mini is an experimental **voice-first English/Mandarin AI companion for a six-year-old**, running in iPhone Safari with Alibaba Model Studio Qwen Omni Realtime and a protected Windows/ngrok connection.

**Current version: V6.4 — Expressive Little Companion.** Previous versions put four Talk / Guess / Story / Show buttons on the screen. A child should not need to understand a menu: **V6.3 displays one animated Mini face, a short listening status, and a parent-start control**. The model can switch between chatting, stories, guessing games and describing toys when the child asks out loud.

### Current development updates

- **Qwen-directed visuals:** With **Let Qwen create visual scenes** enabled in Parent setup, completed spoken requests go to a separate Qwen planner. Try “Become a cat with starry whiskers”, “Show three apples”, “Play scissors, paper, stone”, or “Take our story to the moon”. Qwen composes faces and scenes from drawing primitives, text, emoji and preset motion; subjects are not a fixed asset list. Mini stays above the scene and **Back to Mini** restores the full face. Counting and game results use browser rules. Visual planning adds paid requests, including requests that decide to keep the current screen.
- **Optional generated artwork:** Newly generated illustrations use a separate image model, disabled until `ALIBABA_IMAGE_MODEL` is configured and a parent enables pictures for that session. Simple faces, objects and interactive games use the scene renderer without an image-generation call. See [dynamic visuals setup and limits](docs/dynamic-visuals.md). The integration has mock/API and Chromium coverage; live Qwen model access and iPhone behavior remain unverified here.
- **Shared visual activities:** During live chat, ask **“Let's play tic-tac-toe”**, **“play tic tik toe”**, or **“我们玩井字棋”**. Mini shrinks above a large board. The child is X and Mini is O; tap a square or say “top left”, “center”, “row two column three”, “左上角” or “中间”. Local rules validate both players' moves and highlight the winning line. The language model is instructed to acknowledge the game rather than invent placements or results. **Back to Mini**, “Let us chat”, or a request for a story restores the face. The live Stop control stays visible at the top during a board game.
- **Free tic-tac-toe:** **○ × Tic-tac-toe · free** opens the same board without microphone, camera or AI. Mini makes one local move after yours. Occupied squares, moves during Mini's turn and finished rounds reject further placements. **New round** cancels old pending moves. Voice controls still require an existing parent-started paid session, speech recognition and its normal usage charges. Board state is not saved. With dynamic visuals disabled, spoken tic-tac-toe requests still open the existing board locally.
- **More natural turns:** Mini's speaking face and first-audible-reply diagnostic follow actual local playback. Its listening cue waits for audio to drain. Detected child speech mutes old playback while keeping the microphone enabled; late events from an older response are ignored. Tapping during a Safari-spoken local prompt interrupts that prompt and restores the microphone. Live provider cancellation and iPhone timing still require device tests.
- **Guided stories and riddles:** Without dynamic visuals, Mini can track fixed cat/dragon, forest/castle and star/flower story choices plus a three-round animal game. With dynamic visuals, Qwen can compose other characters, settings and visual story choices. Instruction checkpoints are sent between turns without `response.create`; if the provider declines an optional checkpoint, normal voice chat remains available. Checkpoint context can still affect provider token usage.
- **Free local play:** Tap **Play a tap game · free**, watch Mini's smiles and copy them with two, three, then two face taps. No microphone, camera or AI request is used. The game stops when capture starts or Safari is hidden. Optional soft sounds are off by default.
- **Parent handoff:** Language, duration and camera choice come first. Advanced settings and diagnostics are underneath. **Remember these settings** saves only fixed non-sensitive options such as language, pace, activity interests and duration. Access codes, transcripts, recordings and camera-sharing choices are excluded. **Forget saved settings** leaves the separately controlled preference note alone. Camera sharing resets after Stop.
- Muting during startup keeps the microphone disabled when permission arrives and when media is attached. The free preview now includes the local microphone level meter.
- Direct commands such as **“Mini, stop talking now”**, **“Goodbye Mini”**, or **“Mini，别说了”** close the session and stop microphone/camera capture when a completed speech transcript is received. Mentions inside a story and “don't stop” are not stop commands. Recognition and network delay still matter; use the visible **Stop live chat** button to stop immediately without waiting for speech recognition.
- Adding five paid minutes requires entering the parent access code again. Authorization is checked by Mini's backend, shares the incorrect-code throttle, and does not call Alibaba. The dialog clears the entered code; closing it or stopping cancels a pending extension. The 60-minute maximum remains a browser-side limit, not a financial guarantee.
- If model audio playback is blocked, **Tap to hear Mini** appears beside the face. Parent setup can stay closed.
- Opening questions vary within a browser tab, without saving conversation history. The exact local opening is supplied in Qwen's instructions so a short first answer has context.
- **Offer gentle follow-up questions** controls both Qwen's optional prompts and Safari's fallback. With it off, Mini waits after answering, apart from questions needed for an explicitly requested activity. With it on, ordinary chat can still pause; a local fallback is reserved for an unfinished activity, and recognized story endings are left quiet.
- Story instructions ask Mini to carry choices into what happens next and allow a complete ending. A visible last-minute notice and a resting message make timed sessions less abrupt without generating extra paid turns.

These changes have automated coverage. Actual Qwen storytelling, recognition, and iPhone Safari audio still require supervised device testing.

> This public repository never needs your private API key or ngrok password committed. Keep `.env`, local policies and any child recordings out of Git.

## V6.4 — A cuter, more expressive Mini

The child screen still has **no game selection buttons**. The character now has a soft marshmallow-like lavender face, oversized glossy plum eyes, rosy cheeks, tiny ears, an antenna and a small smile that moves when Mini speaks.

- **Relaxing:** A gentle floating motion, occasional blinking and curious eye movements make the face feel alive even between replies.
- **Listening:** Eyes become attentive and the brows lift when your daughter speaks.
- **Thinking:** Eyes look upward and the mouth forms a small thoughtful circle.
- **Talking:** Mouth animates from Qwen's incoming audio signal (with a CSS fallback); it also moves when Safari speaks the local conversation starter or follow-up question.
- **Celebrating:** A positive Mini reply can trigger crescent eyes, a delighted smile, cheek blush and sparkles. Surprises widen the eyes, questions bring a curious head tilt, and reassuring words bring a softer expression.
- **Touching:** Taps cycle through delight, a wink, surprise and peekaboo. Tapping during a blocked Safari opening prompt still retries that prompt.
- **Resting:** Ending a session closes Mini's eyes and droops the antenna. Starting again wakes the face. Expressions remain distinguishable when reduced motion is enabled.

Mini reacts to **its own spoken words** and the existing conversation state; it does **not** infer or classify your daughter's facial expression or emotions. The redesign is implemented with local HTML/CSS and existing JavaScript, with no new third-party image assets, servers, tracking, API requests or changes to Qwen credentials. The dedicated stylesheet is `public/mini-face.css` and is explicitly served by `server.mjs`.

**For accessibility and iPhone battery life**, CSS motion is disabled when the device requests reduced motion. The face retains its existing keyboard/touch interactions. Please test Safari audio animation and appearance directly on your iPhone: automated tests validate code and structure but cannot verify the real visual result or audio hardware behaviour.

### Try V6.4 on Windows

Stop Mini, then run `git pull`, `npm test`, and `npm start` from your current `D:\Ai-projects\mini-iphone-ai-robot` folder. Refresh Safari's HTTPS ngrok page. You should see the new face immediately without signing into the paid Qwen session; the microphone and camera still require a grown-up to start them.

## V6.3 — One face and one ongoing conversation

The child simply speaks. There are **no child-facing activity buttons**, separate offline quizzes or game selection pages. For example:

- "Mini, tell me a story." / "Mini，讲故事！"
- "Let's guess some animals!" / "我们猜动物吧！"
- "Look at my toy." / "你看看我的玩具！"
- "Can we just talk?" / "我们聊聊天吧！"

Qwen is explicitly instructed to respond to these requests **within the ongoing conversation**, without asking the child to tap a control or announcing a mode change. It should answer briefly and, when follow-ups are enabled and useful, offer one relevant question before waiting. Short acknowledgements and completed stories can stand alone. Direct stop commands end capture when their completed transcript arrives.

When Model Studio supplies a speech transcript, Mini can update a session checkpoint. With dynamic visuals off, this uses fixed story choices and riddle counters. With visuals enabled, a separate paid Qwen planner receives the request and current scene; displayed scene summaries and local game results enter the voice session between turns. Checkpoint updates never send `response.create`. The separate planner is an additional paid request. Qwen may still make mistakes, and voice and visuals may arrive at different times. If transcripts are unavailable, voice chat continues without reliable visual requests. All activity state clears on Stop.

## How the conversation starts and continues

A **grown-up** opens Parent setup, enters the separate Mini access code and confirms a paid voice session. **The camera is unchecked by default**. Safari says one varied starter question, then Qwen listens for the child's answer with that question included in its instructions. If Safari does not play it, tapping Mini's face retries the local question.

Qwen is asked to acknowledge the child's answer and use a relevant question when it helps an ongoing activity. During an unfinished activity, with follow-ups enabled and a completed transcript available, Mini may ask one short Safari-synthesized follow-up after a pause. Ordinary chat and recognized story endings do not trigger that fallback. The backup voice is not as contextual as Qwen and may sound different. It is **not** another paid AI request and never loops or automatically reconnects. The parent may switch off *Offer gentle follow-up questions* to disable both optional model questions and local fallbacks.

For quiet voices, the default speech detector is acoustic `server_vad`, with **Quiet child** sensitivity. Fast/Balanced/Patient pause options remain. Short replies such as "yes", "dog", "cat", or "是的" should work without a wake word, subject to real microphone and provider behaviour.

**Troubleshooting audio:** Open **Parent setup → Microphone and AI hearing diagnostics** to see the local sound bar and Qwen speech-detection status. A moving bar means the iPhone is hearing sound; an AI speech-detected event means Qwen registered speech. If Qwen reports an error, its sanitized structured code becomes visible on the main Mini screen.

## Test V6.3 with your daughter

1. Stop the Windows Mini server; `git pull`, `npm test`, then `npm start` in `D:\Ai-projects\mini-iphone-ai-robot`. Keep your existing **password-protected ngrok tunnel** on port 3001.
2. Refresh the HTTPS Mini page in iPhone Safari. The **four buttons should be gone**. The face should still react to taps.
3. Open **Grown-up: Start Mini**, set the automatic stop to **5 minutes** for testing and keep **Quiet child** sensitivity. Leave the camera off at first.
4. Start the paid session and let your daughter speak naturally: "Mini, can we guess animals?" Mini should begin a riddle, respond to a one-word guess and ask another question without any button press.
5. Try "tell me a story" in the same live session, then ask it to switch back to chatting. Check whether the next response carries her choice forward.
6. If wanted, stop and explicitly enable camera sharing in Parent setup for a supervised "look at my toy" test. Mini must never claim to see an object when the camera is disabled.

**Safety and cost:** Parent setup is collapsed, not separately PIN-locked. A parent must enter the robot access code and confirm every paid session. Sessions have 5–60 minute browser-side timers; these are **not guaranteed financial spending caps**. Configure billing alerts in Model Studio, supervise a child during AI use and avoid personal identifying details. Mini does not persist transcripts, microphone recordings or camera video. A short optional parent-selected preference note is only saved locally if explicitly enabled.

**Verification:** The repository's tests simulate browser and model events; they cannot guarantee live iPhone Safari audio behaviour, provider turn-taking or that every model answer is suitable for a child. If the earlier local PowerShell patch was already run and `git pull` reports modified files, reconcile those local changes rather than force-resetting the project.

---

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

6. Open http://localhost:3001 on Windows (or your chosen `PORT`). The child home appears immediately. **Play a tap game · free** works without credentials or media capture. Open **Parent setup** to use the private code and start live AI; with no Qwen key, you can test the microphone and camera locally without AI charges. Live activities remain voice-led, without an activity-selection menu.

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
- **Conversational initiative:** Safari supplies one opening question after parent start. Qwen then responds to the child's spoken turns. There is no automatic provider request on a timer and no continuous visual scanning.
- **iOS limits:** A webpage cannot reliably keep capturing mic/video with the screen locked or when Safari is backgrounded. For longer unattended use, consider a dedicated powered device or a native iOS app, subject to iOS capture restrictions.

## Privacy, safety and cost

- Pay-as-you-go **API charges are incurred** during real sessions; Token Plan subscriptions do not offset these charges.
- Qwen may bill current audio/video plus retained history across many turns; costs are not equal to a fixed number of cents per minute. Monitor the Alibaba Cloud console.
- Use 1 fps for lower camera bandwidth/cost; start with one **5-minute test session**. Longer duration is opt-in, and an hourly browser-side safety timer is not a financial limit.
- The server proxies only the setup SDP, not the voice/video data. Video and voice go directly to Alibaba over WebRTC; do not stream private material or record children without appropriate consent.
- Access protection uses a private Mini access code and an HTTPS gateway. In the working iPhone setup, ngrok HTTP Basic Auth runs in front of Mini; Cloudflare's email-protected Quick Tunnel had issues with 401 responses. This is a **hobby prototype**, not production-grade auth or budget enforcement. Browser-side timers are best-effort. Keep the server/tunnel closed when you are done.
- Disable any camera-sharing option if you want voice-only mode. Pausing visual sharing does not turn off the local camera; press Stop for that.
- If your iPhone version displays frozen/black camera imagery in the model, try voice-only first, then update iOS/Safari and consider a native iOS client. `canvas.captureStream()` on some older iOS WebKit builds has had bugs.

## Tests

Run `npm test` to verify static serving, config secrecy, credentials checks, rate limits, mocked WebRTC SDP proxy, JavaScript syntax, session option clamping, VAD pacing, language/personality prompts and browser-local preference storage. Tests **do not call Alibaba**, and do not independently verify iPhone audio playback, audio-meter animation or provider latency.

The suite also covers delayed playback completion, old response events after interruption, bilingual story choices, riddle progression, safe saved settings, and local play with no media/network APIs. See [the companion benchmark guide](docs/companion-benchmark.md) for repeatable device scenarios and measurement definitions. Competitor scores and live iPhone/Qwen results have not been measured here.

## Troubleshooting

### Daughter answers Mini, but Mini doesn't reply

V5's offline games disconnected the model. V6.3 no longer has those buttons. If Mini does not answer, check **both** the microphone and Qwen detection inside Parent setup → Microphone and AI hearing diagnostics.

| Observation | Meaning and action |
|---|---|
| Mic bar stays flat | Safari may not have working microphone permission or the mic is muted; stop/restart and check permissions |
| Mic bar moves, but AI speech detection does not | Qwen did not detect the short turn; use Quiet child, move the phone closer, reduce noise |
| Qwen transcribes the answer, but remains silent | Speech is reaching Qwen; check response events, AI session state, playback or errors |
| Mini opens a question with Safari's different voice | Qwen did not start a spontaneous turn; the single local fallback prompt should be followed by a live Qwen reply after the child answers |

The conversational session stays active until someone presses Stop, a direct spoken stop command is recognized, or its timer expires. No transcript is saved by Mini.

### Safari SDP HTTP 401 behind a protected Cloudflare Quick Tunnel

On the iPhone, complete the Cloudflare email PIN sign-in, then open Mini. Tap **Test tunnel POST (free)** before pressing Start. This sends a small POST request of the same content type as the WebRTC setup, but **does not call Alibaba or charge for AI**. Repeat the test after 10 seconds.

- **POST reached Mini successfully:** The origin was reachable at that moment. If a later test returns 401, the Cloudflare authentication session may have expired.
- **POST blocked: HTTP 401:** Mini's test endpoint does not require the robot code; the 401 is coming from the tunnel or another gateway. A [reported protected Quick Tunnel bug](https://github.com/cloudflare/cloudflared/issues/1752) matches this pattern. Use ngrok with a restrictive Google-login or password policy as a Safari-only workaround.
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
| Stops when switching apps | Deliberate privacy/cost behavior in V6.3. |
| Need to resume | Tap Start again to establish a fresh realtime session; previous conversation context is not persisted. |
