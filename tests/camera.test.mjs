import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const ctx=vm.createContext({window:{}});vm.runInContext(readFileSync(new URL('../public/mini-camera.js',import.meta.url),'utf8'),ctx);const camera=ctx.window.MiniCamera;
test('AI frames preserve portrait and landscape proportions at both detail levels',()=>{
  for(const [w,h,quality,expected] of [[1280,720,'balanced',[640,360]],[720,1280,'balanced',[360,640]],[480,640,'balanced',[480,640]],[1280,720,'detail',[960,540]],[720,1280,'detail',[540,960]],[320,240,'detail',[320,240]]]){
    const size=camera.frameSize(w,h,quality);assert.deepEqual([size.width,size.height],expected);assert.ok(Math.abs(size.width/size.height-w/h)<.01);
  }
});
test('Outbound pacing changes only sender parameters and preserves negotiated encoding fields',async()=>{
  let applied;
  const sender={getParameters:()=>({encodings:[{rid:'main',active:true}]}),setParameters:async p=>{applied=p;}};
  assert.equal(await camera.configureSender(sender,{fps:2,quality:'detail'}),true);
  assert.equal(applied.encodings[0].rid,'main');assert.equal(applied.encodings[0].maxFramerate,2);assert.equal(applied.encodings[0].maxBitrate,1500000);assert.equal(applied.degradationPreference,'maintain-resolution');
});
test('An unsupported optional sender preference is retried locally without changing capture',async()=>{
  let calls=0;
  const sender={getParameters:()=>({encodings:[{}]}),setParameters:async p=>{calls++;if(p.degradationPreference)throw Error('Unsupported preference');}};
  assert.equal(await camera.configureSender(sender,{fps:1}),true);assert.equal(calls,2);
  assert.equal(await camera.configureSender({getParameters:()=>({encodings:[]})}),false);
});

test('Camera diagnostics report only actual outbound video counters',async()=>{
  const result=await camera.senderStats({getStats:async()=>new Map([['video',{type:'outbound-rtp',kind:'video',framesSent:12,bytesSent:42000,frameWidth:360,frameHeight:640}],['audio',{type:'outbound-rtp',kind:'audio',bytesSent:90000}],['ip',{type:'local-candidate',address:'private-address'}]])});
  assert.deepEqual(JSON.parse(JSON.stringify(result)),{frames:12,bytes:42000,width:360,height:640});assert.doesNotMatch(JSON.stringify(result),/private-address/);
  assert.equal((await camera.senderStats({getStats:async()=>new Map()})).bytes,0);
});
