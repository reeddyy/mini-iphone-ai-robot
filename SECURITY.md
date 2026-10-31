# Security notes

This is a personal prototype, **not a production-hardened service**.

- This repository is **public**: anyone can read and copy its source. Never rely on code or repository visibility to keep credentials private. Store secrets only in your local, Git-ignored `.env` file.
- Never commit `.env`, `.env.*`, Alibaba API keys, access codes, cloud credentials, or recordings. `.env.example` contains only placeholders.
- Run the robot server on `127.0.0.1`; use a restricted HTTPS tunnel for iPhone access. Do not port-forward Mini directly to the internet. For ngrok, require Google OAuth restricted to your own email address (see `ngrok-policy.example.yml`) and keep your actual `ngrok-policy.yml` out of Git.
- Rotate any API key or access code immediately if exposed, even in a private commit. Removing it from the latest file does not remove it from Git history.
- The access code, short sessions and session-count throttle are lightweight protections, **not a guaranteed spend cap**. Set quotas and alerts at your provider if possible.
- The continuous camera/microphone feed goes to the AI provider while a session is running. Ask permission before filming/recording others and avoid filming children by default.
- `.github/workflows/ci.yml` runs mock/server tests only: it does not access Alibaba, call external AI models or need secrets.

For bugs and security issues in a repository you later publish, avoid including real credentials or private logs in GitHub issues.
