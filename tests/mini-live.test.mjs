import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

const app=readFileSync(fileURLToPath(new URL('../public/app.js',import.meta.url)),'utf8');
function mockEnvironment() {
  const sent=[];
  const calls=[];
  const elements=new Map();
  const timeouts=new Map();
  let timeoutId=0;
  const setFakeTimeout=(fn,ms)=>{const id=++timeoutId;timeouts.set(id,{fn,ms});return id;};
  const clearFakeTimeout=id=>{timeouts.delete(id);};
  const flushTimeouts=(maxDelay=Infinity)=>{
    const ready=[...timeouts].filter(([,item])=>item.ms<=maxDelay);
    for(const [id,item] of ready) {
      if (timeouts.delete(id)) item.fn();
    }
  };
  const fake=()=>{
    const classes=new Set();
    return {
    textContent:'',value:'',checked:false,disabled:false,srcObject:null,dataset:{},
    className:'',
    classList:{toggle(name,force){if(force)classes.add(name);else classes.delete(name);},add(name){classes.add(name);},remove(name){classes.delete(name);},contains:name=>classes.has(name)},
    style:{setProperty(){},removeProperty(){}},
    addEventListener(){},append(){},pause(){},play(){return Promise.resolve();},
    setAttribute(){},querySelectorAll(){return this.cells || (this.cells=Array.from({length:9},fake));},
    showModal(){this.open=true;},close(){this.open=false;},
  }};
  const get=id=>{if(!elements.has(id))elements.set(id,fake());return elements.get(id)};
  const document={
    getElementById:get,
    querySelector:()=>get('shell'),
    createElement:()=>fake(),
    createTextNode:text=>text,
    addEventListener(){},
  };
  let eventId=0;
  let visualOptions;
  const visualRenderer={plan:null,clear(){this.plan=null;},cancelPending(){},setBusy(){},isActive(){return Boolean(this.plan);},current(){return this.plan;},describe(){return this.plan?{action:this.plan.action,title:this.plan.title}:null;},
    async apply(plan){
      if(plan.action==='keep')return;
      if(plan.action==='clear'){this.clear();visualOptions.onExit();return;}
      if(plan.activity?.type==='tictactoe'){visualOptions.openBoard();return;}
      this.plan=plan;calls.push(['visual',plan.action]);visualOptions.onStart();visualOptions.onStateChange(this.describe());
    }};
  const companionUI={
    onStatus(x){calls.push(['status',x.state]);},
    onActivityStart(mode,queued){calls.push(['activity',mode,Boolean(queued)]);},
    onResponseStarted(){calls.push(['response_started']);},
    onResponseFinished(){calls.push(['response_done']);},
    onVoiceDetected(v){calls.push(['voice',v]);},
    onTranscription(text){calls.push(['transcript',text]);},
    reactToVisualCue(cue){calls.push(['visual_cue',cue.cue]);return true;},
    sayFallback(mode,phrase,language){calls.push(['fallback',mode,phrase,language]);},
    sayFollowUp(mode,question,lang){calls.push(['followup',mode,question,lang]);return true;},
    onLiveReady(){calls.push(['ready']);},
    onSessionEnded(){calls.push(['ended']);},
    onTimeRemaining(seconds){calls.push(['remaining',seconds]);},
    stopSpeech(){},
    onMicLevel(){},
    syncLanguage(){},
  };
  const ctx=vm.createContext({
    document,
    window:{
      MiniExtras:{
        MAX_SESSION_MINUTES:60,
        loadSavedNote(){return null;},
        createVoiceMeter(){return null;},
        createMicInputMeter(){return null;},
        durationMinutes(){return 15;},
        silenceDuration(){return 500;},
        speechThreshold(){return 0.25;},
        boundedNote(){return '';},
        buildInstructions(){return 'family-safe instructions';},
        modelErrorDetails(e){return {code:e?.code||'unknown',type:e?.type||'unknown',param:e?.param||''};},
      },
      MiniChildUI:{init:()=>companionUI},
      MiniVisuals:{init:options=>{visualOptions=options;return visualRenderer;}},
      addEventListener(){},
      scrollTo(){},
      isSecureContext:true,
    },
    fetch:async()=>({ok:true,json:async()=>({mode:'realtime',model:'test',maxSessionMinutes:60})}),
    crypto:{randomUUID:()=>String(++eventId)},
    performance:{now:()=>1000},
    console,clearTimeout:clearFakeTimeout,setTimeout:setFakeTimeout,setInterval,clearInterval,Date,
    AbortController,Uint8Array,
  });
  vm.runInContext(readFileSync(fileURLToPath(new URL('../public/mini-kids.js',import.meta.url)),'utf8'),ctx);
  vm.runInContext(readFileSync(fileURLToPath(new URL('../public/mini-activities.js',import.meta.url)),'utf8'),ctx);
  vm.runInContext(readFileSync(fileURLToPath(new URL('../public/mini-board.js',import.meta.url)),'utf8'),ctx);
  vm.runInContext(readFileSync(fileURLToPath(new URL('../public/mini-visual-schema.js',import.meta.url)),'utf8'),ctx);
  vm.runInContext(app,ctx);
  const s={
    mode:'realtime',stopped:false,ready:true,mediaReady:true,language:'en',
    activity:'chat',activityUpdatePending:false,awaitingProactiveResponse:false,
    keepConversationGoing:true,followUpCount:0,
    responseActive:false,childSpeaking:false,userSpokeDuringMode:false,
    baseInstructions:'family-safe instructions',
    wantVideo:false,videoPaused:false,startedAt:Date.now(),endsAt:Date.now()+900000,
    audioInputTrack:{enabled:true},
    audioMeter:{isAudible:()=>false,stop(){},resume(){}},
    eventChannel:{readyState:'open',send:encoded=>sent.push(JSON.parse(encoded))},
    channels:new Set(),abort:new AbortController(),
  };
  ctx.testSession=s;
  vm.runInContext('current = testSession',ctx);
  return {ctx,s,sent,calls,flushTimeouts,timeouts,visualRenderer};
}
const emit=(env,type,extra={})=>{
  env.ctx.ev={type,...extra};
  vm.runInContext('receiveEvent(testSession,ev,testSession.eventChannel)',env.ctx);
};
const request=(env,m)=>{
  env.ctx.which=m;
  return vm.runInContext('requestActivity(which)',env.ctx);
};

test('Guess game updates Qwen instructions but relies on VAD, not unsolicited response.create',()=>{
  const env=mockEnvironment();
  assert.equal(request(env,'guess'),true);
  assert.equal(env.sent.length,1);
  assert.equal(env.sent[0].type,'session.update');
  assert.match(env.sent[0].session.instructions,/Play a spoken animal guessing game/);
  emit(env,'session.updated');
  assert.equal(env.sent.length,1,'no proactive response.create is sent in automatic VAD mode');
  assert.ok(env.calls.some(x=>x[0]==='fallback' && x[1]==='guess'));
  assert.equal(env.s.stopped,false);
  emit(env,'input_audio_buffer.speech_started');
  emit(env,'input_audio_buffer.speech_stopped');
  emit(env,'response.created');
  vm.runInContext('onRemoteAudio(testSession,true)',env.ctx);
  emit(env,'response.done',{response:{status:'completed'}});
  vm.runInContext('onRemoteAudio(testSession,false)',env.ctx);
  env.flushTimeouts(900);
  assert.ok(env.calls.some(x=>x[0]==='response_done'));
  assert.equal(env.s.stopped,false);
});

test('Changing activities while Qwen speaks queues the update and preserves the same session',()=>{
  const env=mockEnvironment();
  assert.equal(request(env,'guess'),true);
  emit(env,'session.updated');
  emit(env,'response.created');
  const count=env.sent.length;
  assert.equal(request(env,'story'),true);
  assert.equal(env.sent.length,count,'do not change instructions mid-response');
  emit(env,'response.done',{response:{status:'completed'}});
  assert.equal(env.sent.length,count+1);
  assert.equal(env.sent[count].type,'session.update');
  assert.match(env.sent[count].session.instructions,/Co-create a gentle original story/);
  emit(env,'session.updated');
  assert.equal(env.sent.length,count+1,'no extra response.create after the new game starts');
  assert.ok(env.calls.some(x=>x[0]==='fallback'&&x[1]==='story'));
  assert.equal(env.s.stopped,false);
});

