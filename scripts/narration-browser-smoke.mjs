import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';

// Live sessions use Tina only; local helpers are visual. Synthetic capture and
// scripted ASR/transport, no live provider calls. Fixture + Chromium on 9228.
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
async function turn(text,reply='Let us play.'){
  await evaluate(`(()=>{const s=current;receiveEvent(s,{type:'input_audio_buffer.speech_started'});receiveEvent(s,{type:'input_audio_buffer.speech_stopped'});receiveEvent(s,{type:'conversation.item.input_audio_transcription.completed',transcript:${JSON.stringify(text)}});receiveEvent(s,{type:'response.created',response:{id:'reply-'+s.turnNumber}});receiveEvent(s,{type:'response.audio_transcript.done',transcript:${JSON.stringify(reply)}});onRemoteAudio(s,true);receiveEvent(s,{type:'response.done',response:{status:'completed'}});onRemoteAudio(s,false);return true;})()`);
  await waitFor(`!childUI.isSpeakingLocally()`);
}
async function checkpoint(name,fn){await fn();results.push(name);console.log('PASS: '+name);}
try{
  await fetch(base+'/__fixture/reset');await rpc('Page.enable');await rpc('Runtime.enable');
  await rpc('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await rpc('Page.navigate',{url:base});await waitFor(`document.readyState==='complete' && mode==='realtime'`);
  await evaluate(`window.spoken=[];window.clipped=0;window.lastCancel=-Infinity;window.voiceCatalog=[];
    window.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};
    speechSynthesis.getVoices=()=>voiceCatalog;
    speechSynthesis.cancel=()=>{lastCancel=performance.now();};
    speechSynthesis.speak=utterance=>{const sinceCancel=performance.now()-lastCancel;if(sinceCancel<50){clipped++;return;}spoken.push({text:utterance.text,name:utterance.voice?.name || 'default',language:utterance.lang,rate:utterance.rate,pitch:utterance.pitch,sinceCancel});setTimeout(()=>utterance.onstart?.(),5);setTimeout(()=>utterance.onend?.(),35);};
    window.captures=0;const capture=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=options=>{captures++;return capture(options);};window.confirm=()=>true;mode='preview';$('language').value='auto';$('sendVideo').checked=true;$('accessCode').value='coherent-parent-fixture';startMini();true`);
  await waitFor(`Boolean(current?.ready) && $('preview').videoWidth>0`);
  await evaluate(`(()=>{const s=current;s.awareness?.stop();s.awareness=null;window.originalTracks=s.localStream.getTracks();s.mode='realtime';s.mediaReady=true;s.visualsEnabled=false;s.imagesAllowed=false;s.language='auto';s.baseInstructions=extras.buildInstructions({language:'auto'});s.audioMeter={isAudible:()=>false,stop(){}};window.sentEvents=[];s.eventChannel={readyState:'open',send:encoded=>{sentEvents.push(JSON.parse(encoded));setTimeout(()=>{if(current)receiveEvent(current,{type:'session.updated'},current.eventChannel);},1);}};s.pc={connectionState:'connected',close(){this.connectionState='closed';}};return true;})()`);
  await checkpoint('The opening stays on screen with Tina configured and no device speech',async()=>{
    await evaluate(`current.sessionCreated=true;current.updateSent=false;tryInitialize(current);childUI.sayFallback('chat','Hello! Which animal do you like?','en');true`);
    await new Promise(resolve=>setTimeout(resolve,180));
    assert.equal(await evaluate(`spoken.length===0 && current.audioInputTrack.enabled && !childUI.isSpeakingLocally()`),true);
    assert.equal(await evaluate(`sentEvents.find(event=>event.session?.audio)?.session.audio.output.voice`),'Tina');
    assert.match(await evaluate(`$('kidHint').textContent`),/Which animal/);
    await evaluate(`voiceCatalog=[{name:'Daniel',lang:'en-GB',voiceURI:'fixture-daniel',default:true},{name:'Samantha',lang:'en-US',voiceURI:'fixture-samantha'},{name:'Tingting',lang:'zh-CN',voiceURI:'fixture-tingting'}];speechSynthesis.dispatchEvent(new Event('voiceschanged'));true`);
    assert.equal(await evaluate(`spoken.length`),0);
  });
  await checkpoint('Tic-tik-toe shows cross/circle cues and suppresses conflicting remote moves',async()=>{
    await turn('Can we play tic tik toe?','I am making a different imaginary move.');
    assert.equal(await evaluate(`visualActivity.isActive() && $('remoteAudio').muted && current.localVisualTurn`),true);
    assert.match(await evaluate(`$('kidHint').textContent`),/You play crosses\. Mini plays circles/);
    assert.equal(await evaluate(`spoken.length`),0);
  });
  await checkpoint('A board tap shows the exact circle move without a second voice',async()=>{
    await click('#ticBoard button:nth-child(1)');
    await waitFor(`visualActivity.state().board.filter(Boolean).length===2`);
    assert.match(await evaluate(`$('kidHint').textContent`),/Mini put a circle in the center square/);
    assert.equal(await evaluate(`spoken.length`),0);
  });
  await checkpoint('Rapid New round taps keep a fresh board and a single visual cue',async()=>{
    await evaluate(`$('boardReplay').click();$('boardReplay').click();$('boardReplay').click();true`);
    assert.equal(await evaluate(`visualActivity.state().board.filter(Boolean).length`),0);
    assert.match(await evaluate(`$('kidHint').textContent`),/You play crosses/);
    assert.equal(await evaluate(`spoken.length`),0);
  });
  await checkpoint('Mandarin game cues remain visual and retain the original capture',async()=>{
    await turn('请用中文回答','好呀。');
    await evaluate(`$('boardReplay').click();true`);
    assert.match(await evaluate(`$('kidHint').textContent`),/你是叉，Mini 是圆/);
    assert.equal(await evaluate(`spoken.length===0 && captures===1 && originalTracks.every(track=>track.readyState==='live') && current.audioInputTrack.enabled`),true);
  });
  await checkpoint('Leaving the board restores Tina’s ordinary live-audio path',async()=>{
    await turn('Can we just talk?','Of course.');
    assert.equal(await evaluate(`!visualActivity.isActive() && !$('remoteAudio').muted && !isLocalReply(current)`),true);
  });
  await checkpoint('Checked maths captions persist after completion without speaking or disabling the microphone',async()=>{
    await turn('English please','Of course.');await turn('Teach me maths');
    assert.equal(await evaluate(`current.learning.hasQuestion()`),true);
    await turn('three','An incorrect remote answer.');
    assert.equal(await evaluate(`current.learning.checkpoint('en').lastResult`),'correct');
    await new Promise(resolve=>setTimeout(resolve,1100));
    assert.match(await evaluate(`$('kidHint').textContent`),/2 plus 1 makes 3/);
    assert.equal(await evaluate(`spoken.length===0 && current.audioInputTrack.enabled`),true);
    assert.match(await evaluate(`$('narrationVoiceStatus').textContent`),/Voice: Tina.*live companion/);
  });
  await checkpoint('Stop clears cues and capture; late voice catalogs cannot speak or restart',async()=>{
    await evaluate(`childUI.sayFallback('chat','This cancelled cue must never play.','en');stopMini('Single-voice review complete');speechSynthesis.dispatchEvent(new Event('voiceschanged'));true`);
    await new Promise(resolve=>setTimeout(resolve,250));
    assert.equal(await evaluate(`spoken.length`),0);
    assert.equal(await evaluate(`current===null && originalTracks.every(track=>track.readyState==='ended')`),true);
    assert.equal(await evaluate(`sentEvents.some(event=>event.type==='response.create')`),false);
    const fixture=await (await fetch(base+'/__fixture/state')).json();assert.equal(fixture.plans.length,0);assert.equal(fixture.imageCalls,0);
  });
  assert.deepEqual(errors,[]);
  await writeFile('/tmp/mini-single-voice-results-2026-11-03.json',JSON.stringify({scope:'local fixture; real synthetic capture; scripted ASR/transport and voice catalog; no actual Qwen audio or physical Safari verification',results,deviceUtterances:await evaluate(`spoken.length`),captures:await evaluate(`captures`),configuredLiveVoice:await evaluate(`sentEvents.find(event=>event.session?.audio)?.session.audio.output.voice`),errors,providerPlans:0,providerImages:0},null,2));
  console.log(`PASS: ${results.length} single-voice/game browser scenarios; no provider calls.`);
}finally{
  await evaluate(`if(current)stopMini('Single-voice review complete');true`).catch(()=>{});ws.close();
}
