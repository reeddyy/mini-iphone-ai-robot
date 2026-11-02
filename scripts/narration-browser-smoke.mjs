import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';

// Local voice-selection/game narration checks. Synthetic capture and scripted
// voice engines, no live provider calls. Use the fixture and Chromium on 9228.
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
  await checkpoint('An empty voice list waits while the microphone remains live, then selects Samantha over Daniel',async()=>{
    await evaluate(`childUI.sayFallback('chat','Hello! Which animal do you like?','en');true`);
    await new Promise(resolve=>setTimeout(resolve,180));
    assert.equal(await evaluate(`spoken.length===0 && current.audioInputTrack.enabled`),true);
    await evaluate(`voiceCatalog=[{name:'Daniel',lang:'en-GB',voiceURI:'fixture-daniel',default:true},{name:'Samantha',lang:'en-US',voiceURI:'fixture-samantha'},{name:'Tingting',lang:'zh-CN',voiceURI:'fixture-tingting'}];speechSynthesis.dispatchEvent(new Event('voiceschanged'));true`);
    await waitFor(`spoken.length===1 && !childUI.isSpeakingLocally()`);
    assert.equal(await evaluate(`spoken[0].name`),'Samantha');
    assert.equal(await evaluate(`spoken[0].rate===1 && spoken[0].pitch===1`),true);
  });
  await checkpoint('The tic-tik-toe request keeps that voice and speaks cross/circle words with remote audio muted',async()=>{
    await evaluate(`voiceCatalog.unshift({name:'Serena',lang:'en-GB',voiceURI:'fixture-serena'});true`);
    await turn('Can we play tic tik toe?','I am making a different imaginary move.');
    assert.equal(await evaluate(`visualActivity.isActive() && $('remoteAudio').muted && current.localVisualTurn`),true);
    assert.equal(await evaluate(`spoken.at(-1).name`),'Samantha');
    assert.match(await evaluate(`spoken.at(-1).text`),/You play crosses\. Mini plays circles/);
  });
  await checkpoint('A real board tap narrates the exact circle move in the same voice',async()=>{
    const before=await evaluate(`spoken.length`);await click('#ticBoard button:nth-child(1)');
    await waitFor(`visualActivity.state().board.filter(Boolean).length===2 && spoken.length>${before} && !childUI.isSpeakingLocally()`);
    assert.match(await evaluate(`spoken.at(-1).text`),/Mini put a circle in the center square/);
    assert.equal(await evaluate(`spoken.at(-1).name`),'Samantha');
  });
  await checkpoint('Rapid New round taps cancel superseded narration without clipping the final sentence',async()=>{
    const before=await evaluate(`spoken.length`);
    await evaluate(`$('boardReplay').click();$('boardReplay').click();$('boardReplay').click();true`);
    await waitFor(`spoken.length>${before} && !childUI.isSpeakingLocally()`);
    assert.equal(await evaluate(`spoken.length`),before+1);assert.equal(await evaluate(`clipped`),0);
  });
  await checkpoint('Mandarin game narration uses Tingting and retains the same capture',async()=>{
    await turn('请用中文回答','好呀。');
    await evaluate(`$('boardReplay').click();true`);await waitFor(`!childUI.isSpeakingLocally()`);
    assert.equal(await evaluate(`spoken.at(-1).name`),'Tingting');assert.match(await evaluate(`spoken.at(-1).text`),/你是叉，Mini 是圆/);
    assert.equal(await evaluate(`captures===1 && originalTracks.every(track=>track.readyState==='live') && current.audioInputTrack.enabled`),true);
  });
  await checkpoint('Leaving the board restores the regular live-audio path',async()=>{
    await turn('Can we just talk?','Of course.');
    assert.equal(await evaluate(`!visualActivity.isActive() && !$('remoteAudio').muted && !isLocalReply(current)`),true);
  });
  await checkpoint('English maths uses the original pinned English voice after the game and a language switch',async()=>{
    await turn('English please','Of course.');await turn('Teach me maths');
    assert.equal(await evaluate(`spoken.at(-1).name`),'Samantha');await turn('three','An incorrect remote answer.');
    assert.equal(await evaluate(`current.learning.checkpoint('en').lastResult`),'correct');
    assert.equal(await evaluate(`spoken.at(-1).name`),'Samantha');assert.match(await evaluate(`spoken.at(-1).text`),/2 plus 1 makes 3/);
    assert.match(await evaluate(`$('narrationVoiceStatus').textContent`),/Samantha.*en-US/);
  });
  await checkpoint('Stop cancels queued narration, releases all tracks and makes no paid requests',async()=>{
    const before=await evaluate(`spoken.length`);
    await evaluate(`childUI.sayFallback('chat','This cancelled speech must never play.','en');stopMini('Voice review complete');true`);
    await new Promise(resolve=>setTimeout(resolve,250));
    assert.equal(await evaluate(`spoken.length`),before);
    assert.equal(await evaluate(`current===null && originalTracks.every(track=>track.readyState==='ended')`),true);
    assert.equal(await evaluate(`sentEvents.some(event=>event.type==='response.create')`),false);
    const fixture=await (await fetch(base+'/__fixture/state')).json();assert.equal(fixture.plans.length,0);assert.equal(fixture.imageCalls,0);
  });
  assert.deepEqual(errors,[]);
  const utterances=await evaluate(`spoken`);
  await writeFile('/tmp/mini-narration-results.json',JSON.stringify({scope:'local fixture; real synthetic capture, scripted ASR and speech engine/voice catalog; actual sound unverified',results,utterances,clipped:await evaluate(`clipped`),errors,providerPlans:0,providerImages:0},null,2));
  console.log(`PASS: ${results.length} voice/game browser scenarios; no provider calls.`);
}finally{
  await evaluate(`if(current)stopMini('Voice review complete');true`).catch(()=>{});ws.close();
}
