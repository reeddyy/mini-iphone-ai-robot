# Security notes

This is a personal prototype, **not a production-hardened service**.

- This repository is **public**: anyone can read and copy its source. Never rely on code or repository visibility to keep credentials private. Store secrets only in your local, Git-ignored `.env` file.
- Never commit `.env`, `.env.*`, Alibaba API keys, access codes, cloud credentials, or recordings. `.env.example` contains only placeholders.
- Run the robot server on `127.0.0.1`; use a restricted HTTPS tunnel for iPhone access. Do not port-forward Mini directly to the internet. For ngrok, require Google OAuth restricted to your own email address (`ngrok-policy.example.yml`) or Basic Auth with a unique, strong password (`ngrok-password-policy.example.yml`). Keep both local policy files out of Git.
- Rotate any API key or access code immediately if exposed, even in a private commit. Removing it from the latest file does not remove it from Git history.
- The access code, short sessions and session-count throttle are lightweight protections, **not a guaranteed spend cap**. Set quotas and alerts at your provider if possible.
- The continuous camera/microphone feed goes to the AI provider while a session is running. Ask permission before filming/recording others and avoid filming children by default.
- **Mini V6 child mode:** The child-facing buttons update an already-active paid Qwen session rather than launching an unrelated offline game. A grown-up must enter the private robot access code and confirm each new AI session; the code is cleared after successful authorization. Parent settings are collapsed, **not PIN-protected**, and camera sharing starts **off**.
- **Child safety:** Qwen can still produce mistakes or inappropriate content despite the age-appropriate instructions. This prototype is **not certified as child-safe** and must not replace active adult supervision. Keep sensitive personal details and children's faces out of the camera.
- **Live activities:** Talk, Guess, Story and Show rely on the existing Qwen session and may incur paid model tokens. Buttons alone do not create an additional WebRTC session or disable audio. If Qwen cannot initiate an opening question, Safari speech synthesis speaks one short fallback cue; Mini temporarily disables its outgoing microphone for that cue, then restores it. The model still handles the child's spoken reply.
- **Voice diagnostics:** The optional local sound meter never records, stores or transmits sound amplitude data. The speech-detected state is from Qwen, which processes the live audio whenever a session is active. A lower acoustic VAD threshold can also pick up unwanted background voices.

- `.github/workflows/ci.yml` runs mock/server tests only: it does not access Alibaba, call external AI models or need secrets.

For bugs and security issues in a repository you later publish, avoid including real credentials or private logs in GitHub issues.
