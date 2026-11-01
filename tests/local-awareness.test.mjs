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
