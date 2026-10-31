# Publish the Mini Robot project to GitHub

The preferred option is to connect GitHub to ChatGPT and let ChatGPT create/update a private repository.

If you want to publish from your Windows PC without the connector, the easiest route is GitHub CLI:

1. Install **Git for Windows**: https://git-scm.com/downloads/win
2. Install **GitHub CLI**: https://cli.github.com/ (or `winget install --id GitHub.cli --exact`)
3. Open PowerShell in this folder and run `gh auth login`. Follow the prompts to sign into your GitHub account.
4. Review `.gitignore`, ensure there is **no `.env` or any API key in Git**, and run:

   ```powershell
   .\publish-to-github.ps1
   ```

The script creates a local Git repository (if needed), makes the first commit,
creates `mini-iphone-ai-robot` as a **private** repo in your GitHub account,
and pushes the `main` branch. If the remote already exists, it pushes new commits.

Git may ask you to configure an author name/email for commits. Do so using:

```powershell
git config --global user.name "Your GitHub display name"
git config --global user.email "Your GitHub verified email or noreply email"
```

When working later, edit files and run the script again to commit/push. Or ask ChatGPT to update the connected repo, once GitHub access is authorised.

Important: The script does **not** create GitHub accounts or store passwords. It uses `gh auth login`'s existing authentication. It does not use an Alibaba API key.
