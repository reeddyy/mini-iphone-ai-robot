import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';

// Local replay only: run companion-smoke-server.mjs and synthetic Chromium on
// CDP 9228. All Qwen calls, speech recognition and voice playback are fixtures.
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
async function turn(request,reply='Let us play.'){
  await evaluate(`(()=>{const s=current;receiveEvent(s,{type:'input_audio_buffer.speech_started'});receiveEvent(s,{type:'input_audio_buffer.speech_stopped'});receiveEvent(s,{type:'conversation.item.input_audio_transcription.completed',transcript:${JSON.stringify(request)}});receiveEvent(s,{type:'response.created',response:{id:'reply-'+s.turnNumber}});receiveEvent(s,{type:'response.audio_transcript.done',transcript:${JSON.stringify(reply)}});onRemoteAudio(s,true);receiveEvent(s,{type:'response.done',response:{status:'completed'}});onRemoteAudio(s,false);return true;})()`);
  await waitFor(`!current.pendingVisualTurn && !current.visualPlanning`);
}
async function checkpoint(name,fn){await fn();results.push(name);console.log('PASS: '+name);}
async function state(){return (await fetch(base+'/__fixture/state')).json();}
try{
  await fetch(base+'/__fixture/reset');await fetch(base+'/__fixture/image-success');
  await rpc('Page.enable');await rpc('Runtime.enable');
  await rpc('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await rpc('Page.navigate',{url:base});await waitFor(`document.readyState==='complete' && mode==='realtime'`);
  await evaluate(`window.narrations=[];speechSynthesis.speak=utterance=>{narrations.push({text:utterance.text,language:utterance.lang});setTimeout(()=>{utterance.onstart?.();utterance.onend?.();},5);};speechSynthesis.cancel=()=>{};window.captures=0;const capture=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=options=>{captures++;return capture(options);};window.confirm=()=>true;mode='preview';$('sendVideo').checked=true;$('accessCode').value='coherent-parent-fixture';startMini();true`);
  await waitFor(`Boolean(current?.ready) && $('preview').videoWidth>0`);
  const offer='v=0\r\no=- 123 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\na=group:BUNDLE 0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=mid:0\r\na=sendrecv\r\n';
  const grant=await fetch(base+'/api/realtime/sdp',{method:'POST',headers:{'Content-Type':'application/sdp','X-Robot-Access-Code':'coherent-parent-fixture','X-Mini-Visuals':'true','X-Mini-Images':'true'},body:offer});
  assert.equal(grant.status,200);
  const token=grant.headers.get('X-Mini-Visual-Session');
  await evaluate(`(()=>{const s=current;window.originalTracks=s.localStream.getTracks();s.mode='realtime';s.mediaReady=true;s.visualsEnabled=true;s.imagesAllowed=true;s.visualGrant=${JSON.stringify(token)};s.language='auto';s.baseInstructions=extras.buildInstructions({language:'auto'});window.sentEvents=[];s.eventChannel={readyState:'open',send:encoded=>{sentEvents.push(JSON.parse(encoded));setTimeout(()=>{if(current)receiveEvent(current,{type:'session.updated'},current.eventChannel);},1);}};s.pc={connectionState:'connected',close(){this.connectionState='closed';}};return true;})()`);

  await checkpoint('Replayed live story plan renders a decoded fixture image and two choices',async()=>{
    await turn('Replay Lumi story','Lumi the blue dinosaur has a yellow backpack.');
    assert.equal(await evaluate(`generatedVisuals.describe().status==='visible' && document.querySelector('#visualCanvas img').naturalWidth>0 && document.querySelectorAll('#visualChoices button').length===2`),true);
  });
  await checkpoint('Tapping the captured empty-message continuation narrates its visible title',async()=>{
    await click('#visualChoices button');await waitFor(`!current.visualPlanning && narrations.some(n=>n.text==='Lumi Crosses the Rainbow Bridge')`);
    assert.equal(await evaluate(`generatedVisuals.current().message==='' && $('visualTitle').textContent==='Lumi Crosses the Rainbow Bridge'`),true);
  });
  await click('#visualExit');
  await checkpoint('Exactly three apples count once per tap',async()=>{
    await turn('我想数三个苹果，给我三个可以点击计数的苹果。','我们来数三个苹果。');
    for(let i=1;i<=3;i++)await click('.visual-count-item:nth-child('+i+')');
    await evaluate(`document.querySelector('.visual-count-item').click();true`);
    assert.equal(await evaluate(`$('visualResult').textContent`),'3 / 3');
  });
  await checkpoint('An ordinary one-word answer preserves the game and Mandarin',async()=>{
    await turn('cat','Cat 就是小猫。');
    assert.equal(await evaluate(`generatedVisuals.current().activity.type==='count' && sessionLanguage()==='zh'`),true);
  });
  await checkpoint('Mandarin chat exit bypasses the captured keep response and preserves capture',async()=>{
    const before=(await state()).plans.length;
    await turn('我不想数了，我们聊聊天吧。','好呀，我们聊聊天。');
    assert.equal((await state()).plans.length,before,'no planner request for an explicit chat exit');
    assert.equal(await evaluate(`!generatedVisuals.isActive() && !current.localVisualTurn && !$('remoteAudio').muted && current.audioInputTrack.enabled && captures===1 && originalTracks.every(t=>t.readyState==='live')`),true);
    const shot=await rpc('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
    await writeFile('/tmp/mini-child-fixed-chat-exit.png',Buffer.from(shot.data,'base64'));
  });
  await checkpoint('One-round hand game reports its locally computed winner',async()=>{
    await turn('Replay one-round hand game','Choose rock, paper or scissors.');await click('#visualChoices button');
    assert.equal(await evaluate(`current.generatedVisualContext.winner===MiniVisuals.handResult(generatedVisuals.current().activity.moves,current.generatedVisualContext.child,current.generatedVisualContext.mini)`),true);
  });
  await checkpoint('A chat-exit transcript arriving after response.created unmutes the current reply',async()=>{
    const before=(await state()).plans.length;
    await evaluate(`(()=>{const s=current;receiveEvent(s,{type:'input_audio_buffer.speech_started'});receiveEvent(s,{type:'input_audio_buffer.speech_stopped'});receiveEvent(s,{type:'response.created',response:{id:'early-reply'}});receiveEvent(s,{type:'conversation.item.input_audio_transcription.completed',transcript:'Can we just talk?'});return true;})()`);
    assert.equal(await evaluate(`!generatedVisuals.isActive() && !current.localVisualTurn && !current.playbackSuppressed && !$('remoteAudio').muted`),true);
    assert.equal((await state()).plans.length,before);
    await evaluate(`receiveEvent(current,{type:'response.done',response:{status:'completed'}});true`);
  });
  await checkpoint('Mandarin also exits the local board without a new capture or planner call',async()=>{
    const before=(await state()).plans.length;
    await turn('Can we play tic tac toe?');assert.equal(await evaluate(`visualActivity.isActive()`),true);
    await turn('我们聊聊天吧。','好呀。');
    assert.equal(await evaluate(`!visualActivity.isActive() && !generatedVisuals.isActive() && captures===1 && current.audioInputTrack.enabled`),true);
    assert.equal((await state()).plans.length,before);
  });
  await checkpoint('Goodbye releases all tracks without another paid response or automatic restart',async()=>{
    await evaluate(`receiveEvent(current,{type:'conversation.item.input_audio_transcription.completed',transcript:'Bye Mini'});true`);
    assert.equal(await evaluate(`current===null && originalTracks.every(t=>t.readyState==='ended') && $('preview').srcObject===null && $('assistantTranscript').textContent==='—'`),true);
    assert.equal(await evaluate(`sentEvents.some(event=>event.type==='response.create')`),false);
  });
  assert.deepEqual(errors,[]);
  await writeFile('/tmp/mini-child-replay-results.json',JSON.stringify({scope:'local fixture; synthetic capture and scripted voice',results,errors},null,2));
  console.log(`PASS: ${results.length} child-journey replay checkpoints; no live provider requests.`);
}finally{
  await evaluate(`if(current)stopMini('Replay complete');true`).catch(()=>{});
  ws.close();
}
