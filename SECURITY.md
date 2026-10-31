# Security notes

This is a personal prototype, **not a production-hardened service**.

- This repository is **public**: anyone can read and copy its source. Never rely on code or repository visibility to keep credentials private. Store secrets only in your local, Git-ignored `.env` file.
- Never commit `.env`, `.env.*`, Alibaba API keys, access codes, cloud credentials, or recordings. `.env.example` contains only placeholders.
- Run the robot server on `127.0.0.1`; use a restricted HTTPS tunnel for iPhone access. Do not port-forward Mini directly to the internet. For ngrok, require Google OAuth restricted to your own email address (`ngrok-policy.example.yml`) or Basic Auth with a unique, strong password (`ngrok-password-policy.example.yml`). Keep both local policy files out of Git.
- Rotate any API key or access code immediately if exposed, even in a private commit. Removing it from the latest file does not remove it from Git history.
- The access code, short sessions and session-count throttle are lightweight protections, **not a guaranteed spend cap**. Set quotas and alerts at your provider if possible.
- The continuous camera/microphone feed goes to the AI provider while a session is running. Ask permission before filming/recording others and avoid filming children by default.
- **Mini V6.3 child mode:** The child screen has no activity menu; Qwen interprets ordinary spoken requests within one ongoing session. A grown-up must enter the private robot access code and confirm every new paid AI session; the code is cleared after successful authorization. Parent controls are collapsed, **not PIN-protected**, and camera sharing starts **off**.
- **Child safety:** Qwen can still produce mistakes or inappropriate content despite the age-appropriate instructions. This prototype is **not certified as child-safe** and must not replace active adult supervision. Keep sensitive personal details and children's faces out of the camera.
- **Live conversation:** Spoken requests for stories, guessing games, toy questions and chatting use the existing paid Qwen session. No activity buttons or background auto-start are present. Safari speech synthesis supplies one brief local starter after parent connection and may provide one follow-up; Mini temporarily disables its outgoing microphone only while Safari narration actually speaks, then restores it. Qwen processes the child's subsequent speech.
- **Voice diagnostics:** The local sound meter and Qwen speech-detected state are in Parent setup, not the child screen. The meter never records, stores or transmits amplitude data. A lower acoustic VAD threshold can also pick up unwanted background voices. A short speech transcript may be examined in browser memory for choosing a locally spoken game follow-up, without transmitting extra commands or saving it.
- **Mini V6.2 follow-ups:** The system briefly keeps the most recent child and Qwen text transcripts in browser memory to decide whether a question is missing; it does not save these texts to a server or local storage. If enabled, a single local Safari voice follow-up may play after a completed Qwen reply. This fallback may be generic and is not sent to the provider's conversation history. It does not automatically start further AI requests. Do not leave children unattended, and respect when they want to stop.

- `.github/workflows/ci.yml` runs mock/server tests only: it does not access Alibaba, call external AI models or need secrets.

For bugs and security issues in a repository you later publish, avoid including real credentials or private logs in GitHub issues.
