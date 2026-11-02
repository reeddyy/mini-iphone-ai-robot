import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../public/mini-local-awareness.js',import.meta.url),'utf8');
function api(){const context=vm.createContext({window:{},Math,Number,Array,Date,setTimeout,clearTimeout,setInterval,clearInterval});vm.runInContext(source,context);return context.window.MiniLocalAwareness;}
function face(smile=false){
  const p=Array.from({length:468},()=>({x:.5,y:.5}));
  Object.assign(p,{234:{x:.25,y:.5},454:{x:.75,y:.5},10:{x:.5,y:.2},152:{x:.5,y:.8},
    61:{x:smile?.39:.42,y:smile?.59:.61},291:{x:smile?.61:.58,y:smile?.59:.61},13:{x:.5,y:.61},14:{x:.5,y:.63},
    33:{x:.32,y:.4},133:{x:.43,y:.4},159:{x:.375,y:.38},145:{x:.375,y:.42},
    362:{x:.57,y:.4},263:{x:.68,y:.4},386:{x:.625,y:.38},374:{x:.625,y:.42}});return p;
}
test('Local geometry estimates only visible smile, gaze and head tilt',()=>{
  const local=api();assert.equal(local.geometry(face()).smile,false);assert.equal(local.geometry(face(true)).smile,true);
  assert.equal(local.geometry([]),null);const bad=face();bad[0].x=NaN;assert.equal(local.geometry(bad),null);
  const policy=local.createPolicy();assert.equal(policy.accept(face(),0).cue,'hello');
  assert.equal(policy.accept(face(true),6100).cue,null);assert.equal(policy.accept(face(true),6400).cue,'smile');
  assert.equal(policy.accept(face(true),13000).cue,null,'holding a smile does not repeat it');
  for(let i=0;i<12;i++){policy.accept(face(),20000+i*7000);policy.accept(face(true),20100+i*7000);assert.equal(policy.accept(face(true),20400+i*7000).cue,'smile','local reactions have no eight-cue exhaustion');}
});
test('Local tracking never uploads frames and releases its worker immediately on stop',async()=>{
  const local=api(),sent=[],looks=[],states=[];let destroyed=0,tick;
  const worker={postMessage:message=>sent.push(message),terminate:()=>destroyed++};
  const tracker=local.start({worker,video:{videoWidth:640,readyState:4},capture:async()=>({close(){}}),allowed:()=>true,
    onLook:cue=>looks.push(cue),onStatus:s=>states.push(s),setInterval:callback=>{tick=callback;return 1;},clearInterval(){}});
  assert.equal(sent[0].type,'start');worker.onmessage({data:{type:'ready'}});await new Promise(resolve=>setImmediate(resolve));
  assert.equal(sent[1].type,'frame');worker.onmessage({data:{type:'landmarks',points:face(true)}});assert.equal(looks.at(-1).face,true);
  tracker.toggle();worker.onmessage({data:{type:'landmarks',points:face(true)}});assert.equal(looks.at(-1),null);
  tracker.stop();assert.equal(destroyed,1);await tick();assert.equal(sent.length,2);assert.equal(states.at(-1).state,'off');
});

test('A greeting does not delay the first smile; pause discards in-flight landmarks after resuming',async()=>{
  const local=api(),policy=local.createPolicy();policy.accept(face(),0);policy.accept(face(true),250);assert.equal(policy.accept(face(true),500).cue,'smile');
  const looks=[];const worker={postMessage(){},terminate(){}};
  const tracker=local.start({worker,video:{videoWidth:640,readyState:4},capture:async()=>({close(){}}),allowed:()=>true,onLook:x=>looks.push(x),setInterval:()=>1,clearInterval(){}});
  worker.onmessage({data:{type:'ready'}});await new Promise(resolve=>setImmediate(resolve));
  tracker.toggle();tracker.toggle();worker.onmessage({data:{type:'landmarks',points:face(true)}});assert.equal(looks.at(-1),null);tracker.stop();
});

test('Gentle cumulative head motion is noticed instead of requiring a single-frame jerk',()=>{
  const policy=api().createPolicy();policy.accept(face(),0);let latest;
  for(let i=1;i<=4;i++){const points=face().map(p=>({...p,x:p.x+i*.01}));latest=policy.accept(points,i*250);}
  assert.equal(latest.cue,'motion');
});

test('A fresh camera cue waits for silence, then speaks once rather than disappearing during an answer',()=>{
  const policy=api().createPolicy();
  assert.equal(policy.accept(face(),0,false).spoken,false);
  const hello=policy.accept(face(),7000,true);assert.equal(hello.spokenCue,'hello');assert.equal(hello.spoken,true);
  assert.equal(policy.accept(face(),8000,true).spoken,false,'a held face does not start a greeting loop');
  policy.accept(face(true),28000,false);policy.accept(face(true),28300,false);
  const smile=policy.accept(face(true),31000,true);assert.equal(smile.spokenCue,'smile');
  assert.equal(policy.accept(face(true),32000,true).spoken,false,'a held smile is not repeated');
});

