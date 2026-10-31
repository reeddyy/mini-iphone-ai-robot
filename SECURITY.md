# Security notes

This is a personal prototype, **not a production-hardened service**.

- Keep this GitHub repository **private**, at least while experimenting.
- Never commit `.env`, `.env.*`, Alibaba API keys, access codes, cloud credentials, or recordings. `.env.example` contains only placeholders.
- Run the robot server on `127.0.0.1`; use a restricted HTTPS tunnel for iPhone access. Do not forward port 3000 directly to the internet.
- Rotate any API key or access code immediately if exposed, even in a private commit. Removing it from the latest file does not remove it from Git history.
- The access code, short sessions and session-count throttle are lightweight protections, **not a guaranteed spend cap**. Set quotas and alerts at your provider if possible.
- The continuous camera/microphone feed goes to the AI provider while a session is running. Ask permission before filming/recording others and avoid filming children by default.
- `.github/workflows/ci.yml` runs mock/server tests only: it does not access Alibaba, call external AI models or need secrets.

For bugs and security issues in a repository you later publish, avoid including real credentials or private logs in GitHub issues.
