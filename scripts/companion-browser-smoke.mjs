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


const OFFER='v=0\r\no=- 123 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\na=group:BUNDLE 0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=mid:0\r\na=sendrecv\r\n';
const base='http://127.0.0.1:3109';
async function grant(){const r=await fetch(base+'/api/realtime/sdp',{method:'POST',headers:{'Content-Type':'application/sdp','X-Robot-Access-Code':'coherent-parent-fixture','X-Mini-Visuals':'true','X-Mini-Images':'true'},body:OFFER});assert.equal(r.status,200);return r.headers.get('X-Mini-Visual-Session');}
await rpc('Page.enable');await rpc('Runtime.enable');await rpc('Network.enable');
const unexpected=[];ws.addEventListener('message',({data})=>{const m=JSON.parse(data);if(m.method==='Network.requestWillBeSent' && !m.params.request.url.startsWith(base) && !m.params.request.url.startsWith('data:') && !m.params.request.url.startsWith('blob:'+base))unexpected.push(m.params.request.url);});
await rpc('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
await rpc('Page.navigate',{url:base});await waitFor(`document.readyState==='complete' && mode==='realtime'`);
assert.equal(await evaluate(`$('parentSetup').open`),false);
for(const [width,height] of [[320,568],[390,844],[430,932],[844,390]]){
 await rpc('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});
 const fit=await evaluate(`({overflow:document.body.scrollWidth>innerWidth,scroll:document.body.scrollHeight>innerHeight,start:$('kidParentLink').getBoundingClientRect().bottom<=innerHeight})`);
 assert.deepEqual(fit,{overflow:false,scroll:false,start:true},'Home fits '+width+'x'+height);
 await screenshot('mini-mobile-home-'+width);
}
await rpc('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
await evaluate(`$('parentSettingsBtn').click();$('accessCode').value='coherent-parent-fixture';$('checkImageModelsBtn').click();true`);
await waitFor(`!$('checkImageModelsBtn').disabled`);assert.match(await evaluate(`$('imageModelCheckStatus').textContent`),/qwen-image-3.0.*not a successful generation test/);assert.equal(await evaluate(`$('accessCode').value`),'');
assert.equal(await evaluate(`document.activeElement.closest('dialog')?.id`),'parentSetup');
await screenshot('mini-mobile-parent-390');await evaluate(`closeParentSetup();true`);await waitFor(`document.activeElement.id==='parentSettingsBtn'`);
// Begin with real synthetic microphone/camera capture, then supply mocked realtime events.
await evaluate(`mode='preview';$('sendVideo').checked=true;$('accessCode').value='coherent-parent-fixture';window.starting=startMini();true`);await waitFor(`Boolean(current?.ready)`);
const token=await grant();
await evaluate(`window.miniAudio=current.audioInputTrack;window.miniCamera=current.localStream.getVideoTracks()[0];current.mode='realtime';current.mediaReady=true;current.visualsEnabled=true;current.imagesAllowed=true;current.visualGrant=${JSON.stringify(token)};current.awarenessEnabled=true;current.audioMeter={isAudible:()=>false,stop(){}};current.hadAudibleReply=true;current.baseInstructions=extras.buildInstructions({language:'en'});current.eventChannel={readyState:'open',send:()=>setTimeout(()=>{if(current && !current.stopped)receiveEvent(current,{type:'session.updated'},current.eventChannel)},0)};render();true`);
await evaluate(`receiveEvent(current,{type:'input_audio_buffer.speech_started'});receiveEvent(current,{type:'input_audio_buffer.speech_stopped'});receiveEvent(current,{type:'conversation.item.input_audio_transcription.completed',transcript:'Play tic tac toe'});true`);
assert.equal(await evaluate(`visualActivity.isActive()`),true);assert.equal((await (await fetch(base+'/__fixture/state')).json()).plans.length,0);
for(const [width,height] of [[320,568],[390,844],[430,932],[844,390]]){
 await rpc('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});
 const fit=await evaluate(`({overflow:document.body.scrollWidth>innerWidth,stop:$('kidStopBtn').getBoundingClientRect().bottom<=innerHeight,board:$('ticBoard').getBoundingClientRect().bottom<$('kidStopBtn').getBoundingClientRect().top})`);
 assert.deepEqual(fit,{overflow:false,stop:true,board:true},'Board fits '+width+'x'+height);await screenshot('mini-mobile-board-'+width);
}
await rpc('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
await evaluate(`current.childSpeaking=false;current.turnPending=false;current.responseActive=false;current.localVisualTurn=false;visualActivity.close(false);true`);
await fetch(base+'/__fixture/image-success');await evaluate(`window.visualWork=requestGeneratedVisual(current,'Paint Luna');true`);await waitFor(`Boolean(document.querySelector('#visualCanvas img')?.complete) && !current.visualPlanning`);assert.equal(await evaluate(`Boolean(document.querySelector('#visualCanvas img')?.complete)`),true);
await screenshot('mini-mobile-picture');await fetch(base+'/__fixture/reset');
await evaluate(`window.visualWork=requestGeneratedVisual(current,'Paint Luna');true`);await waitFor(`$('visualResult').textContent.includes('could not finish') && !current.visualPlanning`);assert.match(await evaluate(`$('visualResult').textContent`),/could not finish/);assert.match(await evaluate(`$('visualServiceStatus').textContent`),/HTTP 404/);
const next=await grant();const plan=await (await fetch(base+'/api/visual/plan',{method:'POST',headers:{'Content-Type':'application/json','X-Mini-Visual-Session':next},body:JSON.stringify({request:'Paint Luna',spokenReply:'Luna is beside the blue castle.'})})).json();assert.equal(plan.plan.action,'keep');assert.equal((await (await fetch(base+'/__fixture/state')).json()).imageCalls,1);
// Real pinned-model inference in its worker, using a public-domain adult fixture.
const {readFile}=await import('node:fs/promises');const picture=(await readFile(process.argv[2] || '/tmp/mini-astronaut.png')).toString('base64');
await evaluate(`window.adult=new Image();adult.src='data:image/png;base64,${picture}';window.inference=[];window.faceWorker=new Worker('/mini-face-worker.js');faceWorker.onmessage=async({data})=>{if(data.type==='ready'){await adult.decode();const bitmap=await createImageBitmap(adult);faceWorker.postMessage({type:'frame',bitmap},[bitmap]);}if(data.type==='landmarks'){window.inference.push(MiniLocalAwareness.geometry(data.points));}if(data.type==='error')window.inferenceError=true;};faceWorker.postMessage({type:'start'});true`);
for(let i=0;i<300;i++){if(await evaluate(`inference.length || window.inferenceError`))break;await new Promise(r=>setTimeout(r,200));}
console.log('REAL LANDMARKS',await evaluate(`inference[0]`));assert.equal(await evaluate(`Boolean(inference[0])`),true);assert.equal(await evaluate(`inference[0].smile`),true);
await evaluate(`faceWorker.terminate();current.responseActive=true;current.playbackActive=true;childUI.reactToVisualCue({cue:'smile',spoken:false});true`);assert.equal(await evaluate(`$('robotFace').dataset.expression`),'happy');
await evaluate(`current.childSpeaking=true;true`);assert.equal(await evaluate(`childUI.reactToVisualCue({cue:'smile',spoken:false})`),false);
await evaluate(`current.childSpeaking=false;current.responseActive=false;current.playbackActive=false;true`);
await evaluate(`$('kidStopBtn').click();true`);assert.equal(await evaluate(`current===null && miniAudio.readyState==='ended' && miniCamera.readyState==='ended' && $('preview').srcObject===null`),true);
await evaluate(`Object.defineProperties(adult,{videoWidth:{value:adult.width},readyState:{value:4}});window.reactionMetrics=[];window.smileSeen=false;window.localProbe=MiniLocalAwareness.start({video:adult,allowed:()=>true,onLook:cue=>{window.latestLocalCue=cue;window.smileSeen ||= Boolean(cue?.smiling);},onMetrics:m=>reactionMetrics.push(m)});true`);
await waitFor(`reactionMetrics.length>=4 && smileSeen`);
const performance=await evaluate(`reactionMetrics`);assert.ok(performance.every(m=>m.fps>0 && m.fps<=8 && m.processingMs>=0));
assert.equal(await evaluate(`smileSeen`),true);await evaluate(`localProbe.stop();true`);console.log('WARM LOCAL REACTION METRICS',performance.slice(-2));
assert.deepEqual(unexpected,[]);assert.deepEqual(browserErrors,[]);
console.log('PASS: model metadata, mobile portrait/landscape, immediate board, real PNG decode, no sketch fallback, process-wide 404 suppression, real local smile landmarks, reactive face during speech, Stop media teardown, no external requests or JS exceptions.');
ws.close();
