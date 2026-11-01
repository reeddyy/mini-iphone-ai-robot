import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createApp} from '../server.mjs';

const OFFER='v=0\r\no=- 123 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\na=group:BUNDLE 0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=mid:0\r\na=sendrecv\r\n';
const CODE='awareness-fixture-code';
// Synthetic bounded JPEG envelope; the provider is mocked and never decodes it.
const FRAME='data:image/jpeg;base64,'+Buffer.concat([Buffer.from([255,216,255]),Buffer.alloc(40),Buffer.from([255,217])]).toString('base64');
const observed={version:1,personPresent:true,faceVisible:true,smiling:true,waving:false,confidence:.96};
const json=value=>new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}});
async function withApp(provider,task) {
  const calls=[];
  const app=createApp({accessCode:CODE,apiKey:'sk-test-only',workspaceId:'ws-test',fetchFn:async(url,options)=>{
    if(String(url).includes('/webrtc/'))return new Response(OFFER);
    calls.push({url,options});return provider(url,options);
  }});
  app.listen(0,'127.0.0.1');await once(app,'listening');const base='http://127.0.0.1:'+app.address().port;
  const start=async({awareness=true,camera=true,visuals=false}={})=>{
    const response=await fetch(base+'/api/realtime/sdp',{method:'POST',headers:{'Content-Type':'application/sdp','X-Robot-Access-Code':CODE,'X-Mini-Awareness':String(awareness),'X-Mini-Camera':String(camera),'X-Mini-Visuals':String(visuals)},body:OFFER});
    assert.equal(response.status,200);return response.headers.get('X-Mini-Visual-Session');
  };
  const post=(token,body={frames:[FRAME,FRAME]},path='/api/visual/observe')=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(body)});
  try{await task({base,start,post,calls});}finally{await new Promise(resolve=>app.close(resolve));}
}
test('Camera awareness needs parent-issued camera and awareness consent; grants keep scopes separate',async()=>{
  await withApp(()=>{throw Error('No observation expected');},async({start,post,calls})=>{
    assert.equal((await post(CODE)).status,401);
    assert.equal(await start({camera:false}),null);
    const visual=await start({awareness:false,visuals:true});assert.equal((await post(visual)).status,403);
    const cameraOff=await start({camera:false,visuals:true});assert.equal((await post(cameraOff)).status,403);
    const token=await start();assert.ok(token);
    assert.equal((await post(token,{request:'cat'},'/api/visual/plan')).status,403);
    assert.equal(calls.length,0);
  });
});
test('Visual observer sends only two bounded frames to the configured vision model and returns validated cues',async()=>{
  await withApp((url,options)=>{
    assert.equal(url,'https://ws-test.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1/chat/completions');
    const body=JSON.parse(options.body);assert.equal(body.model,'qwen-vl-plus');
    assert.deepEqual(body.messages[1].content.filter(part=>part.type==='image_url').map(part=>part.image_url.url),[FRAME,FRAME]);
    assert.match(body.messages[0].content,/Never identify/);assert.match(body.messages[0].content,/not inferred happiness/);
    return json({choices:[{message:{content:JSON.stringify(observed)}}]});
  },async({start,post})=>{
    const response=await post(await start());assert.equal(response.status,200);assert.deepEqual(await response.json(),{observation:observed});
  });
});
test('Remote image URLs, oversized frames and unexpected input are rejected before provider access',async()=>{
  await withApp(()=>{throw Error('No provider access');},async({start,post,calls})=>{
    const token=await start();
    for(const body of [{frames:['https://example.com/one','https://example.com/two']},{frames:[FRAME,FRAME],name:'private'},{frames:[FRAME]},{frames:Array(2).fill('data:image/jpeg;base64,'+'A'.repeat(120001))}])assert.equal((await post(token,body)).status,400);
    assert.equal((await post(token,{frames:['A'.repeat(250001)]})).status,413);assert.equal(calls.length,0);
  });
});
test('Unexpected emotion or identity output is discarded without leaking provider text',async()=>{
  await withApp(()=>json({choices:[{message:{content:JSON.stringify({...observed,identity:'private-provider-output',emotion:'sad'})}}]}),async({start,post})=>{
    const response=await post(await start());assert.equal(response.status,502);assert.doesNotMatch(await response.text(),/private-provider-output|emotion|sad/);
  });
});
test('Observation frequency, total checks and grant expiry are enforced on the server',async t=>{
  let now=Date.now();t.mock.method(Date,'now',()=>now);
  await withApp(()=>json({choices:[{message:{content:JSON.stringify(observed)}}]}),async({start,post,calls})=>{
    const token=await start();assert.equal((await post(token)).status,200);
    assert.equal((await post(token)).status,429);
    for(let i=1;i<40;i++){now+=15000;assert.equal((await post(token)).status,200);}
    now+=15000;assert.equal((await post(token)).status,429);assert.equal(calls.length,40);
    now+=61*60000;assert.equal((await post(token)).status,401);
  });
});
test('Stop revocation aborts an observation already running',async()=>{
  let started,aborted=false;const ready=new Promise(resolve=>{started=resolve;});
  await withApp((_url,options)=>new Promise((_resolve,reject)=>{
    options.signal.addEventListener('abort',()=>{aborted=true;reject(new Error('cancelled'));},{once:true});started();
  }),async({base,start,post})=>{
    const token=await start(),pending=post(token);await ready;
    await fetch(base+'/api/visual/session',{method:'DELETE',headers:{Authorization:'Bearer '+token}});
    assert.equal((await pending).status,502);assert.equal(aborted,true);assert.equal((await post(token)).status,401);
  });
});
