import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';

// Local proactive companion review. Use companion-smoke-server.mjs and
// synthetic-media Chromium on CDP 9228. No paid provider calls or private media.
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
  for(let attempt=0;attempt<440;attempt++){
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
async function turn(text,reply='A cat has whiskers.'){
  await evaluate(`(()=>{const s=current;receiveEvent(s,{type:'input_audio_buffer.speech_started'});receiveEvent(s,{type:'input_audio_buffer.speech_stopped'});receiveEvent(s,{type:'conversation.item.input_audio_transcription.completed',transcript:${JSON.stringify(text)}});receiveEvent(s,{type:'response.created',response:{id:'reply-'+s.turnNumber}});receiveEvent(s,{type:'response.audio_transcript.done',transcript:${JSON.stringify(reply)}});onRemoteAudio(s,true);receiveEvent(s,{type:'response.done',response:{status:'completed'}});onRemoteAudio(s,false);return true;})()`);
  await waitFor(`!childUI.isSpeakingLocally()`);
}
async function checkpoint(name,fn){await fn();results.push(name);console.log('PASS: '+name);}
async function screenshot(name){
  const shot=await rpc('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
  await writeFile('/tmp/mini-proactive-'+name+'.png',Buffer.from(shot.data,'base64'));
}
try{
  await fetch(base+'/__fixture/reset');await rpc('Page.enable');await rpc('Runtime.enable');
  await rpc('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await rpc('Page.navigate',{url:base});await waitFor(`document.readyState==='complete' && Boolean(window.MiniLearning)`);
  await evaluate(`window.narrations=[];speechSynthesis.speak=utterance=>{narrations.push({text:utterance.text,language:utterance.lang});setTimeout(()=>{utterance.onstart?.();utterance.onend?.();},5);};speechSynthesis.cancel=()=>{};window.captures=0;const capture=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=options=>{captures++;return capture(options);};window.confirm=()=>true;mode='preview';$('sendVideo').checked=true;$('language').value='auto';$('accessCode').value='coherent-parent-fixture';startMini();true`);
  await waitFor(`Boolean(current?.ready) && $('preview').videoWidth>0`);
  await evaluate(`(()=>{const s=current;s.awareness?.stop();s.awareness=null;window.originalTracks=s.localStream.getTracks();s.mode='realtime';s.mediaReady=true;s.visualsEnabled=false;s.imagesAllowed=false;s.awarenessEnabled=true;s.spokenGreetings=true;s.language='auto';s.baseInstructions=extras.buildInstructions({language:'auto'});s.audioMeter={isAudible:()=>false,stop(){}};window.sentEvents=[];s.eventChannel={readyState:'open',send:encoded=>{sentEvents.push(JSON.parse(encoded));setTimeout(()=>{if(current)receiveEvent(current,{type:'session.updated'},current.eventChannel);},1);}};s.pc={connectionState:'connected',close(){this.connectionState='closed';}};return true;})()`);

  // Exercise the real capture/geometry/cooldown/UI path with synthetic landmark
  // output. Real MediaPipe inference is covered separately by the full smoke.
  await evaluate(`window.testFace=smile=>{const p=Array.from({length:468},()=>({x:.5,y:.5}));Object.assign(p,{234:{x:.25,y:.5},454:{x:.75,y:.5},10:{x:.5,y:.2},152:{x:.5,y:.8},61:{x:smile?.39:.42,y:smile?.59:.61},291:{x:smile?.61:.58,y:smile?.59:.61},13:{x:.5,y:.61},14:{x:.5,y:.63},33:{x:.32,y:.4},133:{x:.43,y:.4},159:{x:.375,y:.38},145:{x:.375,y:.42},362:{x:.57,y:.4},263:{x:.68,y:.4},386:{x:.625,y:.38},374:{x:.625,y:.42}});return p;};window.probePoints=testFace(false);window.probeFrames=0;const local=MiniLocalAwareness;window.MiniLocalAwareness={...local,start:options=>local.start({...options,worker:{postMessage(message){if(message.type==='start')setTimeout(()=>this.onmessage({data:{type:'ready'}}),1);if(message.type==='frame'){message.bitmap.close();setTimeout(()=>{this.onmessage({data:{type:'landmarks',points:probePoints}});this.onmessage({data:{type:'done'}});probeFrames++;},1);}},terminate(){}}})};current.responseActive=true;startAwareness(current);true`);
  await checkpoint('Visible smiles animate Mini during a reply without starting overlapping speech',async()=>{
    await waitFor(`probeFrames>=2`);await evaluate(`probePoints=testFace(true);true`);
    await waitFor(`$('robotFace').dataset.cameraSmile==='true' && $('robotFace').dataset.expression==='happy'`);
    assert.equal(await evaluate(`narrations.length`),0);await screenshot('smile');
  });
  await checkpoint('The fresh smile speaks one playful invitation once the conversation is quiet',async()=>{
    await evaluate(`current.responseActive=false;current.awarenessLastActivity=Date.now()-7000;true`);
    await waitFor(`narrations.some(item=>/spotted a smile/.test(item.text))`);
    assert.equal(await evaluate(`current.cameraInvitations`),1);
    assert.equal(await evaluate(`current.localPrompt.kind`),'camera');
  });
  await checkpoint('Head movement updates the eyes while speech cooldown prevents a second interruption',async()=>{
    const before=await evaluate(`$('robotFace').style.getPropertyValue('--look-x')`);
    await evaluate(`probePoints=testFace(false).map(point=>({...point,x:point.x+.08}));true`);
    await waitFor(`$('robotFace').style.getPropertyValue('--look-x')!==${JSON.stringify(before)}`);
    assert.equal(await evaluate(`current.cameraInvitations`),1);
    await evaluate(`current.awareness.stop();current.awareness=null;true`);
  });
  await checkpoint('Chat offers an animal play idea with Pictures and visual planning off',async()=>{
    await turn('cat');await waitFor(`current.localPrompt.kind==='conversation' && current.localPrompt.turn===current.turnNumber`);
    await waitFor(`!childUI.isSpeakingLocally()`);
    assert.match(await evaluate(`current.localPrompt.text`),/animal|moon cat|garden dinosaur/);
  });
  await checkpoint('Early chat naturally produces a checked maths question without a provider request',async()=>{
    await turn('I like cats','We can imagine an animal adventure.');
    await waitFor(`current.learning.hasQuestion()`);
    await waitFor(`!childUI.isSpeakingLocally()`);
    assert.equal(await evaluate(`current.learning.checkpoint('en').pending.domain`),'math');
    assert.match(await evaluate(`current.localPrompt.text`),/2, and 1 more join/);await screenshot('maths');
  });
  await checkpoint('A mistaken answer receives a helpful counting hint, not a false success',async()=>{
    await turn('four','Four is correct!');
    assert.equal(await evaluate(`current.learning.checkpoint('en').lastResult`),'hint');
    assert.match(await evaluate(`$('assistantTranscript').textContent`),/count on 1/);
    assert.doesNotMatch(await evaluate(`$('assistantTranscript').textContent`),/Four is correct/);
  });
  await checkpoint('Mandarin switching retains the challenge and accepts a short Mandarin answer',async()=>{
    await turn('请用中文回答','好呀。');assert.equal(await evaluate(`sessionLanguage()`),'zh');
    assert.match(await evaluate(`current.learning.prompt('zh')`),/一共有几位/);
    await turn('三','错误的示范回答');assert.equal(await evaluate(`current.learning.checkpoint('zh').lastResult`),'correct');
    assert.match(await evaluate(`$('assistantTranscript').textContent`),/2加1等于3/);
    assert.match(await evaluate(`narrations.at(-1).language`),/^zh/);await screenshot('mandarin-answer');
  });
  await checkpoint('A requested science turn teaches a fact and checks the child’s answer in Mandarin',async()=>{
    await turn('我想学有关太阳的科学','不应播放的云端回答');
    assert.equal(await evaluate(`current.learning.checkpoint('zh').pending.id`),'sun-star');
    await turn('行星','行星是对的');assert.equal(await evaluate(`current.learning.checkpoint('zh').lastResult`),'hint');
    await turn('恒星','另一个不应播放的回答');
    assert.equal(await evaluate(`current.learning.checkpoint('zh').lastResult`),'correct');
    assert.match(await evaluate(`$('assistantTranscript').textContent`),/太阳是恒星/);await screenshot('science');
  });
  await checkpoint('The child can skip a lesson without losing the original microphone or camera',async()=>{
    await turn('教我数学');await turn('跳过');
    assert.equal(await evaluate(`!current.learning.hasQuestion() && captures===1 && current.audioInputTrack.enabled && originalTracks.every(t=>t.readyState==='live')`),true);
  });
  await checkpoint('A quiet child gets one helpful hint and silence is not scored as a mistake',async()=>{
    await turn('教我数学');await waitFor(`Boolean(current.quietTimer)`);
    const before=await evaluate(`narrations.length`);
    await waitFor(`narrations.length>${before}`);
    assert.equal(await evaluate(`current.learning.checkpoint('zh').pending.attempts`),0);
    assert.equal(await evaluate(`current.followUpTurn===current.turnNumber && current.quietTimer===null`),true);
    await evaluate(`scheduleQuietSupport(current,current.localPrompt.text);true`);
    assert.equal(await evaluate(`current.quietTimer===null`),true);
  });
  await checkpoint('Local invitation context reaches voice instructions without another model response',async()=>{
    await waitFor(`!current.contextUpdatePending`);
    assert.equal(await evaluate(`sentEvents.some(event=>event.type==='session.update' && event.session.instructions.includes('App-spoken invitation data'))`),true);
    assert.equal(await evaluate(`sentEvents.some(event=>event.type==='response.create')`),false);
  });
  await checkpoint('Learning narration, face and Stop fit four phone layouts',async()=>{
    for(const [width,height] of [[320,568],[390,844],[430,932],[844,390]]){
      await rpc('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});
      assert.equal(await evaluate(`document.body.scrollWidth<=innerWidth && $('kidStopBtn').getBoundingClientRect().bottom<=innerHeight`),true,String(width));
    }
  });
  await checkpoint('Goodbye cancels all prompts, clears learning state and releases every capture track',async()=>{
    await evaluate(`window.oldSession=current;receiveEvent(current,{type:'conversation.item.input_audio_transcription.completed',transcript:'拜拜'});true`);
    assert.equal(await evaluate(`current===null && oldSession.learning===null && oldSession.localPrompt===null && oldSession.quietTimer===null && originalTracks.every(t=>t.readyState==='ended')`),true);
  });
  const providerState=await (await fetch(base+'/__fixture/state')).json();
  assert.equal(providerState.plans.length,0);assert.equal(providerState.imageCalls,0);assert.deepEqual(errors,[]);
  await writeFile('/tmp/mini-proactive-results.json',JSON.stringify({scope:'local fixture; real synthetic capture; scripted ASR/voice and landmark output; real 6/14-second waits',results,errors,providerPlans:0,providerImages:0},null,2));
  console.log(`PASS: ${results.length} proactive companion scenarios; no provider calls.`);
}finally{
  await evaluate(`if(current)stopMini('Review complete');true`).catch(()=>{});ws.close();
}