test('One-word child answer is recognised by event handler while session stays live',()=>{
  const env=mockEnvironment();
  request(env,'guess');
  emit(env,'session.updated');
  emit(env,'input_audio_buffer.speech_started');
  assert.equal(env.s.childSpeaking,true);
  emit(env,'input_audio_buffer.speech_stopped');
  assert.equal(env.s.childSpeaking,false);
  emit(env,'conversation.item.input_audio_transcription.completed',{transcript:'Giraffe'});
  assert.ok(env.calls.some(x=>x[0]==='voice'&&x[1]===true));
  assert.ok(env.calls.some(x=>x[0]==='transcript'&&x[1]==='Giraffe'));
  assert.equal(env.s.stopped,false);
});

test('Rejected game instructions show the error code but do not disconnect a healthy session',()=>{
  const env=mockEnvironment();
  request(env,'guess');
  emit(env,'error',{error:{
    type:'invalid_request_error',code:'invalid_value',param:'session.instructions',
    message:'private prompt should not be shown',
  }});
  assert.equal(env.s.stopped,false);
  assert.equal(env.s.activity,'chat');
  assert.equal(env.s.activityUpdatePending,false);
  const details=env.ctx.document.getElementById('modelDiagnostic').textContent;
  assert.match(details,/invalid_value/);
  assert.doesNotMatch(details,/private prompt/);
});

test('A fatal provider error exposes only structured code and then shuts down media',()=>{
  const env=mockEnvironment();
  emit(env,'error',{error:{type:'server_error',code:'rate_limit',message:'child secret phrase'}});
  assert.equal(env.s.stopped,true);
  const details=env.ctx.document.getElementById('modelDiagnostic').textContent;
  assert.match(details,/rate_limit/);
  assert.doesNotMatch(details,/child secret phrase/);
});

test('A failed individual response reports code without claiming the whole session died',()=>{
  const env=mockEnvironment();
  emit(env,'response.created');
  emit(env,'response.done',{response:{status:'failed',status_details:{error:{
    code:'internal_error',type:'server_error',message:'private audio text',
  }}}});
  const details=env.ctx.document.getElementById('modelDiagnostic').textContent;
  assert.match(details,/internal_error/);
  assert.doesNotMatch(details,/private audio text/);
  assert.equal(env.s.stopped,false);
});

test('Joining a live session starts a local question and never sends response.create',async()=>{
  const env=mockEnvironment();
  env.s.mediaReady=false;
  env.s.mediaStarted=false;
  env.s.localStream={getAudioTracks(){return [{enabled:true}]}};
  env.s.audioSender={replaceTrack:async()=>{}};
  env.s.wantVideo=false;
  await vm.runInContext('startSendingMedia(testSession)',env.ctx);
  assert.equal(env.s.mediaReady,true);
  assert.equal(env.sent.length,0);
  assert.ok(env.calls.some(x=>x[0]==='ready'));
  assert.ok(env.calls.some(x=>x[0]==='fallback'&&x[1]==='chat'));
  assert.doesNotMatch(app,/type:'response\.create'/);
});


test('Blocked Safari fallback speech does not mute the child microphone',()=>{
  const childScript=readFileSync(fileURLToPath(new URL('../public/mini-child-ui.js',import.meta.url)),'utf8');
  const elements=new Map();
  const element=()=>({
    textContent:'',dataset:{},classList:{add(){},remove(){},toggle(){}},
    style:{width:'',setProperty(){},removeProperty(){}},
    setAttribute(){},removeAttribute(){},addEventListener(){},
    querySelector(){return {textContent:''};},
    appendChild(){},scrollIntoView(){},offsetWidth:5,
  });
  const get=id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id)};
  const mic={enabled:true};
  const session={ready:true,stopped:false,muted:false,mode:'realtime',audioInputTrack:mic};
  let utterance;
  const window={
    MiniKidsContent:{
      mode:x=>x,
      getLabels:()=>({chat:'Talk',guess:'Guess',story:'Story',look:'Show',blocked:'Ask a grown-up'}),
      getFallback:()=>'Which animal has a long neck?',
    },
    speechSynthesis:{speak(value){utterance=value;},cancel(){}},
    SpeechSynthesisUtterance:class{constructor(message){this.text=message;}},
    scrollTo(){},
  };
  const document={getElementById:get,createElement:()=>element()};
  vm.runInNewContext(childScript,{window,document,setTimeout,clearTimeout,Date});
  const child=window.MiniChildUI.init({
    getLanguage:()=> 'en',
    getSession:()=>session,
    stopSession(){},
    requestActivity(){},
  });
  child.sayFallback('guess');
  assert.equal(mic.enabled,true,'a blocked Safari TTS start must not mute the microphone');
  assert.ok(utterance);
  utterance.onstart();
  assert.equal(mic.enabled,false,'temporarily mute only while local TTS actually plays');
  utterance.onend();
  assert.equal(mic.enabled,true,'restore the microphone when local TTS ends');
  child.stopSpeech();
});


test('Game change is deferred while a spoken answer is waiting for Qwen',()=>{
  const env=mockEnvironment();
  request(env,'guess');
  emit(env,'session.updated');
  emit(env,'input_audio_buffer.speech_started');
  emit(env,'input_audio_buffer.speech_stopped');
  assert.equal(env.s.turnPending,true);
  const before=env.sent.length;
  assert.equal(request(env,'story'),true);
  assert.equal(env.sent.length,before,'do not send session.update during pending inference');
  emit(env,'response.created');
  assert.equal(env.sent.length,before);
  emit(env,'response.done',{response:{status:'completed'}});
  assert.equal(env.s.turnPending,false);
  assert.equal(env.sent.length,before+1);
  assert.match(env.sent.at(-1).session.instructions,/Co-create a gentle original story/);
  emit(env,'session.updated');
  assert.ok(env.calls.some(x=>x[0]==='fallback'&&x[1]==='story'));
  assert.equal(env.s.stopped,false);
});


test('After a short Qwen verdict, Mini asks ONE local follow-up, no added AI request',()=>{
  const env=mockEnvironment();
  env.s.activity='guess';
  const before=env.sent.length;
  emit(env,'input_audio_buffer.speech_started');
  emit(env,'input_audio_buffer.speech_stopped');
  emit(env,'conversation.item.input_audio_transcription.completed',{transcript:'Giraffe'});
  emit(env,'response.created');
  emit(env,'response.audio_transcript.done',{transcript:'You are right! A giraffe. Good job!'});
  vm.runInContext('onRemoteAudio(testSession,true); onRemoteAudio(testSession,false)',env.ctx);
  emit(env,'response.done',{response:{status:'completed'}});
  assert.equal(env.calls.filter(x=>x[0]==='followup').length,0,'do not interrupt streamed speech');
  env.flushTimeouts(2400);
  const followups=env.calls.filter(x=>x[0]==='followup');
  assert.equal(followups.length,1);
  assert.equal(followups[0][1],'guess');
  assert.match(followups[0][2],/\?/);
  env.flushTimeouts();
  assert.equal(env.calls.filter(x=>x[0]==='followup').length,1,'do not nag in a loop');
  assert.equal(env.sent.length,before,'must not send new Qwen request');
});

test('A Qwen answer that already asks a question is left alone',()=>{
  const env=mockEnvironment();
  emit(env,'input_audio_buffer.speech_stopped');
  emit(env,'response.created');
  emit(env,'response.audio_transcript.delta',{delta:'Correct! Which animal has stripes?'});
  emit(env,'response.done',{response:{status:'completed'}});
  env.flushTimeouts();
  assert.equal(env.calls.filter(x=>x[0]==='followup').length,0);
});

