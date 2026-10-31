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
  const fake=()=>({
    textContent:'',value:'',checked:false,disabled:false,srcObject:null,
    className:'',
    classList:{toggle(){},add(){},remove(){}},
    style:{setProperty(){},removeProperty(){}},
    addEventListener(){},append(){},pause(){},play(){return Promise.resolve();},
  });
  const get=id=>{if(!elements.has(id))elements.set(id,fake());return elements.get(id)};
  const document={
    getElementById:get,
    createElement:()=>fake(),
    createTextNode:text=>text,
    addEventListener(){},
  };
  let eventId=0;
  const companionUI={
    onStatus(x){calls.push(['status',x.state]);},
    onActivityStart(mode,queued){calls.push(['activity',mode,Boolean(queued)]);},
    onResponseStarted(){calls.push(['response_started']);},
    onResponseFinished(){calls.push(['response_done']);},
    onVoiceDetected(v){calls.push(['voice',v]);},
    onTranscription(text){calls.push(['transcript',text]);},
    sayFallback(mode){calls.push(['fallback',mode]);},
    onLiveReady(){calls.push(['ready']);},
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
      MiniKidsContent:{
        mode:m=>['chat','guess','story','look'].includes(m)?m:'chat',
        instructions:(base,m)=>base+' mode='+m,
      },
      MiniChildUI:{init:()=>companionUI},
      addEventListener(){},
      isSecureContext:true,
    },
    fetch:async()=>({ok:true,json:async()=>({mode:'realtime',model:'test',maxSessionMinutes:60})}),
    crypto:{randomUUID:()=>String(++eventId)},
    performance:{now:()=>1000},
    console,clearTimeout,setTimeout,setInterval,clearInterval,Date,
    AbortController,Uint8Array,
  });
  vm.runInContext(app,ctx);
  const s={
    mode:'realtime',stopped:false,ready:true,mediaReady:true,
    activity:'chat',activityUpdatePending:false,awaitingProactiveResponse:false,
    responseActive:false,childSpeaking:false,userSpokeDuringMode:false,
    baseInstructions:'family-safe instructions',
    wantVideo:false,videoPaused:false,startedAt:Date.now(),endsAt:Date.now()+900000,
    audioInputTrack:{enabled:true},
    eventChannel:{readyState:'open',send:encoded=>sent.push(JSON.parse(encoded))},
    channels:new Set(),abort:new AbortController(),
  };
  ctx.testSession=s;
  vm.runInContext('current = testSession',ctx);
  return {ctx,s,sent,calls};
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
  assert.match(env.sent[0].session.instructions,/mode=guess/);
  emit(env,'session.updated');
  assert.equal(env.sent.length,1,'no proactive response.create is sent in automatic VAD mode');
  assert.ok(env.calls.some(x=>x[0]==='fallback' && x[1]==='guess'));
  assert.equal(env.s.stopped,false);
  emit(env,'input_audio_buffer.speech_started');
  emit(env,'input_audio_buffer.speech_stopped');
  emit(env,'response.created');
  emit(env,'response.done',{response:{status:'completed'}});
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
  assert.match(env.sent[count].session.instructions,/mode=story/);
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
    textContent:'',classList:{add(){},remove(){},toggle(){}},
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
