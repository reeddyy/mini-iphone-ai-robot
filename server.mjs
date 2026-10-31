import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { timingSafeEqual } from 'node:crypto';

const ROOT = dirname(fileURLToPath(import.meta.url));
const STATIC = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/style.css', ['style.css', 'text/css; charset=utf-8']],
]);
const WINDOW_MS = 600_000;
const MAX_SDP_BYTES = 120_000;
const MODEL = 'qwen3.8-omni-flash-realtime';

function respond(res, status, body, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': contentType,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': 'DENY',
    'Permissions-Policy': 'camera=(self), microphone=(self)',
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; media-src 'self' blob:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  });
  res.end(body);
}
const json = (res, status, obj) => respond(res, status, JSON.stringify(obj), 'application/json; charset=utf-8');

function codeMatches(input, secret) {
  if (!secret || typeof input !== 'string') return false;
  const x = Buffer.from(input);
  const y = Buffer.from(secret);
  return x.length === y.length && timingSafeEqual(x, y);
}

function validateWorkspaceId(value) {
  const id = String(value || '').trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{2,90}$/.test(id)) throw new Error('Invalid ALIBABA_WORKSPACE_ID. Use the Singapore Model Studio workspace ID.');
  return id;
}

async function bodyWithLimit(req, maxBytes = MAX_SDP_BYTES) {
  let size = 0;
  const parts = [];
  for await (const part of req) {
    size += part.length;
    if (size > maxBytes) throw Object.assign(new Error('SDP too large'), {status:413});
    parts.push(part);
  }
  return Buffer.concat(parts).toString('utf8');
}

export function createApp({
  apiKey = process.env.ALIBABA_API_KEY || '',
  workspaceId = process.env.ALIBABA_WORKSPACE_ID || '',
  accessCode = process.env.ROBOT_ACCESS_CODE || '',
  fetchFn = fetch,
} = {}) {
  if (apiKey && apiKey.startsWith('sk-sp-')) {
    throw new Error('Token Plan key detected. A standalone live robot requires a Model Studio pay-as-you-go API key.');
  }
  const workspace = apiKey ? validateWorkspaceId(workspaceId) : null;
  const upstream = workspace
    ? `https://${workspace}.ap-southeast-1.maas.aliyuncs.com/api/v1/webrtc/realtime?model=${MODEL}`
    : null;
  const attempts = [];
  const authFails = [];
  const prune = arr => { const limit = Date.now() - WINDOW_MS; while (arr.length && arr[0] < limit) arr.shift(); };

  return http.createServer(async (req, res) => {
    const path = (req.url || '').split('?')[0];
    try {
      if (req.method === 'GET' && STATIC.has(path)) {
        const [file, type] = STATIC.get(path);
        return respond(res, 200, await readFile(join(ROOT, 'public', file)), type);
      }
      if (req.method === 'GET' && path === '/api/config') {
        return json(res, 200, { mode: upstream ? 'realtime' : 'preview', model: upstream ? MODEL : null, maxSessionMinutes: 15 });
      }
      if (req.method === 'GET' && path === '/favicon.ico') return respond(res, 204, '');
      if (req.method !== 'POST' || path !== '/api/realtime/sdp') return respond(res, 404, 'Not found');

      prune(attempts); prune(authFails);
      if (authFails.length >= 8) return json(res, 429, {error:'Too many incorrect access codes. Stop and restart your server to try again.'});
      if (!codeMatches(req.headers['x-robot-access-code'], accessCode)) {
        authFails.push(Date.now());
        console.warn('Mini SDP rejected: private ROBOT_ACCESS_CODE did not match (no secret logged).');
        return json(res, 401, {error:'Incorrect private robot access code. Check ROBOT_ACCESS_CODE in the Windows .env file, restart Mini, and enter the same value in Safari.'});
      }
      if (!upstream) return json(res, 412, {error:'Local preview only. Add a Model Studio pay-as-you-go API key and Workspace ID.'});
      if (attempts.length >= 8) return json(res, 429, {error:'Too many live sessions started in 10 minutes. Please try again later.'});
      if (!String(req.headers['content-type'] || '').toLowerCase().startsWith('application/sdp')) {
        return json(res, 415, {error:'WebRTC SDP content type required.'});
      }
      let sdp;
      try { sdp = await bodyWithLimit(req); }
      catch (err) { return json(res, err.status || 400, {error:'Invalid or oversized session offer.'}); }
      if (!sdp.startsWith('v=0') || !/^m=audio\s/m.test(sdp.replace(/\r/g,'')) || sdp.length < 100) {
        return json(res, 400, {error:'Invalid WebRTC session offer.'});
      }
      attempts.push(Date.now());
      const upstreamResponse = await fetchFn(upstream, {
        method:'POST',
        headers:{'Authorization':`Bearer ${apiKey}`, 'Content-Type':'application/sdp'},
        body:sdp,
        signal:AbortSignal.timeout(30_000),
      });
      if (!upstreamResponse.ok) {
        console.error('Model Studio WebRTC SDP exchange status:', upstreamResponse.status);
        return json(res, 502, {error:`Model Studio returned HTTP ${upstreamResponse.status}. Check the Singapore API key, Workspace ID, access and billing.`});
      }
      const answer = await upstreamResponse.text();
      if (answer.length > MAX_SDP_BYTES || !answer.startsWith('v=0') || !/^m=audio\s/m.test(answer.replace(/\r/g,''))) {
        return json(res, 502, {error:'Model Studio returned an invalid SDP answer.'});
      }
      return respond(res, 200, answer, 'application/sdp');
    } catch (err) {
      console.error('Mini server issue:', err?.message || 'unknown');
      return json(res, 502, {error:'Server could not establish the live session. Check your configuration and network.'});
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const code = process.env.ROBOT_ACCESS_CODE || '';
  const port = Number(process.env.PORT || 3000);
  if (code.length < 10 || code.includes('replace-me')) {
    console.error('Set a unique private ROBOT_ACCESS_CODE (10+ characters) in .env before starting.');
    process.exit(1);
  }
  try {
    const app = createApp({accessCode:code});
    app.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        const suggestedPort = port === 3001 ? 3002 : 3001;
        console.error(`Mini cannot start: port ${port} is already in use on 127.0.0.1.`);
        console.error(`Open .env, change PORT=${port} to PORT=${suggestedPort}, save it, then run npm start again.`);
      } else {
        console.error('Mini server could not start:', err.message);
      }
      process.exitCode = 1;
    });
    app.listen(port, '127.0.0.1', () => {
      console.log(`Mini V3: http://localhost:${port}`);
      console.log(process.env.ALIBABA_API_KEY ? 'AI mode: pay-as-you-go Qwen realtime' : 'AI mode: LOCAL PREVIEW ONLY (no AI charges)');
      console.log('For iPhone Safari, use a protected HTTPS tunnel. Do not use a Token Plan key.');
    });
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