test('A child who speaks before the delayed follow-up cancels it',()=>{
  const env=mockEnvironment();
  env.s.activity='story';
  emit(env,'input_audio_buffer.speech_stopped');
  emit(env,'response.created');
  emit(env,'response.audio_transcript.done',{transcript:'The dragon reaches a forest.'});
  vm.runInContext('onRemoteAudio(testSession,true); onRemoteAudio(testSession,false)',env.ctx);
  emit(env,'response.done',{response:{status:'completed'}});
  assert.ok(env.s.followupTimer,'a follow-up was queued before the child interrupted');
  emit(env,'input_audio_buffer.speech_started');
  env.flushTimeouts();
  assert.equal(env.calls.filter(x=>x[0]==='followup').length,0);
});

test('The parent can turn off automatic local questions',()=>{
  const env=mockEnvironment();
  env.s.keepConversationGoing=false;
  emit(env,'input_audio_buffer.speech_stopped');
  emit(env,'response.created');
  emit(env,'response.audio_transcript.done',{transcript:'Great guessing!'});
  vm.runInContext('onRemoteAudio(testSession,true); onRemoteAudio(testSession,false)',env.ctx);
  emit(env,'response.done',{response:{status:'completed'}});
  env.flushTimeouts();
  assert.equal(env.calls.filter(x=>x[0]==='followup').length,0);
});

test('Never follow up after a rejected/empty Qwen response or a goodbye',()=>{
  for(const {status,text,child} of [
    {status:'failed',text:'Well done!',child:'giraffe'},
    {status:'completed',text:'',child:'giraffe'},
    {status:'completed',text:'Goodbye!',child:'bye'},
  ]) {
    const env=mockEnvironment();
    emit(env,'input_audio_buffer.speech_stopped');
    emit(env,'conversation.item.input_audio_transcription.completed',{transcript:child});
    emit(env,'response.created');
    if(text)emit(env,'response.audio_transcript.done',{transcript:text});
    emit(env,'response.done',{response:{status}});
    env.flushTimeouts();
    assert.equal(env.calls.filter(x=>x[0]==='followup').length,0,status+' '+text);
  }
});

test('Changing the game before follow-up cancels the old question',()=>{
  const env=mockEnvironment();
  env.s.activity='guess';
  emit(env,'input_audio_buffer.speech_stopped');
  emit(env,'response.created');
  emit(env,'response.audio_transcript.done',{transcript:'Yes, it is a giraffe.'});
  vm.runInContext('onRemoteAudio(testSession,true); onRemoteAudio(testSession,false)',env.ctx);
  emit(env,'response.done',{response:{status:'completed'}});
  assert.ok(env.s.followupTimer);
  assert.equal(request(env,'story'),true);
  env.flushTimeouts();
  assert.equal(env.calls.filter(x=>x[0]==='followup').length,0);
});

test('Local question waits for Qwen audio to finish before talking',()=>{
  const env=mockEnvironment();
  env.s.activity='guess';
  let speaking=true;
  env.s.audioMeter={isAudible:()=>speaking};
  emit(env,'input_audio_buffer.speech_stopped');
  emit(env,'response.created');
  emit(env,'response.audio_transcript.done',{transcript:'Yes, it is a giraffe.'});
  vm.runInContext('onRemoteAudio(testSession,true); onRemoteAudio(testSession,false)',env.ctx);
  emit(env,'response.done',{response:{status:'completed'}});
  env.flushTimeouts(2400);
  assert.equal(env.calls.filter(x=>x[0]==='followup').length,0);
  speaking=false;
  env.flushTimeouts(450);
  assert.equal(env.calls.filter(x=>x[0]==='followup').length,1);
});

test('A Mandarin model reply gets a Mandarin follow-up in Auto language mode',()=>{
  const env=mockEnvironment();
  env.s.activity='guess';
  env.s.language='auto';
  emit(env,'input_audio_buffer.speech_stopped');
  emit(env,'response.created');
  emit(env,'response.audio_transcript.done',{transcript:'答对了，是长颈鹿！'});
  vm.runInContext('onRemoteAudio(testSession,true); onRemoteAudio(testSession,false)',env.ctx);
  emit(env,'response.done',{response:{status:'completed'}});
  env.flushTimeouts();
  const followups=env.calls.filter(x=>x[0]==='followup');
  assert.equal(followups.length,1);
  assert.equal(followups[0][3],'zh');
  assert.match(followups[0][2],/？/);
});


test('Spoken game request updates local follow-up context without another provider event',()=>{
  const env=mockEnvironment();
  const before=env.sent.length;
  emit(env,'conversation.item.input_audio_transcription.completed',{transcript:'Can we guess animals?'});
  assert.equal(env.s.activity,'guess');
  assert.equal(env.sent.length,before,'spoken activity request must not send session.update or response.create');
  emit(env,'conversation.item.input_audio_transcription.completed',{transcript:'Tell me a story'});
  assert.equal(env.s.activity,'story');
  assert.equal(env.sent.length,before);
  assert.equal(env.s.stopped,false);
});

test('Muting while permission is pending disables the eventual preview microphone',async()=>{
  const env=mockEnvironment();
  await vm.runInContext('Promise.resolve()',env.ctx);
  let release;
  const mic={enabled:true,stop(){this.stopped=true;}};
  env.ctx.navigator={mediaDevices:{getUserMedia:()=>new Promise(resolve=>{release=resolve;})}};
  vm.runInContext("current=null; mode='preview'; document.getElementById('accessCode').value='test-parent-code';",env.ctx);
  vm.runInContext('visualActivity.open()',env.ctx);
  const starting=vm.runInContext('startMini()',env.ctx);
  assert.equal(vm.runInContext('visualActivity.isActive()',env.ctx),false,'starting capture restores the full face');
  try {
    vm.runInContext('toggleMute()',env.ctx);
    release({getAudioTracks:()=>[mic],getTracks:()=>[mic]});
    await starting;
    assert.equal(vm.runInContext('current.muted',env.ctx),true);
    assert.equal(mic.enabled,false);
  } finally {vm.runInContext('stopMini()',env.ctx);}
  assert.equal(mic.stopped,true);
});

test('Live media attachment preserves mute and does not narrate an opening while muted',async()=>{
  const env=mockEnvironment();
  const mic={enabled:true};
  env.s.muted=true;
  env.s.mediaStarted=false;
  env.s.mediaReady=false;
  env.s.localStream={getAudioTracks:()=>[mic]};
  let enabledAtAttach;
  env.s.audioSender={replaceTrack:async track=>{enabledAtAttach=track.enabled;}};
  await vm.runInContext('startSendingMedia(testSession)',env.ctx);
  assert.equal(enabledAtAttach,false);
  assert.equal(env.calls.some(x=>x[0]==='fallback'),false);
});

test('Spoken stop closes media immediately and cancels pending follow-ups',()=>{
  for(const transcript of ['Mini, stop talking now','Mini，别说了']) {
    const env=mockEnvironment();
    const mic={enabled:true,stop(){this.stopped=true;}};
    const camera={stop(){this.stopped=true;}};
    env.s.localStream={getTracks:()=>[mic,camera]};
    env.s.pc={close(){this.closed=true;}};
    emit(env,'input_audio_buffer.speech_stopped');
    emit(env,'conversation.item.input_audio_transcription.completed',{transcript});
    assert.equal(env.s.stopped,true);
    assert.equal(mic.stopped,true);
    assert.equal(camera.stopped,true);
    assert.equal(env.s.pc.closed,true);
    assert.equal(env.s.abort.signal.aborted,true);
    env.flushTimeouts();
    assert.equal(env.calls.some(x=>x[0]==='followup'),false);
    assert.equal(env.calls.some(x=>x[0]==='ended'),true);
  }
});

test('Turning off follow-ups also changes the instructions sent to Qwen',()=>{
  const env=mockEnvironment();
  env.s.keepConversationGoing=false;
  env.s.updateSent=false;
  env.s.sessionCreated=true;
  env.s.pc={connectionState:'connected'};
  env.s.opening='What colour should our spaceship be?';
  vm.runInContext('tryInitialize(testSession)',env.ctx);
  assert.match(env.sent[0].session.instructions,/Optional follow-up questions are OFF/);
  assert.ok(env.sent[0].session.instructions.includes(env.s.opening));
  request(env,'story');
  assert.match(env.sent[1].session.instructions,/Optional follow-up questions are OFF/);
});

