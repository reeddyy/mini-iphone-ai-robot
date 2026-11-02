import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';

// Use companion-smoke-server.mjs and a fresh synthetic-media Chromium on 9228.
// All provider responses come from the local fixture; no real AI credentials.
const base='http://127.0.0.1:3109';
const pages=await (await fetch('http://127.0.0.1:9228/json')).json();
const ws=new WebSocket(pages.find(page=>page.type==='page').webSocketDebuggerUrl);
await new Promise(resolve=>ws.addEventListener('open',resolve,{once:true}));
let id=0;
const pending=new Map(),errors=[];
ws.addEventListener('message',({data})=>{
  const message=JSON.parse(data);
  if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails.text);
  if(pending.has(message.id)){
    const {resolve,reject}=pending.get(message.id);pending.delete(message.id);
    message.error?reject(Error(JSON.stringify(message.error))):resolve(message.result);
  }
});
function rpc(method,params={}){
  return new Promise((resolve,reject)=>{
    pending.set(++id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));
  });
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

try{
  await rpc('Page.enable');await rpc('Runtime.enable');
  const seed=await rpc('Page.addScriptToEvaluateOnNewDocument',{source:`
    localStorage.setItem('mini-parent-settings-v1',JSON.stringify({language:'zh',sessionLimit:'5',personality:'calm',visualResponses:false,keepConversationGoing:false,reactionSounds:false}));
    localStorage.setItem('mini-safe-family-note-v1','Legacy note must not enter a session');
  `});
  await rpc('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await rpc('Page.navigate',{url:base});
  await waitFor(`document.readyState==='complete' && mode==='realtime'`);
  await rpc('Page.removeScriptToEvaluateOnNewDocument',{identifier:seed.identifier});
  assert.equal(await evaluate('current'),null,'loading the page never starts capture');
  assert.deepEqual(await evaluate(`Array.from(document.querySelectorAll('#parentSetup input[type="checkbox"]'),el=>({id:el.id,on:el.checked}))`),[
    {id:'sendVideo',on:true},{id:'generatedPictures',on:true},
  ]);
  assert.equal(await evaluate(`$('language').value`),'zh','keep the saved language');
  await evaluate(`$('parentSettingsBtn').click();true`);
  for(const [width,height] of [[320,568],[390,844],[430,932],[844,390]]){
    await rpc('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});
    assert.equal(await evaluate(`$('parentSetup').scrollWidth <= $('parentSetup').clientWidth`),true,'settings fit '+width+'×'+height);
    assert.equal(await evaluate(`$('parentDiagnostics').open`),false,'technical controls stay collapsed');
    if(width===390){
      const screenshot=await rpc('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
      await writeFile('/tmp/mini-parent-settings.png',Buffer.from(screenshot.data,'base64'));
    }
  }
  await rpc('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await evaluate(`
    window.captureCalls=[];window.sessionRequests=0;window.confirmations=[];window.approveStart=false;
    window.confirm=message=>{confirmations.push(message);return approveStart;};
    window.originalCapture=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia=constraints=>{captureCalls.push(constraints);return originalCapture(constraints);};
    window.originalFetch=window.fetch;
    window.fetch=(url,options)=>{if(String(url).includes('/api/realtime/'))sessionRequests++;return originalFetch(url,options);};
    $('accessCode').value='coherent-parent-fixture';$('startBtn').click();true
  `);
  assert.equal(await evaluate('captureCalls.length'),0,'Cancel prevents capture');
  assert.equal(await evaluate('sessionRequests'),0,'Cancel prevents paid connection');
  assert.match(await evaluate('confirmations.at(-1)'),/Camera: shared with Qwen/);
  assert.match(await evaluate('confirmations.at(-1)'),/extra image charges/);
  await evaluate(`mode='preview';approveStart=true;$('startBtn').click();true`);
  await waitFor('Boolean(current?.ready)');
  assert.deepEqual(await evaluate(`({camera:current.wantVideo,reactions:current.awarenessEnabled,hellos:current.spokenGreetings,learning:current.keepConversationGoing,visuals:current.visualsEnabled,personality:current.personality,note:current.note || ''})`),{
    camera:true,reactions:true,hellos:true,learning:true,visuals:true,personality:'playful',note:'',
  },'legacy feature-off preferences and notes do not override new defaults');
  assert.equal(await evaluate(`$('resetSettingsBtn').disabled`),true);
  await evaluate(`window.capturedTracks=current.localStream.getTracks();$('kidStopBtn').click();true`);
  assert.equal(await evaluate('capturedTracks.every(track=>track.readyState===\'ended\')'),true);
  assert.equal(await evaluate(`current===null && $('sendVideo').checked && $('generatedPictures').checked`),true);
  assert.equal(await evaluate('captureCalls.length'),1,'Stop does not restart capture');

  await evaluate(`openParentSetup();$('accessCode').value='coherent-parent-fixture';$('sendVideo').checked=false;$('generatedPictures').checked=false;render();$('startBtn').click();true`);
  await waitFor('Boolean(current?.ready)');
  assert.equal(await evaluate('current.localStream.getVideoTracks().length'),0,'camera off allows microphone-only play');
  assert.match(await evaluate('confirmations.at(-1)'),/Test the microphone locally/);
  await evaluate(`$('kidStopBtn').click();$('language').value='en';$('language').dispatchEvent(new Event('change'));true`);
  assert.equal(await evaluate(`!$('sendVideo').checked && !$('generatedPictures').checked`),true,'Stop preserves explicit off choices');
  const stored=await evaluate(`JSON.parse(localStorage.getItem('mini-parent-settings-v1'))`);
  assert.deepEqual(Object.keys(stored).sort(),['facing','language','listenSensitivity','sessionLimit','videoMode','visionQuality']);

  await rpc('Page.reload');await waitFor(`document.readyState==='complete' && mode==='realtime'`);
  assert.equal(await evaluate(`$('sendVideo').checked && $('generatedPictures').checked && current===null`),true,'new visits restore enabled defaults without capture');
  assert.equal(await evaluate(`$('language').value`),'en');
  await evaluate(`openParentSetup();$('parentDiagnostics').open=true;$('resetSettingsBtn').click();true`);
  assert.equal(await evaluate(`$('language').value==='auto' && $('sessionLimit').value==='15' && localStorage.length===0 && current===null`),true,'Reset removes old preferences without capture');
  assert.deepEqual(errors,[]);
  console.log('PASS: minimal mobile settings, enabled defaults, legacy preference handling, explicit confirmation, Cancel without capture/paid calls, voice-only choice, Stop teardown, safe persistence and Reset.');
}finally{
  ws.close();
}
