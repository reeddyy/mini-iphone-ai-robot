import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';

// Real synthetic camera capture/CSS; scripted landmark workers deliberately
// stall. No live Qwen transport, physical Safari or recognition-accuracy claim.
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
async function checkpoint(name,fn){await fn();results.push(name);console.log('PASS: '+name);}
async function screenshot(name){
  const shot=await rpc('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
  await writeFile('/tmp/mini-head-'+name+'-2026-11-03.png',Buffer.from(shot.data,'base64'));
}
try{
  await fetch(base+'/__fixture/reset');await rpc('Page.enable');await rpc('Runtime.enable');
  await rpc('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await rpc('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
  await rpc('Page.navigate',{url:base});await waitFor(`document.readyState==='complete' && mode==='realtime'`);
  await evaluate(`window.deviceSpeech=0;speechSynthesis.speak=()=>{deviceSpeech++;};window.captures=0;const capture=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=options=>{captures++;return capture(options);};window.confirm=()=>true;mode='preview';$('sendVideo').checked=true;$('accessCode').value='coherent-parent-fixture';startMini();true`);
  await waitFor(`Boolean(current?.ready) && $('preview').videoWidth>0`);
  await evaluate(`(()=>{
    const s=current;s.awareness?.stop();s.awareness=null;s.mode='realtime';s.mediaReady=true;s.visualsEnabled=false;s.imagesAllowed=false;
    s.audioMeter={isAudible:()=>false,stop(){}};s.pc={connectionState:'connected',close(){this.connectionState='closed';}};
    window.originalSession=s;window.originalPeer=s.pc;window.originalTracks=s.localStream.getTracks();
    window.pose=.3;window.shift=0;window.smile=false;window.freeze=false;window.frames=0;window.workers=[];
    window.testFace=()=>{
      const p=Array.from({length:468},()=>({x:.5,y:.5}));
      Object.assign(p,{234:{x:.25,y:.5},454:{x:.75,y:.5},10:{x:.5,y:.2},152:{x:.5,y:.8},61:{x:smile?.39:.42,y:smile?.59:.61},291:{x:smile?.61:.58,y:smile?.59:.61},13:{x:.5,y:.61},14:{x:.5,y:.63},33:{x:.32,y:.4},133:{x:.43,y:.4},159:{x:.375,y:.38},145:{x:.375,y:.42},362:{x:.57,y:.4},263:{x:.68,y:.4},386:{x:.625,y:.38},374:{x:.625,y:.42}});
      return p.map(point=>({x:.5+shift+(point.x-.5)*Math.cos(pose)-(point.y-.5)*Math.sin(pose),y:.5+(point.x-.5)*Math.sin(pose)+(point.y-.5)*Math.cos(pose)}));
    };
    const makeWorker=()=>{
      const index=workers.length,worker={terminated:0,postMessage(message){
        if(message.type==='start')setTimeout(()=>this.onmessage({data:{type:'ready'}}),1);
        if(message.type==='frame'){
          message.bitmap.close();
          if(freeze && index===0)return;
          setTimeout(()=>{this.onmessage({data:{type:'landmarks',points:testFace()}});this.onmessage({data:{type:'done'}});frames++;},1);
        }
      },terminate(){this.terminated++;}};
      workers.push(worker);return worker;
    };
    const local=MiniLocalAwareness;window.MiniLocalAwareness={...local,start:options=>local.start({...options,createWorker:makeWorker})};
    startAwareness(s);return true;
  })()`);
  await checkpoint('An initially tilted face calibrates to an upright Mini with animation running',async()=>{
    await waitFor(`frames>=3 && $('robotFace').dataset.cameraTracking==='true'`);
    assert.equal(await evaluate(`parseFloat(getComputedStyle($('robotFace')).rotate)`),0);
    assert.equal(await evaluate(`getComputedStyle($('robotFace')).animationName`),'mini-float');
    await screenshot('neutral');
  });
  await checkpoint('Head rotation follows both directions independently of the floating animation',async()=>{
    await evaluate(`pose=.55;true`);await waitFor(`parseFloat(getComputedStyle($('robotFace')).rotate)<-5`);
    await screenshot('right');
    await evaluate(`pose=.05;true`);await waitFor(`parseFloat(getComputedStyle($('robotFace')).rotate)>5`);
    await screenshot('left');
  });
  await checkpoint('Position and visible smiles still update the eyes and expression',async()=>{
    const before=await evaluate(`$('robotFace').style.getPropertyValue('--look-x')`);
    await evaluate(`shift=.1;pose=.3;smile=true;true`);
    await waitFor(`$('robotFace').style.getPropertyValue('--look-x')!==${JSON.stringify(before)} && $('robotFace').dataset.cameraSmile==='true' && $('robotFace').dataset.expression==='happy'`);
    assert.equal(await evaluate(`deviceSpeech`),0);
  });
  await checkpoint('Reduced motion preserves direct head following while decorative animation stops',async()=>{
    await rpc('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
    await evaluate(`pose=.55;true`);await waitFor(`parseFloat(getComputedStyle($('robotFace')).rotate)<-5`);
    assert.equal(await evaluate(`getComputedStyle($('robotFace')).animationName`),'none');
    await rpc('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
  });
  await checkpoint('A stalled landmark frame clears the old pose and face-in-view status',async()=>{
    await evaluate(`freeze=true;true`);
    await waitFor(`!$('robotFace').dataset.cameraTracking && /Waiting for fresh/.test($('awarenessStatus').textContent)`);
    assert.equal(await evaluate(`$('robotFace').style.getPropertyValue('--camera-head-tilt')`),'');
    assert.equal(await evaluate(`workers.length`),1);
    await screenshot('stale-cleared');
  });
  await checkpoint('The local tracker recovers without replacing capture or the voice peer',async()=>{
    await waitFor(`workers.length===2 && $('robotFace').dataset.cameraTracking==='true'`);
    assert.equal(await evaluate(`workers[0].terminated`),1);
    assert.equal(await evaluate(`parseFloat(getComputedStyle($('robotFace')).rotate)`),0);
    assert.equal(await evaluate(`current===originalSession && current.pc===originalPeer && captures===1 && originalTracks.every(track=>track.readyState==='live')`),true);
    await evaluate(`workers[0].onmessage({data:{type:'landmarks',points:[]}});pose=.05;true`);
    await waitFor(`parseFloat(getComputedStyle($('robotFace')).rotate)>5`);
  });
  await checkpoint('Pausing and resuming local reactions clears and recalibrates the pose',async()=>{
    await evaluate(`current.awareness.toggle();true`);
    assert.equal(await evaluate(`$('robotFace').dataset.cameraTracking`),undefined);
    await evaluate(`pose=.8;current.awareness.toggle();true`);
    await waitFor(`$('robotFace').dataset.cameraTracking==='true'`);
    await waitFor(`Math.abs(parseFloat(getComputedStyle($('robotFace')).rotate))<.1`);
    assert.equal(await evaluate(`captures`),1);
  });
  await checkpoint('Stop clears camera pose, terminates workers and releases all tracks',async()=>{
    await evaluate(`stopMini('Head review complete');true`);
    assert.equal(await evaluate(`current===null && originalTracks.every(track=>track.readyState==='ended') && workers.every(worker=>worker.terminated===1) && !$('robotFace').dataset.cameraTracking && !$('robotFace').style.getPropertyValue('--camera-head-tilt')`),true);
    assert.equal(await evaluate(`deviceSpeech`),0);
  });
  const fixture=await (await fetch(base+'/__fixture/state')).json();
  assert.equal(fixture.plans.length,0);assert.equal(fixture.imageCalls,0);assert.deepEqual(errors,[]);
  await writeFile('/tmp/mini-head-results-2026-11-03.json',JSON.stringify({scope:'local Chromium; real synthetic capture and CSS; scripted landmark workers/stall; physical Safari and actual Qwen audio unverified',results,captures:await evaluate(`captures`),workers:await evaluate(`workers.length`),deviceUtterances:await evaluate(`deviceSpeech`),errors,providerPlans:0,providerImages:0},null,2));
  console.log(`PASS: ${results.length} head tracking/recovery browser scenarios; no provider calls.`);
}finally{
  await evaluate(`if(current)stopMini('Head review complete');true`).catch(()=>{});ws.close();
}