test('Spoken camera reactions have a cooldown and discard faces that left the view',()=>{
  const policy=api().createPolicy();assert.equal(policy.accept(face(),0,true).spoken,true);
  policy.accept(face(true),3000,false);assert.equal(policy.accept(face(true),3300,true).spoken,false,'20 second speech cooldown');
  policy.accept([],5000,true);assert.equal(policy.accept(face(),7000,false).spoken,false);
  for(const now of [12000,17000,22000,27000])policy.accept(face(),now,false);
  assert.equal(policy.accept(face(),30000,true).spoken,false,'expired pending cue cannot speak');
});

function rolledFace(angle){
  return face().map(point=>({x:.5+(point.x-.5)*Math.cos(angle)-(point.y-.5)*Math.sin(angle),y:.5+(point.x-.5)*Math.sin(angle)+(point.y-.5)*Math.cos(angle)}));
}
test('Head tracking starts upright despite the phone angle, then moves in both directions',()=>{
  const policy=api().createPolicy();assert.equal(policy.accept(rolledFace(.3),0).tilt,0);
  let right,left;
  for(let i=1;i<=4;i++)right=policy.accept(rolledFace(.5),i*200);
  for(let i=5;i<=10;i++)left=policy.accept(rolledFace(.1),i*200);
  assert.ok(right.tilt<-5);assert.ok(left.tilt>5);
  policy.accept([],3000);assert.equal(policy.accept(rolledFace(-.4),3200).tilt,0,'reacquiring a face recalibrates neutral');
});

test('Roll geometry respects the video aspect ratio instead of treating normalized coordinates as square',()=>{
  const local=api(),points=rolledFace(.2);
  assert.ok(local.geometry(points,.75).tilt>local.geometry(points,1.5).tilt);
});

function recoveryEnvironment(){
  let clock=0,closed=0,timerId=0;
  const workers=[],looks=[],states=[],timers=new Map();
  const createWorker=()=>{const worker={messages:[],terminated:0,postMessage(message){this.messages.push(message);},terminate(){this.terminated++;}};workers.push(worker);return worker;};
  const tracker=api().start({createWorker,video:{videoWidth:640,videoHeight:480,readyState:4},now:()=>clock,
    capture:async()=>({close(){closed++;}}),allowed:()=>true,onLook:look=>looks.push(look),onStatus:state=>states.push(state),
    setInterval:()=>1,clearInterval(){},setTimeout:(fn,ms)=>{timers.set(++timerId,{fn,ms});return timerId;},clearTimeout:id=>timers.delete(id)});
  return {tracker,workers,looks,states,setTime:value=>{clock=value;},closed:()=>closed};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));

test('A stalled frame clears the old pose, restarts only the local worker and ignores stale results',async()=>{
  const env=recoveryEnvironment();
  try{
    const first=env.workers[0];first.onmessage({data:{type:'ready'}});await flush();
    first.onmessage({data:{type:'landmarks',points:rolledFace(.2)}});first.onmessage({data:{type:'done'}});
    assert.equal(env.looks.at(-1).face,true);
    env.setTime(1300);await env.tracker.tick();assert.equal(env.looks.at(-1),null);
    env.setTime(7400);await env.tracker.tick();assert.equal(first.terminated,1);assert.equal(env.workers.length,2);
    first.onmessage({data:{type:'landmarks',points:rolledFace(-.6)}});assert.equal(env.looks.at(-1),null);
    const second=env.workers[1];second.onmessage({data:{type:'ready'}});await flush();
    second.onmessage({data:{type:'landmarks',points:rolledFace(-.2)}});second.onmessage({data:{type:'done'}});
    assert.equal(env.looks.at(-1).tilt,0);assert.equal(env.tracker.isUnavailable(),false);
  }finally{env.tracker.stop();}
});

test('Repeated tracker stalls have a bounded retry and stop leaves no worker running',async()=>{
  const env=recoveryEnvironment();
  try{
    for(let i=0;i<3;i++){
      env.workers[i].onmessage({data:{type:'ready'}});await flush();
      env.setTime((i+1)*7000);await env.tracker.tick();
    }
    assert.equal(env.workers.length,3);assert.equal(env.tracker.isUnavailable(),true);
    assert.equal(env.looks.at(-1),null);assert.ok(env.workers.every(worker=>worker.terminated===1));
  }finally{env.tracker.stop();}
});

test('A paused preview is resumed using the existing video without a new capture request',async()=>{
  const local=api();let plays=0,captures=0;
  const video={videoWidth:640,videoHeight:480,readyState:4,paused:true,play(){plays++;this.paused=false;return Promise.resolve();}};
  const worker={postMessage(){},terminate(){}};
  const tracker=local.start({worker,video,allowed:()=>true,capture:async()=>{captures++;return {close(){}};},setInterval:()=>1,clearInterval(){}});
  try{worker.onmessage({data:{type:'ready'}});await flush();assert.equal(plays,1);assert.equal(captures,0);await tracker.tick();assert.equal(captures,1);}
  finally{tracker.stop();}
});
