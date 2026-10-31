import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../server.mjs';

const CODE='safe-private-code-999';
const OFFER='v=0\r\no=- 123 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\na=group:BUNDLE 0 1\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=mid:0\r\na=sendrecv\r\n';
const ANSWER='v=0\r\no=- 88 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\na=group:BUNDLE 0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=mid:0\r\na=sendrecv\r\n';
async function withApp(args, task){
  const app=createApp({accessCode:CODE,...args});
  app.listen(0,'127.0.0.1');
  await once(app,'listening');
  const base=`http://127.0.0.1:${app.address().port}`;
  try { await task(base); }
  finally { await new Promise((resolve,reject)=>app.close(err=>err?reject(err):resolve())); }
}
function sdp(base, code=CODE, offer=OFFER, type='application/sdp'){
  return fetch(base+'/api/realtime/sdp',{method:'POST',headers:{'content-type':type,'x-robot-access-code':code},body:offer});
}

test('Serves only frontend; config has no API secrets',async()=>{
  await withApp({apiKey:''},async base=>{
    for(const path of ['/','/app.js','/mini-extras.js','/mini-kids.js','/mini-child-ui.js','/style.css']) assert.equal((await fetch(base+path)).status,200);
    for(const path of ['/.env','/server.mjs','/README.md']) assert.equal((await fetch(base+path)).status,404);
    const config=await (await fetch(base+'/api/config')).json();
    assert.deepEqual(config,{mode:'preview',model:null,maxSessionMinutes:60});
  });
});

test('Diagnostic POST bypasses the AI provider and confirms arrival at Mini',async()=>{
  await withApp({apiKey:'sk-payg-test',workspaceId:'ws123abc',fetchFn:()=>{throw Error('Diagnostic must not call Alibaba');}},async base=>{
    const response=await fetch(base+'/api/diagnostics/post',{method:'POST',headers:{'content-type':'application/sdp'},body:'v=0\r\n'});
    assert.equal(response.status,200);
    assert.deepEqual(await response.json(),{ok:true,origin:'mini',method:'POST'});
  });
});

test('Preview mode cannot open a billed session',async()=>{
  await withApp({apiKey:'',fetchFn:()=>{throw Error('Must never call upstream');}},async base=>{
    assert.equal((await sdp(base)).status,412);
  });
});

test('Reject wrong code, invalid MIME and invalid SDP before upstream',async()=>{
  await withApp({apiKey:'sk-payg-test',workspaceId:'ws123abc',fetchFn:()=>{throw Error('Should not reach upstream');}},async base=>{
    assert.equal((await sdp(base,'bad-code')).status,401);
    assert.equal((await sdp(base,CODE,OFFER,'application/json')).status,415);
    assert.equal((await sdp(base,CODE,'not an offer')).status,400);
  });
});

test('Proxies SDP through workspace-specific Singapore endpoint and keeps key private',async()=>{
  let upstreamCount=0;
  await withApp({apiKey:'sk-payg-test',workspaceId:'ws123abc',fetchFn:async(url,opts)=>{
    upstreamCount++;
    assert.equal(url,'https://ws123abc.ap-southeast-1.maas.aliyuncs.com/api/v1/webrtc/realtime?model=qwen3.8-omni-flash-realtime');
    assert.equal(opts.headers.Authorization,'Bearer sk-payg-test');
    assert.equal(opts.headers['Content-Type'],'application/sdp');
    assert.equal(opts.body,OFFER);
    return new Response(ANSWER,{status:200,headers:{'Content-Type':'application/sdp'}});
  }},async base=>{
    const config=await (await fetch(base+'/api/config')).json();
    assert.equal(config.mode,'realtime');
    assert.equal(JSON.stringify(config).includes('sk-payg-test'),false);
    const resp=await sdp(base);
    assert.equal(resp.status,200);
    assert.match(resp.headers.get('content-type'),/application\/sdp/);
    assert.equal(await resp.text(),ANSWER);
    assert.equal(upstreamCount,1);
  });
});

test('Does not disclose failed upstream response bodies',async()=>{
  await withApp({apiKey:'sk-payg-test',workspaceId:'ws123abc',fetchFn:async()=>new Response('private secret user info',{status:403})},async base=>{
    const resp=await sdp(base);
    assert.equal(resp.status,502);
    const msg=await resp.text();
    assert.match(msg,/HTTP 403/);
    assert.equal(msg.includes('private secret'),false);
  });
});

test('Rejects Token Plan key and invalid Workspace IDs',()=>{
  assert.throws(()=>createApp({accessCode:CODE,apiKey:'sk-sp-example',workspaceId:'ws123abc'}),/Token Plan/);
  assert.throws(()=>createApp({accessCode:CODE,apiKey:'sk-payg',workspaceId:'anything.evil.com'}),/WORKSPACE_ID|workspace ID/);
  assert.throws(()=>createApp({accessCode:CODE,apiKey:'sk-payg',workspaceId:''}),/WORKSPACE_ID|workspace ID/);
});

test('Keeps rate limit to at most eight SDP attempts per 10 minutes',async()=>{
  let count=0;
  await withApp({apiKey:'sk-payg-test',workspaceId:'ws123abc',fetchFn:async()=>{count++;return new Response(ANSWER,{status:200});}},async base=>{
    for(let i=0;i<8;i++)assert.equal((await sdp(base)).status,200);
    assert.equal((await sdp(base)).status,429);
    assert.equal(count,8);
  });
});
