import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {once} from 'node:events';
import {createApp} from '../server.mjs';

const BASIC='Basic '+Buffer.from('mini:synthetic-gateway-password').toString('base64');
const CODE='synthetic-parent-code';
const SDP='v=0\r\no=- 123 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\na=group:BUNDLE 0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=mid:0\r\na=sendrecv\r\n';
const FRAME='data:image/jpeg;base64,'+Buffer.concat([Buffer.from([255,216,255]),Buffer.alloc(40),Buffer.from([255,217])]).toString('base64');
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64');
const json=value=>new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}});

test('Gateway Basic Auth coexists with Mini grants across planning, awareness, artwork and revocation',async()=>{
  let providerCalls=0;const received=[];
  const origin=createApp({apiKey:'sk-upstream-fixture',workspaceId:'ws-fixture',accessCode:CODE,imageModel:'qwen-image-plus',fetchFn:async(url,init)=>{
    providerCalls++;
    if(!String(url).includes('.oss-')){
      assert.equal(init.headers.Authorization,'Bearer sk-upstream-fixture','only server-side provider calls use the API key');
      assert.equal(init.headers['X-Mini-Visual-Session'],undefined);
    }
    if(String(url).includes('/webrtc/'))return new Response(SDP);
    if(String(url).includes('/chat/completions')){
      const body=JSON.parse(init.body);
      const result=body.model==='qwen-vl-plus'
        ? {version:1,personPresent:true,faceVisible:true,smiling:true,waving:false,confidence:.96}
        : {version:1,action:'artwork',prompt:'A gentle moon garden.'};
      return json({choices:[{message:{content:JSON.stringify(result)}}]});
    }
    if(String(url).includes('/multimodal-generation/'))return json({output:{choices:[{message:{content:[{image:'https://fixture.oss-ap-southeast-1.aliyuncs.com/image.png'}]}}]}});
    assert.equal(init.headers,undefined);return new Response(PNG);
  }});
  const handler=origin.listeners('request')[0];
  const gateway=http.createServer((req,res)=>{
    if(req.headers.authorization!==BASIC){res.writeHead(401,{'WWW-Authenticate':'Basic realm="Mini fixture"'});res.end('Sign in');return;}
    received.push({path:req.url,grant:req.headers['x-mini-visual-session'],authorization:req.headers.authorization});
    handler(req,res);
  });
  gateway.listen(0,'127.0.0.1');await once(gateway,'listening');const base='http://127.0.0.1:'+gateway.address().port;
  const send=(path,body,grant)=>fetch(base+path,{method:'POST',headers:{Authorization:BASIC,'Content-Type':'application/json',...(grant?{'X-Mini-Visual-Session':grant}:{})},body:JSON.stringify(body)});
  try {
    const anonymous=await fetch(base+'/api/config');assert.equal(anonymous.status,401);assert.match(anonymous.headers.get('WWW-Authenticate'),/^Basic/);assert.equal(providerCalls,0);
    const session=await fetch(base+'/api/realtime/sdp',{method:'POST',headers:{Authorization:BASIC,'Content-Type':'application/sdp','X-Robot-Access-Code':CODE,'X-Mini-Visuals':'true','X-Mini-Images':'true','X-Mini-Awareness':'true','X-Mini-Camera':'true'},body:SDP});
    assert.equal(session.status,200);const grant=session.headers.get('X-Mini-Visual-Session');assert.ok(grant);
    const missing=await send('/api/visual/plan',{request:'Draw a garden'});assert.equal(missing.status,401);assert.equal(missing.headers.get('WWW-Authenticate'),null);
    const plan=await send('/api/visual/plan',{request:'Draw a garden'},grant);assert.equal(plan.status,200);const {imageTicket}=await plan.json();
    assert.equal((await send('/api/visual/observe',{frames:[FRAME,FRAME]},grant)).status,200);
    const picture=await send('/api/visual/image',{ticket:imageTicket},grant);assert.equal(picture.status,200);assert.equal(Buffer.compare(Buffer.from(await picture.arrayBuffer()),PNG),0);
    const conflict=await fetch(base+'/api/visual/plan',{method:'POST',headers:{Authorization:'Bearer '+grant,'Content-Type':'application/json'},body:'{"request":"hello"}'});
    assert.equal(conflict.status,401);assert.match(conflict.headers.get('WWW-Authenticate'),/^Basic/,'old header transport triggers the gateway challenge');
    const revoked=await fetch(base+'/api/visual/session',{method:'DELETE',headers:{Authorization:BASIC,'X-Mini-Visual-Session':grant}});assert.equal(revoked.status,200);
    const expired=await send('/api/visual/plan',{request:'hello'},grant);assert.equal(expired.status,401);assert.equal(expired.headers.get('WWW-Authenticate'),null,'Mini grant failures never challenge the tunnel password');
    assert.equal(received.filter(value=>value.grant===grant).length,5);assert.ok(received.every(value=>value.authorization===BASIC));
  }finally{await new Promise(resolve=>gateway.close(resolve));}
});
