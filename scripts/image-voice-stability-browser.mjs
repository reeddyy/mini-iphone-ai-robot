import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';

// Auto-language/image stability review. Use the loopback fixture and Chromium
// on 9228. Providers/ASR/voice/transport are fixtures; no live paid calls.
const base='http://127.0.0.1:3109';
const pages=await (await fetch('http://127.0.0.1:9228/json')).json();
const ws=new WebSocket(pages.find(page=>page.type==='page').webSocketDebuggerUrl);
await new Promise(resolve=>ws.addEventListener('open',resolve,{once:true}));
let id=0;
const pending=new Map(),errors=[],results=[];
ws.addEventListener('message',({data})=>{
  const message=JSON.parse(data);
  if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails.text);
  if(pending.has(message.id)){
    const {resolve,reject}=pending.get(message.id);pending.delete(message.id);
    message.error?reject(Error(JSON.stringify(message.error))):resolve(message.result);
  }
});
function rpc(method,params={}){
  return new Promise((resolve,reject)=>{pending.set(++id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
}
async function evaluate(expression){
  const result=await rpc('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
  if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function waitFor(expression){
  for(let attempt=0;attempt<300;attempt++){
    if(await evaluate(expression))return;
    await new Promise(resolve=>setTimeout(resolve,50));
  }
  throw Error('Timed out: '+expression);
}
async function click(selector){
  const point=await evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});el.scrollIntoView({block:'center'});const r=el.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;if(!el.contains(document.elementFromPoint(x,y)))throw Error('Control is covered');return {x,y};})()`);
  await rpc('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});
  await rpc('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});
}
async function turn(request,reply='A tiny adventure. What shall happen next?',holdAudio=false){
  await evaluate(`(()=>{const s=current;receiveEvent(s,{type:'input_audio_buffer.speech_started'});receiveEvent(s,{type:'input_audio_buffer.speech_stopped'});receiveEvent(s,{type:'conversation.item.input_audio_transcription.completed',transcript:${JSON.stringify(request)}});receiveEvent(s,{type:'response.created',response:{id:'reply-'+s.turnNumber}});receiveEvent(s,{type:'response.audio_transcript.done',transcript:${JSON.stringify(reply)}});remoteAudible=true;onRemoteAudio(s,true);receiveEvent(s,{type:'response.done',response:{status:'completed'}});if(!${holdAudio}){remoteAudible=false;onRemoteAudio(s,false);}return true;})()`);
  await waitFor(`!current.pendingVisualTurn && !current.visualPlanning`);
}
async function checkpoint(name,fn){await fn();results.push(name);console.log('PASS: '+name);}
async function healthy(){
  assert.equal(await evaluate(`current!==null && current.pc===originalPeer && current.pc.connectionState==='connected' && current.eventChannel===originalChannel && captures===1 && current.audioInputTrack.enabled && originalTracks.every(track=>track.readyState==='live')`),true);
}
try{
  await fetch(base+'/__fixture/reset');await fetch(base+'/__fixture/image-success');await fetch(base+'/__fixture/large-images');
  await rpc('Page.enable');await rpc('Runtime.enable');
  await rpc('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await rpc('Page.navigate',{url:base});await waitFor(`document.readyState==='complete' && mode==='realtime'`);
  await evaluate(`window.narrations=[];speechSynthesis.speak=utterance=>{narrations.push({text:utterance.text,language:utterance.lang});setTimeout(()=>{utterance.onstart?.();utterance.onend?.();},5);};speechSynthesis.cancel=()=>{};window.captures=0;const capture=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=options=>{captures++;return capture(options);};window.confirm=()=>true;mode='preview';$('language').value='auto';$('sendVideo').checked=true;$('accessCode').value='coherent-parent-fixture';startMini();true`);
  await waitFor(`Boolean(current?.ready) && $('preview').videoWidth>0`);
  const offer='v=0\r\no=- 123 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\na=group:BUNDLE 0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=mid:0\r\na=sendrecv\r\n';
  const grant=await fetch(base+'/api/realtime/sdp',{method:'POST',headers:{'Content-Type':'application/sdp','X-Robot-Access-Code':'coherent-parent-fixture','X-Mini-Visuals':'true','X-Mini-Images':'true'},body:offer});
  assert.equal(grant.status,200);const token=grant.headers.get('X-Mini-Visual-Session');
  await evaluate(`(()=>{const s=current;window.originalTracks=s.localStream.getTracks();s.mode='realtime';s.mediaReady=true;s.visualsEnabled=true;s.imagesAllowed=true;s.visualGrant=${JSON.stringify(token)};s.language='auto';s.baseInstructions=extras.buildInstructions({language:'auto'});window.remoteAudible=false;s.audioMeter={isAudible:()=>remoteAudible,stop(){}};window.sentEvents=[];window.controlStats=[];s.eventChannel={readyState:'open',send:encoded=>{sentEvents.push(JSON.parse(encoded));controlStats.push({bytes:new TextEncoder().encode(encoded).byteLength,whileAudio:remoteAudible || s.playbackActive,visualStatus:s.generatedVisualContext?.status || null});setTimeout(()=>{if(current)receiveEvent(current,{type:'session.updated'},current.eventChannel);},1);}};window.originalChannel=s.eventChannel;s.pc={connectionState:'connected',sctp:{maxMessageSize:65536},close(){this.connectionState='closed';}};window.originalPeer=s.pc;window.mockedChatPlans=0;const request=window.fetch.bind(window);window.fetch=(url,init)=>{if(url==='/api/visual/image' && window.injectImageError){window.injectImageError=false;return Promise.resolve(new Response(JSON.stringify({error:'Temporary fixture image failure',diagnostic:{code:'IMAGE_HTTP_ERROR',stage:'artwork',httpStatus:503}}),{status:503,headers:{'Content-Type':'application/json'}}));}if(url==='/api/visual/plan' && !/^(?:Show me|画)/.test(JSON.parse(init.body).request)){mockedChatPlans++;return Promise.resolve(new Response(JSON.stringify({plan:{version:1,action:'keep'}}),{headers:{'Content-Type':'application/json'}}));}return request(url,init);};return true;})()`);

  await checkpoint('A ready image and camera frames continue while control updates wait for the audible reply to finish',async()=>{
    await turn('Show me a purple cat','A purple cat is coming. What should our cat do?',true);
    assert.equal(await evaluate(`generatedVisuals.describe().status`),'visible');
    assert.equal(await evaluate(`document.querySelector('#visualCanvas img').naturalWidth`),1024);
    const before=await evaluate(`$('preview').getVideoPlaybackQuality().totalVideoFrames`);
    await new Promise(resolve=>setTimeout(resolve,650));assert.equal(await evaluate(`sentEvents.length`),0);
    assert.equal(await evaluate(`$('preview').getVideoPlaybackQuality().totalVideoFrames>${before}`),true);
    await evaluate(`remoteAudible=false;onRemoteAudio(current,false);true`);
    await waitFor(`sentEvents.length===1 && !current.contextUpdatePending`);await healthy();
  });
  await checkpoint('Auto language switches to Mandarin and the next completed picture shares paced, bounded context',async()=>{
    await turn('请用中文回答','好呀，我们说中文。你喜欢什么颜色？');
    await turn('画一只蓝色猫','一只蓝色猫要来啦。它接下来做什么？');
    await waitFor(`sentEvents.length===2 && !current.contextUpdatePending`);
    assert.equal(await evaluate(`sessionLanguage()`),'zh');
    assert.equal(await evaluate(`controlStats.every(item=>item.bytes<=16384 && !item.whileAudio && item.visualStatus==='visible')`),true);await healthy();
  });
  await checkpoint('The exact reported invalid_request_error after acknowledgement pauses context instead of ending the session',async()=>{
    await evaluate(`receiveEvent(current,{type:'error',error:{type:'invalid_request_error'}});true`);
    assert.equal(await evaluate(`current.contextSyncDisabled && !current.contextUpdatePending`),true);
    assert.match(await evaluate(`$('modelDiagnostic').textContent`),/Voice session kept open/);await healthy();
  });
  await checkpoint('Twenty mixed English/Mandarin conversation turns keep the same voice/media session without settings retries',async()=>{
    for(let i=0;i<20;i++){
      await turn(i%2?'English please':'请用中文回答',i%2?'We can keep chatting. What is next?':'我们继续聊天。接下来呢？');
      await healthy();assert.equal(await evaluate(`$('remoteAudio').muted`),false);
    }
    assert.equal(await evaluate(`sentEvents.length`),2);assert.equal(await evaluate(`$('language').value`),'auto');
  });
  await checkpoint('A temporary image-service failure changes the picture status while voice and capture continue',async()=>{
    await evaluate(`window.injectImageError=true;true`);
    await turn('Show me a balloon','We can imagine a balloon. What colour should it be?');
    assert.equal(await evaluate(`generatedVisuals.describe().status`),'failed');
    assert.match(await evaluate(`$('visualServiceStatus').textContent`),/HTTP 503/);await healthy();
    assert.equal(await evaluate(`$('remoteAudio').muted`),false);
  });
  await checkpoint('More pictures still decode after optional context is paused',async()=>{
    await turn('Show me a happy robot','A robot is coming. Shall it hop or roll?');
    assert.equal(await evaluate(`generatedVisuals.describe().status`),'visible');
    await turn('请用中文回答','好呀。你想看什么？');
    await turn('画一颗微笑的星星','一颗微笑的星星要来啦。选什么颜色？');
    assert.equal(await evaluate(`generatedVisuals.describe().status`),'visible');
    assert.equal(await evaluate(`document.querySelector('#visualCanvas img').naturalWidth>0`),true);await healthy();
  });
  await checkpoint('The normal four-picture limit declines another picture while voice remains live',async()=>{
    await turn('Show me another cat','We can keep talking. Which animal next?');
    assert.equal(await evaluate(`generatedVisuals.describe().status`),'visible');
    assert.match(await evaluate(`$('visualRequestStatus').textContent`),/Pictures.*unavailable|enable pictures|图片|画图/i);await healthy();
    assert.equal(await evaluate(`$('remoteAudio').muted`),false);
    const state=await (await fetch(base+'/__fixture/state')).json();assert.equal(state.imageCalls,4);
  });
  await checkpoint('Another delayed rejection and returning to Mini do not revive context updates or reconnect',async()=>{
    await evaluate(`receiveEvent(current,{type:'error',error:{type:'invalid_request_error'}});$('visualExit').click();true`);
    await turn('Can we just talk?','Yes. What shall we imagine?');await healthy();
    assert.equal(await evaluate(`sentEvents.length`),2);
    assert.equal(await evaluate(`sentEvents.some(event=>event.type==='response.create')`),false);
  });
  const stats=await evaluate(`({controls:controlStats,childTurns:current.turnNumber,recoveredErrors:current.recoverableRequestErrors,mockedChatPlans,imageWidth:document.querySelector('#visualCanvas img')?.naturalWidth || 1024,trackingMetrics:current.trackingMetrics || null})`);
  await checkpoint('Stop releases tracks, revokes the fixture grant and cancels queued work',async()=>{
    await evaluate(`stopMini('Image/voice stability review complete');true`);
    assert.equal(await evaluate(`current===null && originalTracks.every(track=>track.readyState==='ended') && $('preview').srcObject===null`),true);
  });
  assert.deepEqual(errors,[]);
  await writeFile('/tmp/mini-image-voice-stability-results.json',JSON.stringify({scope:'local fixture; actual synthetic capture, active local tracking worker and decoded 1024px fixture PNGs; scripted ASR/voice/transport and provider rejection',results,stats,errors,paidCalls:0},null,2));
  console.log(`PASS: ${results.length} image/Auto voice stability scenarios; no live provider calls.`);
}finally{
  await evaluate(`if(current)stopMini('Stability review complete');true`).catch(()=>{});ws.close();
}
