import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { timingSafeEqual, randomBytes } from 'node:crypto';
import {planVisual,generateArtwork,validateVisualPlan,visualModelIssue} from './visual-provider.mjs';
import {observeCamera,validateFrames} from './awareness-provider.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const STATIC = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/mini-extras.js', ['mini-extras.js', 'text/javascript; charset=utf-8']],
  ['/mini-kids.js', ['mini-kids.js', 'text/javascript; charset=utf-8']],
  ['/mini-activities.js', ['mini-activities.js', 'text/javascript; charset=utf-8']],
  ['/mini-board.js', ['mini-board.js', 'text/javascript; charset=utf-8']],
  ['/mini-visual-schema.js', ['mini-visual-schema.js', 'text/javascript; charset=utf-8']],
  ['/mini-visuals.js', ['mini-visuals.js', 'text/javascript; charset=utf-8']],
  ['/mini-awareness.js', ['mini-awareness.js', 'text/javascript; charset=utf-8']],
  ['/mini-child-ui.js', ['mini-child-ui.js', 'text/javascript; charset=utf-8']],
  ['/style.css', ['style.css', 'text/css; charset=utf-8']],
  ['/mini-face.css', ['mini-face.css', 'text/css; charset=utf-8']],
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
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self'; media-src 'self' blob:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
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
  visualModel = process.env.ALIBABA_VISUAL_MODEL || 'qwen-plus',
  imageModel = process.env.ALIBABA_IMAGE_MODEL || '',
  awarenessModel = process.env.ALIBABA_AWARENESS_MODEL || 'qwen-vl-plus',
} = {}) {
  if (apiKey && apiKey.startsWith('sk-sp-')) {
    throw new Error('Token Plan key detected. A standalone live robot requires a Model Studio pay-as-you-go API key.');
  }
  const workspace = apiKey ? validateWorkspaceId(workspaceId) : null;
  for(const model of [visualModel,imageModel,awarenessModel].filter(Boolean))if(!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$/.test(model))throw new Error('Invalid visual model name');
  const visualIssue=visualModelIssue(visualModel);
  const base=workspace?`https://${workspace}.ap-southeast-1.maas.aliyuncs.com`:null;
  const upstream = workspace
    ? `https://${workspace}.ap-southeast-1.maas.aliyuncs.com/api/v1/webrtc/realtime?model=${MODEL}`
    : null;
  const attempts = [];
  const authFails = [];
  const visualSessions=new Map();
  function revoke(token) {
    const grant=visualSessions.get(token);
    for(const controller of grant?.controllers.values() || [])controller.abort();
    visualSessions.delete(token);
  }
  function pruneVisuals(){for(const [token,grant] of visualSessions)if(grant.expiresAt<=Date.now())revoke(token);}
  const prune = arr => { const limit = Date.now() - WINDOW_MS; while (arr.length && arr[0] < limit) arr.shift(); };

  return http.createServer(async (req, res) => {
    const path = (req.url || '').split('?')[0];
    try {
      if (req.method === 'GET' && STATIC.has(path)) {
        const [file, type] = STATIC.get(path);
        return respond(res, 200, await readFile(join(ROOT, 'public', file)), type);
      }
      if (req.method === 'GET' && path === '/api/config') {
        return json(res, 200, { mode: upstream ? 'realtime' : 'preview', model: upstream ? MODEL : null, maxSessionMinutes: 60,
          visuals:{available:Boolean(upstream && !visualIssue),model:visualModel,imagesAvailable:Boolean(upstream && imageModel && !visualIssue),maxPlans:60,maxImages:4,
            ...(visualIssue?{configurationError:visualIssue.message}:{})},
          awareness:{available:Boolean(upstream),model:awarenessModel,maxChecks:40,minIntervalSeconds:15} });
      }
      if (req.method === 'GET' && path === '/favicon.ico') return respond(res, 204, '');
      if(path.startsWith('/api/visual/')) {
        pruneVisuals();
        // Authorization belongs to the HTTPS gateway (for example ngrok Basic Auth).
        const token=String(req.headers['x-mini-visual-session'] || '');
        const grant=visualSessions.get(token);
        if(!grant)return json(res,401,{error:'Start a parent-authorized session with visual responses enabled.'});
        if(path==='/api/visual/session' && req.method==='DELETE'){revoke(token);return json(res,200,{ok:true});}
        if(path==='/api/visual/observe' && req.method==='POST') {
          if(!grant.awarenessAllowed)return json(res,403,{error:'Visual awareness and camera sharing were not enabled for this session.'});
          if(!String(req.headers['content-type'] || '').startsWith('application/json'))return json(res,415,{error:'JSON required.'});
          let frames;
          try {
            const body=JSON.parse(await bodyWithLimit(req,250000));
            if(!body || typeof body!=='object' || Object.keys(body).some(key=>key!=='frames'))throw Error();
            frames=validateFrames(body.frames);
          } catch(error){return json(res,error.status || 400,{error:'Two bounded JPEG camera frames are required.'});}
          if(grant.observations>=40 || (grant.lastObservation!==null && Date.now()-grant.lastObservation<15000))return json(res,429,{error:'Visual check limit reached. Voice chat can continue.'});
          if(grant.controllers.has('observe'))return json(res,409,{error:'A visual check is already running.'});
          grant.observations++;grant.lastObservation=Date.now();
          const controller=new AbortController();grant.controllers.set('observe',controller);
          const timeout=setTimeout(()=>controller.abort(),15000);
          const disconnected=()=>{if(!res.writableEnded)controller.abort();};res.on('close',disconnected);
          try {
            const observation=await observeCamera({fetchFn,base,apiKey,model:awarenessModel,frames,signal:controller.signal});
            if(controller.signal.aborted || !visualSessions.has(token))throw Error();
            return json(res,200,{observation});
          } catch {
            if(!res.destroyed && !res.writableEnded)return json(res,502,{error:'Visual awareness paused. Voice chat can continue.'});
            return;
          } finally {
            clearTimeout(timeout);res.off('close',disconnected);grant.controllers.delete('observe');
          }
        }
        if(req.method!=='POST' || !['/api/visual/plan','/api/visual/image'].includes(path))return respond(res,404,'Not found');
        if(visualIssue)return json(res,400,{error:visualIssue.message,code:visualIssue.code,model:visualIssue.model});
        if(!grant.visualsAllowed)return json(res,403,{error:'Visual scenes were not enabled for this session.'});
        if(!String(req.headers['content-type'] || '').startsWith('application/json'))return json(res,415,{error:'JSON required.'});
        let body;
        try{body=JSON.parse(await bodyWithLimit(req,40000));if(!body || typeof body!=='object' || Array.isArray(body))throw Error();}
        catch(error){return json(res,error.status || 400,{error:'Invalid visual request.'});}
        const kind=path.endsWith('/plan')?'plan':'image';
        let scene=null;
        if(kind==='plan') {
          if(Object.keys(body).some(key=>!['request','scene','language'].includes(key)) || typeof body.request!=='string' || !body.request.trim() || body.request.length>500)return json(res,400,{error:'A short visual request is required.'});
          if(body.scene!==undefined && body.scene!==null){try{scene=validateVisualPlan(body.scene);}catch{return json(res,400,{error:'Invalid scene context.'});}}
          grant.recent=grant.recent.filter(time=>time>Date.now()-60000);
          if(grant.plans>=60 || grant.recent.length>=8)return json(res,429,{error:'Visual request limit reached. Voice chat can continue.'});
          grant.plans++;grant.recent.push(Date.now());
          grant.controllers.get('image')?.abort();grant.ticket=null;
        } else {
          if(Object.keys(body).some(key=>key!=='ticket') || !grant.imagesAllowed || !imageModel)return json(res,403,{error:'Generated pictures are not enabled for this session.'});
          if(!grant.ticket || body.ticket!==grant.ticket.id)return json(res,400,{error:'Ask Mini for a new picture first.'});
          if(grant.images>=4)return json(res,429,{error:'Picture limit reached for this session.'});
          grant.images++;
        }
        const prompt=kind==='image'?grant.ticket.prompt:null;
        if(kind==='image')grant.ticket=null;
        grant.controllers.get(kind)?.abort();
        const controller=new AbortController();grant.controllers.set(kind,controller);
        const timeout=setTimeout(()=>controller.abort(),kind==='plan'?20000:90000);
        const disconnected=()=>{if(!res.writableEnded)controller.abort();};res.on('close',disconnected);
        try {
          if(kind==='plan') {
            const plan=await planVisual({fetchFn,base,apiKey,model:visualModel,request:body.request,scene,
              language:['en','zh','auto'].includes(body.language)?body.language:'auto',imagesAllowed:grant.imagesAllowed,signal:controller.signal});
            if(controller.signal.aborted || !visualSessions.has(token))throw Error('Cancelled');
            let imageTicket;
            if(plan.action==='artwork') {
              if(!grant.imagesAllowed)return json(res,403,{error:'Generated pictures are not enabled. Mini can still draw with shapes.'});
              imageTicket=randomBytes(16).toString('hex');grant.ticket={id:imageTicket,prompt:plan.prompt};
            }
            return json(res,200,{plan,...(imageTicket?{imageTicket}:{})});
          }
          const image=await generateArtwork({fetchFn,base,apiKey,model:imageModel,prompt,signal:controller.signal});
          if(controller.signal.aborted || !visualSessions.has(token))throw Error('Cancelled');
          return respond(res,200,image.bytes,image.contentType);
        } catch {
          if(!res.destroyed && !res.writableEnded)return json(res,502,{error:kind==='plan'?'Mini could not prepare that visual. Try again; voice chat can continue.':'Mini could not finish that picture. Try a simpler drawing.'});
          return;
        } finally {
          clearTimeout(timeout);res.off('close',disconnected);
          if(grant.controllers.get(kind)===controller)grant.controllers.delete(kind);
        }
      }
      // Safe no-AI-cost probe: demonstrates that POST requests reach the actual
      // Mini origin rather than being rejected by a tunnel authentication layer.
      if (req.method === 'POST' && path === '/api/diagnostics/post') {
        console.info('Mini diagnostic POST reached origin (no AI request).');
        return json(res, 200, {ok:true, origin:'mini', method:'POST'});
      }
      if (req.method !== 'POST' || !['/api/realtime/sdp','/api/parent/authorize'].includes(path)) return respond(res, 404, 'Not found');

      prune(attempts); prune(authFails);
      if (authFails.length >= 8) return json(res, 429, {error:'Too many incorrect access codes. Stop and restart your server to try again.'});
      if (!codeMatches(req.headers['x-robot-access-code'], accessCode)) {
        authFails.push(Date.now());
        console.warn('Mini authorization rejected: private ROBOT_ACCESS_CODE did not match (no secret logged).');
        return json(res, 401, {error:'Incorrect private robot access code. Check ROBOT_ACCESS_CODE in the Windows .env file, restart Mini, and enter the same value in Safari.'});
      }
      // Reauthorize a parent action without creating another paid AI session.
      // Shares the access-code failure throttle with session startup.
      if (path === '/api/parent/authorize') return json(res, 200, {ok:true});
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
      const awarenessAllowed=req.headers['x-mini-awareness']==='true' && req.headers['x-mini-camera']==='true';
      if(req.headers['x-mini-visuals']==='true' || awarenessAllowed) {
        pruneVisuals();
        if(visualSessions.size>=128)revoke(visualSessions.keys().next().value);
        const token=randomBytes(32).toString('base64url');
        visualSessions.set(token,{expiresAt:Date.now()+60*60000,plans:0,images:0,recent:[],controllers:new Map(),ticket:null,
          visualsAllowed:req.headers['x-mini-visuals']==='true',awarenessAllowed,observations:0,lastObservation:null,
          imagesAllowed:req.headers['x-mini-visuals']==='true' && req.headers['x-mini-images']==='true' && Boolean(imageModel)});
        res.setHeader('X-Mini-Visual-Session',token);
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
      console.log(`Mini V6.4: http://localhost:${port}`);
      console.log(process.env.ALIBABA_API_KEY ? 'AI mode: pay-as-you-go Qwen realtime' : 'AI mode: LOCAL PREVIEW ONLY (no AI charges)');
      console.log('For iPhone Safari, use a protected HTTPS tunnel. Do not use a Token Plan key.');
    });
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