test('Paid extension needs successful parent reauthorization and clears the entered code',async()=>{
  const env=mockEnvironment();
  const el=id=>env.ctx.document.getElementById(id);
  const originalEnd=env.s.endsAt;
  let request;
  env.ctx.fetch=async(url,options)=>{request={url,options};return {ok:false,json:async()=>({error:'Incorrect private robot access code.'})};};
  vm.runInContext('extendSession()',env.ctx);
  assert.equal(el('extendDialog').open,true);
  assert.equal(env.s.endsAt,originalEnd);
  el('extensionCode').value='wrong-but-long-code';
  await vm.runInContext('authorizeExtension({preventDefault(){}})',env.ctx);
  assert.equal(env.s.endsAt,originalEnd);
  assert.equal(el('extensionCode').value,'');
  assert.match(el('extensionMessage').textContent,/Incorrect/);
  env.ctx.fetch=async(url,options)=>{request={url,options};return {ok:true,json:async()=>({ok:true})};};
  el('extensionCode').value='test-parent-code';
  await vm.runInContext('authorizeExtension({preventDefault(){}})',env.ctx);
  assert.equal(request.url,'/api/parent/authorize');
  assert.equal(request.options.headers['X-Robot-Access-Code'],'test-parent-code');
  assert.equal(env.s.endsAt,originalEnd+300000);
  assert.equal(el('extendDialog').open,false);
  assert.equal(el('extensionCode').value,'');
  assert.equal(env.sent.length,0,'authorization creates no AI turn');
});

test('A cancelled or stopped session cannot be extended by a late authorization response',async()=>{
  for(const action of ['cancelExtension()','stopMini()']) {
    const env=mockEnvironment();
    const before=env.s.endsAt;
    let resolve;
    env.ctx.fetch=()=>new Promise(r=>{resolve=r;});
    vm.runInContext("extendSession(); document.getElementById('extensionCode').value='test-parent-code'",env.ctx);
    const authorization=vm.runInContext('authorizeExtension({preventDefault(){}})',env.ctx);
    vm.runInContext(action,env.ctx);
    resolve({ok:true,json:async()=>({ok:true})});
    await authorization;
    assert.equal(env.s.endsAt,before,action);
    assert.equal(env.ctx.document.getElementById('extensionCode').value,'');
  }
});

test('Blocked model audio exposes child recovery and successful playback hides it',async()=>{
  const env=mockEnvironment();
  const el=id=>env.ctx.document.getElementById(id);
  el('parentSetup').open=false;
  el('remoteAudio').play=()=>Promise.reject(new Error('autoplay blocked'));
  await vm.runInContext('maybeUnmuteAudio()',env.ctx);
  assert.equal(el('kidAudioBtn').classList.contains('hidden'),false);
  assert.match(el('kidAudioBtn').textContent,/Tap to hear Mini/);
  assert.equal(el('parentSetup').open,false);
  el('remoteAudio').play=()=>Promise.resolve();
  await vm.runInContext('maybeUnmuteAudio()',env.ctx);
  assert.equal(el('kidAudioBtn').classList.contains('hidden'),true);
});

test('Parent-approved extensions obey the maximum and cannot revive an expired session',async()=>{
  for(const expired of [false,true]) {
    const env=mockEnvironment();
    const maximum=env.s.startedAt+60*60000;
    env.s.endsAt=expired?Date.now():maximum-2*60000;
    env.ctx.fetch=async()=>({ok:true,json:async()=>({ok:true})});
    vm.runInContext("extendSession(); document.getElementById('extensionCode').value='test-parent-code'",env.ctx);
    await vm.runInContext('authorizeExtension({preventDefault(){}})',env.ctx);
    if(expired)assert.equal(env.s.stopped,true);
    else assert.equal(env.s.endsAt,maximum);
  }
});

test('A late audio failure cannot expose a recovery button after stopping',async()=>{
  const env=mockEnvironment();
  let reject;
  env.ctx.document.getElementById('remoteAudio').play=()=>new Promise((_,r)=>{reject=r;});
  const playback=vm.runInContext('maybeUnmuteAudio()',env.ctx);
  vm.runInContext('stopMini()',env.ctx);
  reject(new Error('late autoplay failure'));
  await playback;
  assert.equal(env.ctx.document.getElementById('kidAudioBtn').classList.contains('hidden'),true);
});

test('Session deadline shows a break notice then releases the session without a paid turn',()=>{
  const env=mockEnvironment();
  env.s.endsAt=Date.now()+30000;
  vm.runInContext('updateSessionClock(testSession)',env.ctx);
  assert.ok(env.calls.some(x=>x[0]==='remaining' && x[1]>0 && x[1]<=30));
  env.s.endsAt=Date.now();
  vm.runInContext('updateSessionClock(testSession)',env.ctx);
  assert.equal(env.s.stopped,true);
  assert.ok(env.calls.some(x=>x[0]==='ended'));
  assert.equal(env.sent.length,0);
});

test('Model events do not claim speaking or first audible latency before playback',()=>{
  const env=mockEnvironment();
  emit(env,'input_audio_buffer.speech_stopped');
  emit(env,'response.created',{response:{id:'a'}});
  emit(env,'response.audio_transcript.delta',{response_id:'a',delta:'Hello!'});
  assert.equal(env.calls.some(x=>x[0]==='status' && x[1]==='speaking'),false);
  assert.equal(Boolean(env.s.replyMeasured),false);
  vm.runInContext('onRemoteAudio(testSession,true)',env.ctx);
  assert.equal(env.calls.at(-1)[1],'speaking');
  assert.equal(env.s.replyMeasured,true);
  assert.match(env.ctx.document.getElementById('replyDelay').textContent,/First audible reply/);
});

test('Your-turn cue waits until the audible stream has drained',()=>{
  const env=mockEnvironment();
  let audible=true;
  env.s.audioMeter={isAudible:()=>audible};
  emit(env,'response.created');
  vm.runInContext('onRemoteAudio(testSession,true)',env.ctx);
  emit(env,'response.done',{response:{status:'completed'}});
  env.flushTimeouts(900);
  assert.equal(env.calls.some(x=>x[0]==='response_done'),false);
  audible=false;
  vm.runInContext('onRemoteAudio(testSession,false)',env.ctx);
  assert.equal(env.calls.filter(x=>x[0]==='response_done').length,1);
});

test('A child interruption mutes old audio without muting the mic or losing the new turn',()=>{
  const env=mockEnvironment();
  emit(env,'response.created',{response:{id:'old'}});
  vm.runInContext('onRemoteAudio(testSession,true)',env.ctx);
  emit(env,'input_audio_buffer.speech_started');
  assert.equal(env.ctx.document.getElementById('remoteAudio').muted,true);
  assert.equal(env.s.audioInputTrack.enabled,true);
  emit(env,'input_audio_buffer.speech_stopped');
  emit(env,'response.done',{response:{id:'old',status:'cancelled'}});
  assert.equal(env.s.turnPending,true);
  emit(env,'response.created',{response:{id:'new'}});
  emit(env,'response.audio_transcript.delta',{response_id:'old',delta:'obsolete text'});
  assert.equal(env.s.replyTranscript,'');
  emit(env,'response.audio_transcript.delta',{response_id:'new',delta:'New answer.'});
  assert.equal(env.s.replyTranscript,'New answer.');
  assert.equal(env.ctx.document.getElementById('remoteAudio').muted,false);
});

