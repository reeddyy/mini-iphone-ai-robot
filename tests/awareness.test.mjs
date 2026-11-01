import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {validateObservation,validateFrames} from '../awareness-provider.mjs';

const visible=(extra={})=>({version:1,personPresent:true,faceVisible:true,smiling:false,waving:false,confidence:.95,...extra});
function api() {const window={};vm.runInNewContext(readFileSync(new URL('../public/mini-awareness.js',import.meta.url),'utf8'),{window,AbortController,Date,setInterval:()=>1,clearInterval(){}});return window.MiniAwareness;}
test('Only bounded observable cues are accepted, never identity or emotion output',()=>{
  assert.equal(validateObservation(visible({smiling:true})).smiling,true);
  for(const value of [visible({emotion:'happy'}),visible({name:'Alice'}),visible({confidence:NaN}),visible({confidence:1.1}),visible({faceVisible:false,smiling:true}),visible({personPresent:false,waving:true}),{version:1,personPresent:true}])assert.throws(()=>validateObservation(value));
  for(const frames of [[],['https://example.com/a.jpg','https://example.com/b.jpg'],['data:image/svg+xml;base64,AA==','data:image/svg+xml;base64,AA=='],Array(2).fill('data:image/jpeg;base64,'+'A'.repeat(120000))])assert.throws(()=>validateFrames(frames));
});
test('Reaction policy requires confidence, responds to changes, and respects reaction and spoken cooldowns',()=>{
  const policy=api().createPolicy();
  assert.equal(policy.accept(visible({confidence:.84}),0,true),null);
  assert.equal(policy.accept(visible(),100,true).cue,'hello');
  assert.equal(policy.accept(visible({smiling:true}),200,true),null);
  policy.accept(visible(),300);
  const wave=policy.accept(visible({waving:true}),31000,true);assert.equal(wave.cue,'wave');assert.equal(wave.spoken,false);
  assert.equal(policy.accept(visible({waving:true}),70000,true),null,'a held gesture is not repeated');
  policy.accept(visible(),71000);
  assert.equal(policy.accept(visible({smiling:true}),72000,true).spoken,false,'smiles never trigger spoken greetings');
  policy.accept(visible({personPresent:false,faceVisible:false}),103000);
  assert.equal(policy.accept(visible(),110000),null,'a short absence does not re-greet');
  policy.accept(visible({personPresent:false,faceVisible:false}),120000);
  assert.equal(policy.accept(visible(),145000,true).cue,'hello');
});
test('A session produces at most eight reactions',()=>{
  const policy=api().createPolicy();let count=0;
  for(let i=0;i<12;i++){policy.accept(visible(),i*40000);if(policy.accept(visible({waving:true}),i*40000+31000))count++;}
  assert.equal(count,7,'the initial hello plus seven changed waves use the budget');
});
function runner(overrides={}) {
  let time=0,allowed=true,requests=0,frames=0,cleared=false;
  const cues=[],states=[],pixels=Uint8ClampedArray.from([1,2,3,255]);
  const controller=api().start({now:()=>time,allowed:()=>allowed,spoken:false,capture:async()=>({frame:'frame-'+(++frames),pixels,facePresent:null}),
    observe:async()=>{requests++;return visible();},onCue:value=>cues.push(value),onStatus:value=>states.push(value),
    setInterval:()=>7,clearInterval:id=>{cleared=id===7;},...overrides});
  return {controller,cues,states,time:value=>{time=value;},allow:value=>{allowed=value;},requests:()=>requests,cleared:()=>cleared};
}
test('Local motion gates paired checks, stationary scenes use a slower heartbeat, and stop cancels the timer',async()=>{
  const env=runner();await env.controller.tick();env.time(2000);await env.controller.tick();
  assert.equal(env.requests(),1);assert.equal(env.cues[0].cue,'hello');
  for(const time of [4000,8000,16000,30000]){env.time(time);await env.controller.tick();}
  assert.equal(env.requests(),1);
  env.time(48000);await env.controller.tick();env.time(50000);await env.controller.tick();assert.equal(env.requests(),2);
  env.controller.stop();env.time(100000);await env.controller.tick();assert.equal(env.requests(),2);assert.equal(env.cleared(),true);
});
test('New speech, pause or stop invalidates in-flight observations without a late reaction',async()=>{
  for(const action of ['interrupt','toggle','stop']) {
    let resolve,signal,started;const ready=new Promise(r=>{started=r;});
    const env=runner({observe:(_frames,value)=>{signal=value;started();return new Promise(r=>{resolve=r;});}});
    await env.controller.tick();env.time(2000);const pending=env.controller.tick();
    await ready;env.controller[action]();assert.equal(signal.aborted,true);
    resolve(visible({waving:true}));await pending;assert.equal(env.cues.length,0,action);
  }
});
test('A provider failure pauses observations without an automatic retry',async()=>{
  let attempts=0;
  const env=runner({observe:async()=>{attempts++;throw new Error('private upstream body');}});
  await env.controller.tick();env.time(2000);await env.controller.tick();env.time(60000);await env.controller.tick();
  assert.equal(attempts,1);assert.equal(env.controller.isPaused(),true);assert.doesNotMatch(env.states.at(-1).message,/private/);
});
test('Disallowed camera capture and low-confidence results never react',async()=>{
  let captures=0;
  const env=runner({capture:async()=>{captures++;return {frame:'frame',pixels:new Uint8ClampedArray(4),facePresent:null};},observe:async()=>visible({confidence:.5})});
  env.allow(false);await env.controller.tick();assert.equal(captures,0);
  env.allow(true);await env.controller.tick();env.time(2000);await env.controller.tick();assert.equal(env.cues.length,0);
});

test('Exhausting the reaction budget stops further paid observations, including after Resume',async()=>{
  let calls=0;
  const env=runner({observe:async()=>visible({personPresent:calls++%2===0,faceVisible:(calls-1)%2===0})});
  for(let i=0;i<15;i++){env.time(i*47000);await env.controller.tick();env.time(i*47000+2000);await env.controller.tick();}
  assert.equal(env.cues.length,8);assert.equal(calls,15);
  env.time(800000);await env.controller.tick();assert.equal(env.controller.isPaused(),true);
  env.controller.toggle();env.time(900000);await env.controller.tick();assert.equal(calls,15);
});
