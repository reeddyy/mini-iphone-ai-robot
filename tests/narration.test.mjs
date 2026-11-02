import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

function environment(initialVoices=[],mode='preview'){
  let clock=0,timerId=0,voices=initialVoices,lastCancel=-Infinity;
  const timers=new Map(),listeners=new Set(),spoken=[],elements=new Map();
  const element=()=>({textContent:'',dataset:{},offsetWidth:5,style:{setProperty(){},removeProperty(){}},
    classList:{add(){},remove(){},toggle(){}},setAttribute(){},removeAttribute(){},addEventListener(){},appendChild(){},
    querySelector(){return {textContent:''};},scrollIntoView(){}});
  const get=id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id);};
  const mic={enabled:true},session={ready:true,stopped:false,muted:false,mode,audioInputTrack:mic};
  const setTimer=(fn,delay)=>{timers.set(++timerId,{fn,at:clock+delay});return timerId;};
  const window={scrollTo(){},SpeechSynthesisUtterance:class{constructor(text){this.text=text;}},
    speechSynthesis:{getVoices:()=>voices,cancel(){lastCancel=clock;},
      speak(utterance){spoken.push({utterance,at:clock,sinceCancel:clock-lastCancel});},
      addEventListener(type,fn){if(type==='voiceschanged')listeners.add(fn);},
      removeEventListener(type,fn){if(type==='voiceschanged')listeners.delete(fn);}}};
  const context=vm.createContext({window,document:{getElementById:get,createElement:element},
    setTimeout:setTimer,clearTimeout:id=>timers.delete(id),Date:{now:()=>clock}});
  for(const file of ['mini-language.js','mini-kids.js','mini-child-ui.js'])vm.runInContext(readFileSync(new URL('../public/'+file,import.meta.url),'utf8'),context);
  const ui=window.MiniChildUI.init({getSession:()=>session,getLanguage:()=> 'en'});
  function advance(ms){
    const end=clock+ms;
    while(true){const next=[...timers].filter(([,timer])=>timer.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];
      if(!next)break;timers.delete(next[0]);clock=next[1].at;next[1].fn();}
    clock=end;
  }
  return {ui,session,mic,spoken,get,advance,lastCancellation:()=>lastCancel,setVoices(next){voices=next;},
    voicesChanged(next){voices=next;for(const fn of [...listeners])fn();},listenerCount:()=>listeners.size};
}
const samantha={name:'Samantha',lang:'en-US',voiceURI:'fixture-samantha'};
const tingting={name:'Tingting',lang:'zh-CN',voiceURI:'fixture-tingting'};

test('Preview narration keeps one suitable device voice at natural rate and pitch',()=>{
  const env=environment([{name:'Daniel',lang:'en-GB',default:true},samantha,tingting]);
  env.ui.sayFallback('chat','Hello! Which animal do you like?','en');env.advance(80);
  const opening=env.spoken.at(-1).utterance;assert.equal(opening.voice.name,'Samantha');
  assert.equal(opening.rate,1);assert.equal(opening.pitch,1);
  opening.onstart();assert.equal(env.mic.enabled,false);opening.onend();assert.equal(env.mic.enabled,true);
  env.setVoices([{name:'Serena',lang:'en-GB'},tingting,samantha]);
  env.ui.sayFallback('chat','You play crosses. Mini plays circles.','en');env.advance(80);
  assert.equal(env.spoken.at(-1).utterance.voice.name,'Samantha');
  env.ui.sayFallback('chat','Two plus one makes three.','en');env.advance(80);
  assert.equal(env.spoken.at(-1).utterance.voice.name,'Samantha');
  assert.equal(env.spoken.every(item=>item.sinceCancel>=80),true,'cancel and speak are separated to avoid clipping');
});

test('Live openings, game and learning cues never start a second device voice or mute the microphone',()=>{
  const env=environment([samantha,tingting],'realtime');
  for(const [text,lang] of [['Hello! Which animal do you like?','en'],['You play crosses. Mini plays circles.','en'],['二加一等于三。','zh']]){
    env.ui.sayFallback('chat',text,lang);env.advance(1000);
    assert.equal(env.get('kidHint').textContent,text);
    assert.equal(env.mic.enabled,true);assert.equal(env.spoken.length,0);
    assert.equal(env.ui.isSpeakingLocally(),false);assert.equal(env.listenerCount(),0);
  }
  assert.match(env.get('narrationVoiceStatus').textContent,/Voice: Tina/);
});

test('Visual-only live cues remain readable after reply completion and clear for the next child turn',()=>{
  const env=environment([samantha],'realtime');
  env.ui.sayFallback('chat','Two explorers and one more: how many?','en');
  env.ui.onResponseFinished();env.ui.onStatus({running:true,online:true,state:'listening'});
  assert.equal(env.get('kidHint').textContent,'Two explorers and one more: how many?');
  env.ui.onVoiceDetected(true);env.ui.onVoiceDetected(false);env.ui.onResponseFinished();
  assert.notEqual(env.get('kidHint').textContent,'Two explorers and one more: how many?');
  assert.equal(env.spoken.length,0);
});

