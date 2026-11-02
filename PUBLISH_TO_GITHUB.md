# Repository already published

The source is now public at https://github.com/reeddyy/mini-iphone-ai-robot.

**You do not need the publication script or GitHub CLI to download updates.**

On Windows, after installing Git for Windows and Node.js 22+:

```powershell
git clone https://github.com/reeddyy/mini-iphone-ai-robot.git
cd mini-iphone-ai-robot
Copy-Item .env.example .env
notepad .env
npm start
```

For future updates, run `git pull` inside the existing project folder, then restart with `npm start`.

The repository is public, so cloning and pulling require **no GitHub sign-in**. Pushing code changes still requires authenticated GitHub access. Ask ChatGPT to update the connected GitHub repo, or authenticate Git locally if you want to contribute yourself.

**Never commit `.env`, API keys, access codes or recordings.** The `.gitignore` excludes local credentials. Read [SECURITY.md](SECURITY.md) before deploying a publicly reachable server.

## Recover after a lost session

Start with [the current project state](docs/PROJECT_STATE.md) and [recovery instructions](docs/RECOVERY.md). GitHub preserves the pushed source and documentation. Keep a separate private backup of your Windows `.env` and tunnel policies; those files are intentionally excluded from Git.
