import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
// Run against the dedicated fixture server with Chromium's CDP port 9228.
const pages=await (await fetch('http://127.0.0.1:9228/json')).json();
const ws=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);
await new Promise(resolve=>ws.addEventListener('open',resolve,{once:true}));
let id=0;
const pending=new Map();
const browserErrors=[];
ws.addEventListener('message',({data})=>{
  const m=JSON.parse(data);
  if(m.method==='Runtime.exceptionThrown') browserErrors.push(m.params.exceptionDetails.text);
  if(m.id && pending.has(m.id)) {
    const {resolve,reject}=pending.get(m.id);pending.delete(m.id);
    m.error?reject(new Error(JSON.stringify(m.error))):resolve(m.result);
  }
});
const rpc=(method,params={})=>new Promise((resolve,reject)=>{
  pending.set(++id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));
});
async function evaluate(expression) {
  const r=await rpc('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
  if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
}
async function waitFor(expression) {
  for(let i=0;i<300;i++) {
    if(await evaluate(expression))return;
    await new Promise(resolve=>setTimeout(resolve,50));
  }
  throw new Error('Timed out: '+expression);
}
async function screenshot(name) {
  const shot=await rpc('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
  await writeFile('/tmp/'+name+'.png',Buffer.from(shot.data,'base64'));
}



const base='http://127.0.0.1:3109';
await rpc('Page.enable');await rpc('Runtime.enable');await rpc('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
await rpc('Page.navigate',{url:base});await waitFor(`document.readyState==='complete' && mode==='realtime'`);
await evaluate(`window.captures=0;window.originalCapture=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=options=>{captures++;return originalCapture(options);};mode='preview';$('sendVideo').checked=true;$('accessCode').value='coherent-parent-fixture';window.starting=startMini();true`);
await waitFor(`Boolean(current?.ready) && $('preview').videoWidth>0`);
const OFFER='v=0\r\no=- 123 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\na=group:BUNDLE 0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=mid:0\r\na=sendrecv\r\n';
const grant=await fetch(base+'/api/realtime/sdp',{method:'POST',headers:{'Content-Type':'application/sdp','X-Robot-Access-Code':'coherent-parent-fixture','X-Mini-Visuals':'true','X-Mini-Images':'true'},body:OFFER});assert.equal(grant.status,200);const token=grant.headers.get('X-Mini-Visual-Session');
await fetch(base+'/__fixture/image-success');
await evaluate(`(async()=>{
 const s=current;window.originalCamera=s.localStream.getVideoTracks()[0];window.originalMic=s.audioInputTrack;
 s.mode='realtime';s.mediaReady=true;s.visualsEnabled=true;s.imagesAllowed=true;s.visualGrant=${JSON.stringify(token)};s.baseInstructions=extras.buildInstructions({language:'en'});
 window.sentEvents=[];s.eventChannel={readyState:'open',send:message=>{sentEvents.push(JSON.parse(message));setTimeout(()=>{if(current && !current.stopped)receiveEvent(current,{type:'session.updated'},current.eventChannel);},1);}};
 s.audioMeter={isAudible:()=>false,stop(){}};s.fps=2;makeVideoTrack(s);
 s.pc={connectionState:'connected',close(){this.connectionState='closed';}};
 window.mediaStats=async()=>({video:$('preview').getVideoPlaybackQuality().totalVideoFrames,audio:s.audioInputTrack.readyState==='live' && s.audioInputTrack.enabled,time:$('preview').currentTime});

})()`);
await waitFor(`current?.pc.connectionState==='connected'`);await waitFor(`mediaStats().then(s=>s.video>0 && s.audio)`);
const ids=await evaluate(`({camera:originalCamera.id,mic:originalMic.id})`);
async function spokenTurn(request,reply){
 await evaluate(`receiveEvent(current,{type:'input_audio_buffer.speech_started'});receiveEvent(current,{type:'input_audio_buffer.speech_stopped'});receiveEvent(current,{type:'conversation.item.input_audio_transcription.completed',transcript:${JSON.stringify(request)}});receiveEvent(current,{type:'response.created',response:{id:'reply-'+current.turnNumber}});receiveEvent(current,{type:'response.audio_transcript.done',transcript:${JSON.stringify(reply)}});onRemoteAudio(current,true);receiveEvent(current,{type:'response.done',response:{status:'completed'}});onRemoteAudio(current,false);true`);
}
async function picture(request,reply){
 await spokenTurn(request,reply);
 await waitFor(`Boolean(document.querySelector('#visualCanvas img')?.complete) && !current.visualPlanning && !current.contextUpdatePending`);
}
await picture('Show me a cat','A friendly cat is coming.');
assert.equal(await evaluate(`document.querySelector('#visualCanvas svg')===null`),true);
assert.equal(await evaluate(`$('preview').closest('dialog')===null && !$('cameraSurface').classList.contains('hidden') && !$('preview').paused`),true);
assert.equal(await evaluate(`getComputedStyle(document.querySelector('#visualCanvas img')).animationName`),'visual-float');
await screenshot('mini-image-only-cat');
const before=await evaluate(`mediaStats()`),updates=await evaluate(`sentEvents.length`);
await evaluate(`$('visualExit').click();true`);
assert.equal(await evaluate(`current.ready && !current.stopped && originalMic.enabled && originalCamera.readyState==='live' && current.pc.connectionState==='connected' && captures===1 && !generatedVisuals.isActive()`),true);
await waitFor(`mediaStats().then(s=>s.video>${before.video} && s.audio===true && s.time>${before.time})`);
assert.equal(await evaluate(`sentEvents.length`),updates,'Back to Mini sends no session.update');
await evaluate(`current.contextUpdatePending=true;receiveEvent(current,{type:'error',error:{code:'InvalidParameter',type:'unknown',param:''}});true`);
assert.equal(await evaluate(`!current.stopped && current.contextSyncDisabled && originalMic.enabled && originalCamera.readyState==='live'`),true);
await spokenTurn('请用中文回答','好呀，我们用中文聊天。');
await waitFor(`!current.pendingVisualTurn && !current.visualPlanning`);
await picture('给我看一只跳舞的水母宇航员','一位会跳舞的水母宇航员要来啦。');
assert.equal(await evaluate(`current.conversationLanguage`),'zh');assert.equal(await evaluate(`$('visualTitle').textContent`),'你要的画');
assert.equal(await evaluate(`getComputedStyle(document.querySelector('#visualCanvas img')).animationName`),'visual-wiggle');
await rpc('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
assert.equal(await evaluate(`getComputedStyle(document.querySelector('#visualCanvas img')).animationName`),'none');
await rpc('Emulation.setEmulatedMedia',{features:[]});await evaluate(`$('visualExit').click();true`);
for(const [width,height] of [[320,568],[390,844],[430,932],[844,390]]){
 await rpc('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});
 assert.equal(await evaluate(`document.body.scrollWidth<=innerWidth && $('kidStopBtn').getBoundingClientRect().bottom<=innerHeight && !$('cameraSurface').classList.contains('hidden')`),true,'Live camera and Stop fit '+width);
 await screenshot('mini-live-camera-'+width);
}
await rpc('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
let pausedRequest;ws.addEventListener('message',({data})=>{const m=JSON.parse(data);if(m.method==='Fetch.requestPaused')pausedRequest=m.params.requestId;});
await rpc('Fetch.enable',{patterns:[{urlPattern:'*/api/visual/image',requestStage:'Request'}]});
await evaluate(`window.pendingPicture=requestGeneratedVisual(current,'Show me a sunflower');true`);await waitFor(`generatedVisuals.isActive() && current.visualPlanning`);
for(let i=0;i<100 && !pausedRequest;i++)await new Promise(r=>setTimeout(r,50));assert.ok(pausedRequest);
await evaluate(`$('visualExit').click();true`);await rpc('Fetch.failRequest',{requestId:pausedRequest,errorReason:'Aborted'}).catch(()=>{});await rpc('Fetch.disable');
await waitFor(`!current.visualPlanning && !generatedVisuals.isActive()`);
assert.equal(await evaluate(`originalCamera.id===${JSON.stringify(ids.camera)} && originalMic.id===${JSON.stringify(ids.mic)} && captures===1 && current.pc.connectionState==='connected'`),true);
const state=await (await fetch(base+'/__fixture/state')).json();assert.equal(state.imageCalls,2);assert.deepEqual(state.plans.map(plan=>plan.request),['请用中文回答'],'explicit pictures never depend on drawing JSON');
await screenshot('mini-back-to-mini-camera-live');
await evaluate(`window.outputTrack=current.videoOutTrack;$('kidStopBtn').click();true`);
assert.equal(await evaluate(`current===null && originalCamera.readyState==='ended' && originalMic.readyState==='ended' && outputTrack.readyState==='ended' && $('preview').srcObject===null && $('cameraMonitor').srcObject===null`),true);
assert.deepEqual(browserErrors,[]);
console.log('PASS: direct cat/novel image routing, English/Mandarin picture flow, actual image animation and reduced motion, live camera frames and the same enabled microphone track continue after Back to Mini, late optional update errors preserve capture, in-flight image cancellation keeps the same tracks, responsive camera indicator, explicit Stop releases all media.');
ws.close();