test('Story checkpoints synchronize only between turns without another response or starter',()=>{
  const env=mockEnvironment();
  emit(env,'input_audio_buffer.speech_started');emit(env,'input_audio_buffer.speech_stopped');
  emit(env,'conversation.item.input_audio_transcription.completed',{transcript:'Tell me a story'});
  env.flushTimeouts(0);
  assert.equal(env.sent.length,0,'never compete with automatic VAD inference');
  emit(env,'response.created');emit(env,'response.done',{response:{status:'completed'}});
  env.flushTimeouts(0);
  assert.equal(env.sent.length,1);
  assert.equal(env.sent[0].type,'session.update');
  assert.match(env.sent[0].session.instructions,/"stage":"hero"/);
  emit(env,'session.updated');
  assert.equal(env.calls.some(x=>x[0]==='fallback'),false);
  emit(env,'input_audio_buffer.speech_started');emit(env,'input_audio_buffer.speech_stopped');
  emit(env,'conversation.item.input_audio_transcription.completed',{transcript:'cat'});
  emit(env,'response.created');emit(env,'response.done',{response:{status:'completed'}});
  env.flushTimeouts(0);
  assert.equal(env.sent.length,2);
  assert.match(env.sent[1].session.instructions,/"hero":"cat"/);
  assert.match(env.sent[1].session.instructions,/"stage":"place"/);
  assert.equal(env.sent.some(x=>x.type==='response.create'),false);
  vm.runInContext('stopMini()',env.ctx);
  assert.equal(env.s.activityState,null);
});

test('A rejected optional checkpoint leaves the microphone and voice session available',()=>{
  const env=mockEnvironment();
  env.s.contextUpdatePending=true;
  emit(env,'error',{error:{type:'invalid_request_error',param:'session.instructions',code:'invalid_value'}});
  assert.equal(env.s.stopped,false);
  assert.equal(env.s.contextSyncDisabled,true);
  assert.equal(env.s.audioInputTrack.enabled,true);
});

test('Unheard generated text cannot invite a turn or trigger a spoken fallback',()=>{
  const env=mockEnvironment();env.s.activity='story';
  emit(env,'input_audio_buffer.speech_stopped');emit(env,'response.created');
  emit(env,'response.audio_transcript.done',{transcript:'The dragon reaches a forest.'});
  emit(env,'response.done',{response:{status:'completed'}});
  env.flushTimeouts(2400);
  assert.equal(env.calls.some(x=>x[0]==='followup' || x[0]==='response_done'),false);
  assert.equal(env.ctx.document.getElementById('kidAudioBtn').classList.contains('hidden'),false);
});

test('Duplicate transcript completion cannot advance a riddle twice',()=>{
  const env=mockEnvironment();
  emit(env,'conversation.item.input_audio_transcription.completed',{transcript:'let us guess animals',item_id:'start'});
  emit(env,'conversation.item.input_audio_transcription.completed',{transcript:'giraffe',item_id:'answer'});
  assert.equal(env.s.activityState.game.round,1);
  emit(env,'conversation.item.input_audio_transcription.completed',{transcript:'giraffe',item_id:'answer'});
  assert.equal(env.s.activityState.game.round,1);
  assert.equal(env.s.activityState.game.attempts,0);
});

test('An unacknowledged optional checkpoint times out without reconnecting or retrying',()=>{
  const env=mockEnvironment();
  env.s.activityState=env.ctx.window.MiniActivities.advance(null,'tell me a story');
  vm.runInContext('syncActivityContext(testSession)',env.ctx);
  assert.equal(env.sent.length,1);
  assert.equal(env.s.contextUpdatePending,true);
  env.flushTimeouts(5000);
  assert.equal(env.s.contextUpdatePending,false);
  assert.equal(env.s.contextSyncDisabled,true);
  assert.equal(env.s.stopped,false);
  env.s.activityState=env.ctx.window.MiniActivities.advance(env.s.activityState,'cat');
  vm.runInContext('syncActivityContext(testSession)',env.ctx);
  assert.equal(env.sent.length,1,'do not repeatedly retry an unsupported checkpoint');
});

test('Spoken tic-tac-toe opens a visual board and a position places X followed by one legal O',()=>{
  const env=mockEnvironment();
  emit(env,'input_audio_buffer.speech_started');emit(env,'input_audio_buffer.speech_stopped');
  emit(env,'conversation.item.input_audio_transcription.completed',{transcript:'Can we play tic tik toe?',item_id:'open'});
  assert.equal(vm.runInContext('visualActivity.isActive()',env.ctx),true);
  assert.equal(env.s.activity,'tictactoe');
  assert.equal(env.ctx.document.querySelector('.shell').dataset.visualActivity,'tictactoe');
  emit(env,'conversation.item.input_audio_transcription.completed',{transcript:'左上角',item_id:'move'});
  assert.equal(env.s.boardCheckpoint.board[0],'X');
  assert.equal(env.s.boardCheckpoint.turn,'O');
  env.flushTimeouts(550);
  assert.equal(env.s.boardCheckpoint.board.filter(Boolean).length,2);
  assert.equal(env.s.boardCheckpoint.board[4],'O');
  assert.equal(env.s.boardCheckpoint.turn,'X');
  emit(env,'response.created');emit(env,'response.done',{response:{status:'completed'}});
  env.flushTimeouts(0);
  assert.equal(env.sent.length,1);
  assert.match(env.sent[0].session.instructions,/Visual tic-tac-toe board is authoritative/);
  assert.equal(env.sent.some(event=>event.type==='response.create'),false);
});

test('Closing or stopping a board cancels a pending Mini move and restores the face',()=>{
  for(const action of ['visualActivity.close()','stopMini()']) {
    const env=mockEnvironment();
    vm.runInContext('visualActivity.open(); visualActivity.move(0)',env.ctx);
    vm.runInContext(action,env.ctx);
    env.flushTimeouts(550);
    assert.equal(vm.runInContext('visualActivity.state()',env.ctx),null);
    assert.equal(env.ctx.document.querySelector('.shell').dataset.visualActivity,undefined);
    assert.equal(env.s.boardCheckpoint,null);
  }
});

test('A request for a story leaves the visual board without ending the paid session',()=>{
  const env=mockEnvironment();vm.runInContext('visualActivity.open()',env.ctx);
  emit(env,'conversation.item.input_audio_transcription.completed',{transcript:'Tell me a story',item_id:'story'});
  assert.equal(vm.runInContext('visualActivity.isActive()',env.ctx),false);
  assert.equal(env.s.boardCheckpoint,null);
  assert.equal(env.s.activityState.kind,'story');
  assert.equal(env.s.stopped,false);
});

test('Natural chat requests and replay phrases transition the board correctly',()=>{
  for(const text of ['Let us chat',"Let's just talk",'Can we chat','我想聊天','stop playing tic tac toe']) {
    const env=mockEnvironment();vm.runInContext('visualActivity.open();visualActivity.move(0)',env.ctx);
    emit(env,'conversation.item.input_audio_transcription.completed',{transcript:text,item_id:'exit'});
    assert.equal(vm.runInContext('visualActivity.isActive()',env.ctx),false,text);
    assert.equal(env.s.stopped,false,text);
    assert.equal(env.s.activity,'chat',text);
  }
  const env=mockEnvironment();vm.runInContext('visualActivity.open();visualActivity.move(0)',env.ctx);
  emit(env,'conversation.item.input_audio_transcription.completed',{transcript:'play tic tac toe again',item_id:'restart'});
  assert.equal(env.s.boardCheckpoint.board.filter(Boolean).length,0);
  env.flushTimeouts(550);
  assert.equal(env.s.boardCheckpoint.board.filter(Boolean).length,0,'the old Mini move cannot leak into a new round');
});

test('A delayed spoken move from before New round cannot mark the new board',()=>{
  const env=mockEnvironment();vm.runInContext('visualActivity.open()',env.ctx);
  emit(env,'input_audio_buffer.speech_started');
  vm.runInContext('visualActivity.open()',env.ctx);
  emit(env,'input_audio_buffer.speech_stopped');
  emit(env,'conversation.item.input_audio_transcription.completed',{transcript:'top left',item_id:'old-round'});
  assert.equal(env.s.boardCheckpoint.board.filter(Boolean).length,0);
});

test('Automatic board language follows a Mandarin game request',()=>{
  const env=mockEnvironment();env.s.language='auto';
  emit(env,'conversation.item.input_audio_transcription.completed',{transcript:'我们玩井字棋吧',item_id:'zh-board'});
  assert.match(env.ctx.document.getElementById('boardTitle').textContent,/井字棋/);
  assert.match(env.ctx.document.getElementById('boardStatus').textContent,/轮到你/);
});

