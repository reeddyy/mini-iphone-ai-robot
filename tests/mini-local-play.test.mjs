import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
function setup() {
  let now=0,id=0,session=null;
  const timers=new Map(),elements=new Map();
  function element(){const listeners=new Map();return {textContent:'',dataset:{},offsetWidth:20,
    classList:{add(){},remove(){},toggle(){}},style:{setProperty(){},removeProperty(){}},
    appendChild(){},setAttribute(){},removeAttribute(){},scrollIntoView(){},
    addEventListener(type,fn){listeners.set(type,fn);},click(){listeners.get('click')?.();}};}
  const get=id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id);};
  const window={scrollTo(){}};
  const ctx=vm.createContext({window,document:{getElementById:get,createElement:element},Date,
    setTimeout(fn,ms){timers.set(++id,{at:now+ms,fn});return id;},clearTimeout(id){timers.delete(id);}});
  for(const name of ['mini-kids.js','mini-child-ui.js'])vm.runInContext(readFileSync(new URL('../public/'+name,import.meta.url),'utf8'),ctx);
  const ui=window.MiniChildUI.init({getSession:()=>session,getLanguage:()=> 'en',getReactionSounds:()=>false,stopSession(){}});
  function tick(ms){const end=now+ms;for(let n=0;n<200;n++){const next=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;timers.delete(next[0]);now=next[1].at;next[1].fn();}now=end;}
  return {ui,get,tick,setSession:s=>{session=s;},timers,window};
}
test('Local copy game completes three rounds without microphone, camera, network or speech APIs',()=>{
  const env=setup();
  env.get('localPlayBtn').click();
  assert.match(env.get('kidLiveTag').textContent,/LOCAL PLAY/);
  assert.match(env.get('kidGameMode').textContent,/Mic and camera off/);
  for(const taps of [2,3,2]) {
    env.tick(taps*650+150);
    assert.match(env.get('kidHint').textContent,new RegExp('tap Mini '+taps));
    for(let i=0;i<taps;i++)env.get('robotFace').click();
    assert.match(env.get('kidHint').textContent,/copied it/);
    env.tick(1700);
  }
  assert.equal(env.get('robotFace').dataset.expression,'sleepy');
  assert.match(env.get('kidHint').textContent,/resting/);
  assert.equal(env.timers.size,0);
});
test('Starting capture cancels local play and active sessions cannot start it',()=>{
  const env=setup();env.get('localPlayBtn').click();
  env.setSession({stopped:false,ready:false});
  env.ui.onStatus({running:true,online:false,state:'thinking'});
  env.tick(5000);
  assert.doesNotMatch(env.get('kidHint').textContent,/Your turn—tap/);
  env.get('localPlayBtn').click();
  assert.doesNotMatch(env.get('kidLiveTag').textContent,/LOCAL PLAY/);
});
test('Voice detection interrupts a coordinated reaction and restores attention',()=>{
  const env=setup();env.ui.reactToMiniSpeech('Correct! Great job!');
  assert.equal(env.get('robotFace').dataset.sequence,'celebrate');
  env.ui.onVoiceDetected(true);
  assert.equal(env.get('robotFace').dataset.sequence,undefined);
  env.tick(1800);
  assert.notEqual(env.get('robotFace').dataset.expression,'happy');
});

test('Local play is silent by default and never initializes an audio context',()=>{
  const env=setup();let contexts=0;
  env.window.AudioContext=class {constructor(){contexts++;throw Error('Should not initialize');}};
  env.get('localPlayBtn').click();env.tick(1600);
  assert.equal(contexts,0);
});

test('Visible cues animate only with camera awareness consent and yield to speech',()=>{
  const env=setup(),session={ready:true,stopped:false,awarenessEnabled:true,wantVideo:true};env.setSession(session);
  assert.equal(env.ui.reactToVisualCue({cue:'wave'}),true);assert.equal(env.get('robotFace').dataset.expression,'wink');
  env.tick(1200);
  assert.equal(env.ui.reactToVisualCue({cue:'smile'}),true);assert.equal(env.get('robotFace').dataset.expression,'happy');
  session.childSpeaking=true;assert.equal(env.ui.reactToVisualCue({cue:'wave'}),false);session.childSpeaking=false;
  session.videoPaused=true;assert.equal(env.ui.reactToVisualCue({cue:'wave'}),false);session.videoPaused=false;
  session.awarenessEnabled=false;assert.equal(env.ui.reactToVisualCue({cue:'wave'}),false);
  assert.equal(env.ui.reactToVisualCue({cue:'sad'}),false);
});