test('Live voice catalog changes cannot create speech and a stopped session cannot restore a cue',()=>{
  const env=environment([],'realtime');env.ui.sayFallback('chat','A local question.','en');
  env.voicesChanged([samantha]);env.advance(2000);assert.equal(env.spoken.length,0);
  env.ui.stopSpeech();env.session.stopped=true;env.ui.onStatus({running:false,online:false,state:'idle'});
  const resting=env.get('kidHint').textContent;env.ui.sayFallback('chat','A stale question.','en');env.advance(2000);
  assert.equal(env.get('kidHint').textContent,resting);assert.equal(env.mic.enabled,true);assert.equal(env.spoken.length,0);
});

test('A late Safari voice catalog is awaited without muting the microphone or speaking twice',()=>{
  const env=environment();env.ui.sayFallback('chat','Your turn!','en');env.advance(80);
  assert.equal(env.spoken.length,0);assert.equal(env.mic.enabled,true);assert.equal(env.listenerCount(),1);
  env.voicesChanged([{name:'Daniel',lang:'en-GB'},samantha]);
  assert.equal(env.spoken.length,1);assert.equal(env.spoken[0].utterance.voice.name,'Samantha');
  env.advance(1000);assert.equal(env.spoken.length,1);assert.equal(env.listenerCount(),0);
  assert.match(env.get('narrationVoiceStatus').textContent,/Samantha.*en-US/);
});

test('Stop during voice loading cancels delayed speech and removes the catalog listener',()=>{
  const env=environment();env.ui.sayFallback('chat','Choose an empty square.','en');env.advance(80);
  env.ui.stopSpeech();env.session.stopped=true;env.voicesChanged([samantha]);env.advance(1000);
  assert.equal(env.spoken.length,0);assert.equal(env.listenerCount(),0);assert.equal(env.mic.enabled,true);
});

test('Rapid game narration changes speak only the latest move',()=>{
  const env=environment([samantha]);
  env.ui.sayFallback('chat','You play crosses.','en');env.advance(20);
  env.ui.sayFallback('chat','Mini put a circle in the center square.','en');env.advance(20);
  env.ui.sayFallback('chat','New round. Choose an empty square.','en');env.advance(80);
  assert.equal(env.spoken.length,1);assert.match(env.spoken[0].utterance.text,/New round/);
});

test('Stale cancelled speech callbacks cannot clear a newer narration or restore its microphone early',()=>{
  const env=environment([samantha]);env.ui.sayFallback('chat','First move.','en');env.advance(80);
  const old=env.spoken.at(-1).utterance;old.onstart();
  env.ui.sayFallback('chat','Second move.','en');assert.equal(env.mic.enabled,true);env.advance(80);
  const next=env.spoken.at(-1).utterance;next.onstart();assert.equal(env.mic.enabled,false);
  old.onerror();old.onend();assert.equal(env.mic.enabled,false);assert.equal(env.ui.isSpeakingLocally(),true);
  next.onend();assert.equal(env.mic.enabled,true);assert.equal(env.ui.isSpeakingLocally(),false);
});

test('Mandarin uses the same pinned Mandarin voice without falling into Cantonese or English',()=>{
  const env=environment([samantha,{name:'Yunxi',lang:'zh-CN'},tingting,{name:'Sin-ji',lang:'zh-Hant-HK'}]);
  env.ui.sayFallback('chat','你是叉，Mini 是圆。','zh');env.advance(80);
  assert.equal(env.spoken.at(-1).utterance.voice.name,'Tingting');assert.equal(env.spoken.at(-1).utterance.lang,'zh-CN');
  env.setVoices([{name:'Meijia',lang:'zh-TW'},tingting,samantha]);
  env.ui.sayFallback('chat','二加一等于三。','zh');env.advance(80);
  assert.equal(env.spoken.at(-1).utterance.voice.name,'Tingting');
});

test('An empty voice catalog has a bounded fallback and never disables capture before actual speech',()=>{
  const env=environment();env.ui.sayFallback('chat','Hello!','en');env.advance(780);
  assert.equal(env.spoken.length,1);assert.equal(env.spoken[0].utterance.lang,'en-US');assert.equal(env.mic.enabled,true);
  assert.match(env.get('narrationVoiceStatus').textContent,/device default/);
  env.ui.stopSpeech();assert.equal(env.mic.enabled,true);
});

test('Long speech keeps its microphone guard, and a missing end event cancels output before restoring capture',()=>{
  const env=environment([samantha]);
  env.ui.sayFallback('chat','A little discovery for our imaginary explorers. '.repeat(5),'en');env.advance(80);
  env.spoken[0].utterance.onstart();env.advance(12500);
  assert.equal(env.mic.enabled,false,'a longer sentence is not treated as finished at a fixed twelve seconds');
  assert.equal(env.ui.isSpeakingLocally(),true);
  env.advance(18000);assert.equal(env.ui.isSpeakingLocally(),false);assert.equal(env.mic.enabled,true);
  assert.ok(env.lastCancellation()>12500,'hung synthesis is cancelled rather than allowed to feed its own microphone');
});