test('Arbitrary spoken requests reach Qwen planning without a visual keyword classifier',async()=>{
  const env=mockEnvironment();env.s.visualsEnabled=true;env.s.visualGrant='test-grant';
  let sent;
  env.ctx.fetch=async(url,options)=>{sent={url,options};return {ok:true,json:async()=>({plan:{version:1,action:'character',title:'Jellyfish astronaut',nodes:[{kind:'emoji',text:'🪼',size:40}]}})};};
  emit(env,'conversation.item.input_audio_transcription.completed',{transcript:'Become a jellyfish astronaut',item_id:'novel'});
  assert.equal(sent,undefined,'wait for the spoken reply instead of composing a competing story');
  emit(env,'response.created');emit(env,'response.audio_transcript.done',{transcript:'Our jellyfish astronaut is floating beside the moon.'});emit(env,'response.done',{response:{status:'completed'}});
  await vm.runInContext('Promise.resolve()',env.ctx);await vm.runInContext('Promise.resolve()',env.ctx);
  assert.equal(sent.url,'/api/visual/plan');
  assert.equal(JSON.parse(sent.options.body).request,'Become a jellyfish astronaut');
  assert.equal(JSON.parse(sent.options.body).spokenReply,'Our jellyfish astronaut is floating beside the moon.');
  assert.equal(sent.options.headers['X-Mini-Visual-Session'],'test-grant');
  assert.equal(Object.keys(sent.options.headers).some(key=>key.toLowerCase()==='authorization'),false,'leave gateway authorization to the browser');
  assert.equal(env.visualRenderer.current().title,'Jellyfish astronaut');
});
test('Late spoken transcripts still anchor their own visual turn and an old response cannot anchor a newer one',async()=>{
  const env=mockEnvironment(),requests=[];Object.assign(env.s,{visualsEnabled:true,visualGrant:'grant'});
  env.ctx.fetch=async(_url,init)=>{requests.push(JSON.parse(init.body));return {ok:true,json:async()=>({plan:{version:1,action:'keep'}})};};
  emit(env,'input_audio_buffer.speech_started');emit(env,'input_audio_buffer.speech_stopped');
  emit(env,'conversation.item.input_audio_transcription.completed',{transcript:'Tell me a moon story',item_id:'first'});
  emit(env,'response.created',{response:{id:'one'}});emit(env,'response.done',{response:{id:'one',status:'completed'}});
  assert.equal(requests.length,0);
  emit(env,'response.audio_transcript.done',{response_id:'one',transcript:'A rabbit walks across the moon.'});
  await vm.runInContext('Promise.resolve()',env.ctx);assert.equal(requests[0].spokenReply,'A rabbit walks across the moon.');
  emit(env,'input_audio_buffer.speech_started');emit(env,'input_audio_buffer.speech_stopped');
  emit(env,'conversation.item.input_audio_transcription.completed',{transcript:'Now the forest',item_id:'second'});
  emit(env,'response.created',{response:{id:'two'}});emit(env,'response.audio_transcript.done',{response_id:'two',transcript:'The same rabbit reaches a green forest.'});
  emit(env,'response.done',{response:{id:'one',status:'completed'}});assert.equal(requests.length,1);
  emit(env,'response.done',{response:{id:'two',status:'completed'}});await vm.runInContext('Promise.resolve()',env.ctx);
  assert.equal(requests[1].spokenReply,'The same rabbit reaches a green forest.');assert.equal(requests[1].request,'Now the forest');
});
test('Game moves speak the actual board position while a contradictory remote game reply stays muted',()=>{
  const env=mockEnvironment();Object.assign(env.s,{visualsEnabled:true,visualGrant:'grant'});
  vm.runInContext('visualActivity.open()',env.ctx);
  emit(env,'input_audio_buffer.speech_started');emit(env,'input_audio_buffer.speech_stopped');
  emit(env,'conversation.item.input_audio_transcription.completed',{transcript:'top left',item_id:'move'});
  emit(env,'response.created',{response:{id:'game'}});assert.equal(env.ctx.document.getElementById('remoteAudio').muted,true);
  env.flushTimeouts(550);
  const spoken=env.calls.filter(value=>value[0]==='fallback').at(-1)[2];assert.match(spoken,/Mini placed O at center/);
  assert.equal(env.s.boardCheckpoint.board[4],'O');
  emit(env,'response.audio_transcript.done',{response_id:'game',transcript:'I placed a circle at bottom right and won!'});
  emit(env,'response.done',{response:{id:'game',status:'completed'}});
  assert.equal(env.ctx.document.getElementById('remoteAudio').muted,true);assert.doesNotMatch(env.ctx.document.getElementById('assistantTranscript').textContent,/bottom right/);
  vm.runInContext('visualActivity.close(false)',env.ctx);emit(env,'input_audio_buffer.speech_started');emit(env,'input_audio_buffer.speech_stopped');
  emit(env,'response.created',{response:{id:'chat'}});assert.equal(env.ctx.document.getElementById('remoteAudio').muted,false,'ordinary Qwen voice returns after leaving the game');
});
test('A visual button continuation narrates the same returned scene message without another model response',async()=>{
  const env=mockEnvironment();Object.assign(env.s,{visualsEnabled:true,visualGrant:'grant'});
  env.ctx.fetch=async()=>({ok:true,json:async()=>({plan:{version:1,action:'scene',title:'Moon rabbit',message:'The rabbit waves beside its rocket.',nodes:[{kind:'emoji',text:'🐇'}]}})});
  await vm.runInContext('requestGeneratedVisual(testSession,"Button interaction: moon",true,{narrate:true})',env.ctx);
  assert.equal(env.calls.filter(value=>value[0]==='fallback').at(-1)[2],'The rabbit waves beside its rocket.');
  assert.equal(env.visualRenderer.current().message,'The rabbit waves beside its rocket.');assert.equal(env.ctx.document.getElementById('remoteAudio').muted,true);
  assert.ok(env.sent.every(event=>event.type!=='response.create'));
});
test('Missing voice context pauses visuals without generating a second independent story',()=>{
  const env=mockEnvironment();Object.assign(env.s,{visualsEnabled:true,visualGrant:'grant'});let calls=0;
  env.ctx.fetch=async()=>{calls++;throw Error('No planning call expected without voice context');};
  emit(env,'input_audio_buffer.speech_started');emit(env,'input_audio_buffer.speech_stopped');emit(env,'conversation.item.input_audio_transcription.completed',{transcript:'Tell a story',item_id:'story'});
  emit(env,'response.created');emit(env,'response.done',{response:{status:'completed'}});env.flushTimeouts(1500);
  assert.equal(calls,0);assert.equal(env.s.visualsPaused,true);assert.match(env.ctx.document.getElementById('visualServiceStatus').textContent,/VISUAL_SPEECH_CONTEXT/);assert.equal(env.s.audioInputTrack.enabled,true);
});
test('Local game narration waits for child speech to stop and auto language uses Mandarin for Chinese result text',()=>{
  const env=mockEnvironment();env.s.language='auto';
  emit(env,'input_audio_buffer.speech_started');
  vm.runInContext('narrateVisual("Mini 把圆放在正中间。")',env.ctx);assert.equal(env.calls.some(value=>value[0]==='fallback'),false);
  emit(env,'input_audio_buffer.speech_stopped');
  const narration=env.calls.find(value=>value[0]==='fallback');assert.equal(narration[2],'Mini 把圆放在正中间。');assert.equal(narration[3],'zh');
});

test('Dynamic storytelling does not force the fixed cat/dragon and forest/castle checkpoint',async()=>{
  const env=mockEnvironment();env.s.visualsEnabled=true;env.s.visualGrant='test-grant';
  env.s.activityState=env.ctx.window.MiniActivities.fresh();
  env.ctx.fetch=async()=>({ok:true,json:async()=>({plan:{version:1,action:'keep'}})});
  emit(env,'conversation.item.input_audio_transcription.completed',{transcript:'Tell me a story about a jellyfish astronaut',item_id:'dynamic-story'});
  await vm.runInContext('Promise.resolve()',env.ctx);await vm.runInContext('Promise.resolve()',env.ctx);
  assert.equal(env.s.activityState.kind,'chat');
  assert.equal(env.s.activity,'story');
});

