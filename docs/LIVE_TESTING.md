# Authenticate a protected live test deployment

The 2 November review reached the user's HTTPS tunnel, which correctly required ngrok Basic Auth. Local simulations and the [review report](TEST_REVIEW_2026-11-02.md) are complete; live application/model checks remain pending.

## Secure requirements prepared

A cloud environment configuration **draft** was saved with two personal secret requirements, each restricted to the user-provided ngrok hostname. No secret values were supplied, and saving the draft does not activate them. Review/save the changes in **environment settings**, enter the values securely, then **publish the environment**, as required by the configuration tool.

| Secret field | Value to enter privately |
| --- | --- |
| `MINI_TUNNEL_AUTH_HEADER` | The complete HTTP Authorization value: `Basic ` followed by Base64-encoded `ngrok-username:ngrok-password`. This is the tunnel login, not the ngrok account authtoken. |
| `MINI_PARENT_ACCESS_CODE` | Mini's existing `ROBOT_ACCESS_CODE` from the private Windows `.env`. |

The backend retains its Alibaba API key. Neither these tests nor this draft require copying that key into chat or the cloud checkout. If the temporary ngrok hostname changes, update the allowed secret destination in environment settings rather than sending credentials to another host.

To prepare the first value on Windows without typing the password into a command or printing the header, run this locally in PowerShell:

```powershell
$miniNgrokUser = Read-Host 'ngrok tunnel username'
$miniNgrokPassword = Read-Host 'ngrok tunnel password' -AsSecureString
$miniNgrokCredential = [System.Management.Automation.PSCredential]::new($miniNgrokUser, $miniNgrokPassword)
$miniNgrokBytes = [Text.Encoding]::UTF8.GetBytes($miniNgrokUser + ':' + $miniNgrokCredential.GetNetworkCredential().Password)
Set-Clipboard -Value ('Basic ' + [Convert]::ToBase64String($miniNgrokBytes))
```

Paste the clipboard into the secure `MINI_TUNNEL_AUTH_HEADER` field in environment settings. Enter the Mini code into its separate secure field. Do not paste either value into chat or repository files.

## Continue after publishing

Recheck current environment readiness; a saved draft is not proof that credentials are active. Use the configured proxy and CA trust. Runtime secret variables may contain proxy placeholders: pass the full header value unchanged to the allowed HTTPS host instead of decoding, re-encoding or trying to reveal it.

1. Read the live page and `/api/config`, authenticate only to the exact permitted host, and confirm the deployed UI/model configuration.
2. Use the separate parent code for read-only `/api/parent/models` diagnostics. A listed model is not a successful generation test or proof of entitlement.
3. Keep any live generation/conversation test deliberately bounded and record actual outcomes, charges/request count where available, and limits. Do not label a mocked response as a live success.
4. Complete physical iPhone checks for microphone permissions, audible replies, interruptions, background/Stop capture indicators and Safari behavior. Cloud browser/WebRTC restrictions may prevent end-to-end voice even after HTTP authentication works.

Preserve the results in PROJECT_STATE.md and the review report, without credentials, private hostname details, recordings or child transcripts.