test('A later Qwen visual response wins even if an earlier network response arrives last',async()=>{
  const env=mockEnvironment();env.s.visualsEnabled=true;env.s.visualGrant='test-grant';
  const replies=[];
  env.ctx.fetch=(_url,options)=>new Promise(resolve=>replies.push({resolve,options}));
  const old=vm.runInContext('requestGeneratedVisual(testSession,"show a cat")',env.ctx);
  const latest=vm.runInContext('requestGeneratedVisual(testSession,"show a spaceship")',env.ctx);
  assert.equal(replies[0].options.signal.aborted,true);
  const reply=title=>({ok:true,json:async()=>({plan:{version:1,action:'scene',title,nodes:[{kind:'emoji',text:'🚀'}]}})});
  replies[1].resolve(reply('Spaceship'));await latest;
  replies[0].resolve(reply('Old cat'));await old;
  assert.equal(env.visualRenderer.current().title,'Spaceship');
});

test('New speech and stopping cancel pending visual work, revoke the grant, and preserve cleared UI',async()=>{
  const env=mockEnvironment();env.s.visualsEnabled=true;env.s.visualGrant='test-grant';
  let resolve,signal,revoked=false;
  env.ctx.fetch=(url,options)=>{
    if(options.method==='DELETE'){revoked=true;return Promise.resolve({ok:true});}
    signal=options.signal;return new Promise(r=>{resolve=r;});
  };
  const pending=vm.runInContext('requestGeneratedVisual(testSession,"show a cat")',env.ctx);
  emit(env,'input_audio_buffer.speech_started');assert.equal(signal.aborted,true);
  vm.runInContext('stopMini()',env.ctx);
  resolve({ok:true,json:async()=>({plan:{version:1,action:'scene',nodes:[{kind:'emoji',text:'🐱'}]}})});await pending;
  assert.equal(env.visualRenderer.current(),null);assert.equal(revoked,true);assert.equal(env.s.visualGrant,null);
});

test('Visual planning failure leaves voice capture alive and artwork requires parent consent',async()=>{
  const env=mockEnvironment();env.s.visualsEnabled=true;env.s.visualGrant='test-grant';
  env.ctx.fetch=async()=>({ok:false,json:async()=>({error:'Visual provider unavailable.'})});
  await vm.runInContext('requestGeneratedVisual(testSession,"show a cat")',env.ctx);
  assert.equal(env.s.stopped,false);assert.equal(env.s.audioInputTrack.enabled,true);
  assert.match(env.ctx.document.getElementById('visualServiceStatus').textContent,/unavailable/);
  assert.equal(env.s.visualsPaused,true);
  await assert.rejects(vm.runInContext('requestGeneratedArtwork("ticket",new AbortController().signal)',env.ctx),/grown-up/);
});
test('A failed planner pauses repeated chat requests, retains safe diagnostics after Stop, and only resumes on parent action',async()=>{
  const env=mockEnvironment();Object.assign(env.s,{visualsEnabled:true,visualGrant:'test-grant'});let requests=0;
  env.ctx.fetch=async(_url,options)=>{if(options.method==='DELETE')return {ok:true};requests++;return {ok:false,status:502,json:async()=>({error:'Check model permissions.',diagnostic:{code:'VISUAL_ACCESS',stage:'planner',model:'qwen-plus',httpStatus:403,providerCode:'AccessDenied'}})};};
  await vm.runInContext('requestGeneratedVisual(testSession,"Hello")',env.ctx);
  await vm.runInContext('requestGeneratedVisual(testSession,"How are you?")',env.ctx);
  assert.equal(requests,1);assert.equal(env.s.visualsPaused,true);assert.equal(env.s.audioInputTrack.enabled,true);assert.equal(env.s.stopped,false);
  assert.match(env.ctx.document.getElementById('visualServiceStatus').textContent,/VISUAL_ACCESS.*qwen-plus.*HTTP 403/);
  assert.doesNotMatch(env.ctx.document.getElementById('visualRequestStatus').textContent,/HTTP|qwen-plus|AccessDenied/);
  env.flushTimeouts(0);assert.match(env.sent.at(-1).session.instructions,/Visual responses are currently paused/);assert.ok(env.sent.every(event=>event.type!=='response.create'));
  vm.runInContext('toggleVisualResponses()',env.ctx);assert.equal(requests,1,'Resume must not itself make a paid request');assert.equal(env.s.visualsPaused,false);
  await vm.runInContext('requestGeneratedVisual(testSession,"Show a cat")',env.ctx);assert.equal(requests,2);
  vm.runInContext('stopMini()',env.ctx);assert.match(env.ctx.document.getElementById('visualServiceStatus').textContent,/VISUAL_ACCESS.*HTTP 403/);
});
test('A tunnel HTML response produces a gateway diagnostic without showing its body',async()=>{
  const env=mockEnvironment();Object.assign(env.s,{visualsEnabled:true,visualGrant:'test-grant'});
  env.ctx.fetch=async()=>({status:401,headers:{get:()=> 'text/html'},json:async()=>{throw Error('must not parse gateway HTML');}});
  await vm.runInContext('requestGeneratedVisual(testSession,"Hello")',env.ctx);
  assert.match(env.ctx.document.getElementById('visualServiceStatus').textContent,/VISUAL_GATEWAY.*HTTP 401/);assert.equal(env.s.visualsPaused,true);
});
test('Artwork failures show the exact model/status to the parent and a simple message to the child',async()=>{
  const env=mockEnvironment();Object.assign(env.s,{visualGrant:'test-grant',imagesAllowed:true});
  env.ctx.fetch=async()=>({ok:false,json:async()=>({error:'The image model is unavailable.',diagnostic:{code:'VISUAL_MODEL_UNAVAILABLE',stage:'artwork',model:'qwen-image-plus',httpStatus:404}})});
  await assert.rejects(vm.runInContext('requestGeneratedArtwork("ticket",new AbortController().signal)',env.ctx),error=>/We can still talk/.test(error.message) && !/404|qwen|model/.test(error.message));
  assert.match(env.ctx.document.getElementById('visualServiceStatus').textContent,/VISUAL_MODEL_UNAVAILABLE.*artwork.*qwen-image-plus.*HTTP 404/);assert.notEqual(env.s.visualsPaused,true);
});

test('All browser visual requests preserve gateway credentials and avoid setting Authorization',async()=>{
  const env=mockEnvironment(),requests=[];
  Object.assign(env.s,{visualsEnabled:true,visualGrant:'test-grant',imagesAllowed:true,awarenessEnabled:true});
  env.ctx.fetch=async(url,init)=>{requests.push({url,init});return {ok:true,json:async()=>({plan:{version:1,action:'keep'},observation:{}}),blob:async()=>({})};};
  await vm.runInContext('requestGeneratedVisual(testSession,"hello")',env.ctx);
  await vm.runInContext('requestGeneratedArtwork("ticket",new AbortController().signal)',env.ctx);
  vm.runInContext('stopMini()',env.ctx);
  assert.deepEqual(requests.map(value=>value.url),['/api/visual/plan','/api/visual/image','/api/visual/session']);
  for(const {init} of requests){
    assert.equal(init.headers['X-Mini-Visual-Session'],'test-grant');
    assert.equal(Object.keys(init.headers).some(key=>key.toLowerCase()==='authorization'),false);
    assert.equal(init.credentials,'same-origin');
  }
});

test('Picture permission explains each unavailable state and enables only for a configured new visual session',()=>{
  const env=mockEnvironment(),get=id=>env.ctx.document.getElementById(id);
  vm.runInContext("current=null;mode='realtime';loading=false;visualCapabilities={available:true,imagesAvailable:false};els.visualToggle.checked=true;render()",env.ctx);
  assert.equal(get('generatedPictures').disabled,true);
  assert.match(get('generatedPicturesInfo').textContent,/ALIBABA_IMAGE_MODEL.*private \.env.*restart/);
  vm.runInContext('visualCapabilities.imagesAvailable=true;render()',env.ctx);
  assert.equal(get('generatedPictures').disabled,false);assert.equal(get('generatedPictures').checked,false);
  vm.runInContext('els.visualToggle.checked=false;render()',env.ctx);
  assert.equal(get('generatedPictures').disabled,true);assert.match(get('generatedPicturesInfo').textContent,/Turn on.*visual scenes/);
  vm.runInContext('els.visualToggle.checked=true;current=testSession;render()',env.ctx);
  assert.equal(get('generatedPictures').disabled,true);assert.match(get('generatedPicturesInfo').textContent,/Stop Mini/);
  vm.runInContext("current=null;mode='preview';render()",env.ctx);
  assert.equal(get('generatedPictures').disabled,true);assert.match(get('generatedPicturesInfo').textContent,/need live AI/);
});

test('Wrong visual-model setup is explained before a session while ordinary voice startup remains enabled',async()=>{
  const env=mockEnvironment();
  vm.runInContext('current=null;loading=false',env.ctx);
  env.ctx.fetch=async()=>({ok:true,json:async()=>({mode:'realtime',visuals:{available:false,imagesAvailable:false,model:'qwen-image-plus',configurationError:'Set ALIBABA_VISUAL_MODEL=qwen-plus; use ALIBABA_IMAGE_MODEL=qwen-image-plus for artwork.'}})});
  await vm.runInContext('loadConfig()',env.ctx);
  const get=id=>env.ctx.document.getElementById(id);
  assert.equal(get('startBtn').disabled,false);assert.equal(get('visualResponses').disabled,true);assert.equal(get('generatedPictures').disabled,true);
  assert.match(get('visualCapabilityInfo').textContent,/ALIBABA_VISUAL_MODEL=qwen-plus/);
  assert.match(get('generatedPicturesInfo').textContent,/Fix the visual planner/);
});

test('Local camera reactions continue during conversation and games, but speech stays gated',()=>{
  const env=mockEnvironment();let options,stopped=0;
  Object.assign(env.s,{awarenessEnabled:true,wantVideo:true,endsAt:Date.now()+300000});
  env.ctx.document.getElementById('preview').srcObject={};
  env.ctx.window.MiniLocalAwareness={start:value=>{options=value;return {interrupt(){},stop(){stopped++;},isPaused:()=>false};}};
  vm.runInContext('startAwareness(testSession)',env.ctx);
  assert.equal(Boolean(options.allowed()),true);assert.equal(Boolean(options.canSpeak()),false);
  env.s.awarenessLastActivity=Date.now()-7000;assert.equal(Boolean(options.canSpeak()),true);
  for(const key of ['muted','childSpeaking','turnPending','responseActive','playbackActive']){
    env.s[key]=true;assert.equal(Boolean(options.allowed()),true,key);assert.equal(Boolean(options.canSpeak()),false,key);env.s[key]=false;
  }
  vm.runInContext('visualActivity.open()',env.ctx);assert.equal(Boolean(options.allowed()),true);assert.equal(Boolean(options.canSpeak()),false);
  vm.runInContext('visualActivity.close(false)',env.ctx);
  options.onCue({cue:'smile',spoken:false});assert.equal(env.calls.at(-1)[0],'visual_cue');
  env.s.videoPaused=true;assert.equal(Boolean(options.allowed()),false);env.s.videoPaused=false;
  env.ctx.document.hidden=true;assert.equal(Boolean(options.allowed()),false);env.ctx.document.hidden=false;
  env.ctx.document.getElementById('visualAwareness').checked=true;env.ctx.document.getElementById('spokenGreetings').checked=true;
  vm.runInContext('stopMini()',env.ctx);assert.equal(stopped,1);
  assert.equal(env.ctx.document.getElementById('visualAwareness').checked,false);assert.equal(env.ctx.document.getElementById('spokenGreetings').checked,false);
});

test('Contextual follow-ups preserve topic, wait for playback, cancel on speech and respect preference',()=>{
  const env=mockEnvironment();env.s.hadAudibleReply=true;let audible=true;env.s.audioMeter={isAudible:()=>audible};
  vm.runInContext('generatedVisuals.plan={version:1,action:"scene"};scheduleCompanionFollowUp(testSession,"A blue cat hops along.","A blue cat","completed","Shall the blue cat visit the moon or Mars?")',env.ctx);
  env.flushTimeouts(6000);assert.equal(env.calls.some(c=>c[0]==='followup'),false);
  audible=false;env.flushTimeouts(1500);assert.deepEqual(env.calls.find(c=>c[0]==='followup').slice(1),['chat','Shall the blue cat visit the moon or Mars?','en']);
  env.calls.length=0;
  vm.runInContext('scheduleCompanionFollowUp(testSession,"The cat hops.","Cat","completed","Moon or Mars?")',env.ctx);
  emit(env,'input_audio_buffer.speech_started');env.flushTimeouts();assert.equal(env.calls.some(c=>c[0]==='followup'),false);
  Object.assign(env.s,{childSpeaking:false,turnPending:false,responseActive:false,keepConversationGoing:false});
  vm.runInContext('scheduleCompanionFollowUp(testSession,"The cat hops.","Cat","completed","Moon or Mars?")',env.ctx);env.flushTimeouts();assert.equal(env.calls.some(c=>c[0]==='followup'),false);
});

test('An explicit tic-tac-toe request opens and narrates the local board without a planning request',async()=>{
  const env=mockEnvironment();Object.assign(env.s,{visualsEnabled:true,visualGrant:'grant'});let plans=0;
  env.ctx.fetch=async()=>{plans++;throw Error('Must not plan a known board');};
  emit(env,'input_audio_buffer.speech_started');emit(env,'input_audio_buffer.speech_stopped');emit(env,'conversation.item.input_audio_transcription.completed',{transcript:'Play tic tac toe'});
  assert.equal(vm.runInContext('visualActivity.isActive()',env.ctx),true);assert.equal(plans,0);assert.equal(env.s.localVisualTurn,true);
  assert.match(env.calls.find(c=>c[0]==='fallback')[2],/You are X/);
});

test('One invalid drawing can recover; repeated invalid instructions pause paid plans',async()=>{
  const env=mockEnvironment();Object.assign(env.s,{visualsEnabled:true,visualGrant:'grant'});
  env.ctx.fetch=async()=>({ok:false,json:async()=>({error:'Invalid shapes',diagnostic:{code:'VISUAL_PLAN_INVALID'}})});
  await vm.runInContext('requestGeneratedVisual(testSession,"cat")',env.ctx);assert.equal(env.s.visualsPaused,false);
  await vm.runInContext('requestGeneratedVisual(testSession,"dog")',env.ctx);assert.equal(env.s.visualsPaused,true);
});

test('A negated board request does not suppress the ordinary Qwen reply',()=>{
  const env=mockEnvironment();Object.assign(env.s,{visualsEnabled:true,visualGrant:'grant'});
  emit(env,'input_audio_buffer.speech_started');emit(env,'input_audio_buffer.speech_stopped');emit(env,'conversation.item.input_audio_transcription.completed',{transcript:"I do not want tic tac toe"});
  emit(env,'response.created',{response:{id:'normal-reply'}});
  assert.equal(vm.runInContext('visualActivity.isActive()',env.ctx),false);assert.equal(env.s.localVisualTurn,false);assert.equal(env.s.playbackSuppressed,false);
});
test('A delayed planner cannot append a second follow-up to the same spoken turn',()=>{
  const env=mockEnvironment();env.s.hadAudibleReply=true;env.s.audioMeter={isAudible:()=>false};
  vm.runInContext('scheduleCompanionFollowUp(testSession,"A blue cat hops.","A blue cat","completed","Moon or Mars?")',env.ctx);env.flushTimeouts(6000);
  vm.runInContext('scheduleCompanionFollowUp(testSession,"A blue cat hops.","A blue cat","completed","Would it like boots?")',env.ctx);env.flushTimeouts(6000);
  assert.equal(env.calls.filter(c=>c[0]==='followup').length,1);
});
