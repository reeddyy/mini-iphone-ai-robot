import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {readImageModels} from '../model-catalog.mjs';
import {createApp} from '../server.mjs';
const json=value=>new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}});
test('Catalog metadata uses bounded native GET requests, filters IDs and never generates a picture',async()=>{
  let calls=0;
  const result=await readImageModels({base:'https://dashscope-intl.aliyuncs.com',apiKey:'sk-catalog-fixture',workspaceId:'ws-fixture',configuredModel:'qwen-image-plus',fetchFn:async(url,init)=>{
    calls++;assert.equal(url,'https://dashscope-intl.aliyuncs.com/api/v1/models?page_no=1&page_size=100');assert.equal(init.method,'GET');assert.equal(init.body,undefined);
    assert.equal(init.headers.Authorization,'Bearer sk-catalog-fixture');assert.equal(init.headers['X-DashScope-WorkSpace'],'ws-fixture');
    return json({output:{models:[{model:'qwen-image-plus'},{model:'qwen-plus'},{model:'wan2.6-t2i'},{model:'<private-invalid>'}],total:4}});
  }});
  assert.deepEqual(result.imageModels,['qwen-image-plus','wan2.6-t2i']);assert.equal(result.configuredListed,true);assert.equal(calls,1);assert.match(result.note,/not a successful generation test/);
  assert.doesNotMatch(JSON.stringify(result),/sk-catalog-fixture|private-invalid/);
});
test('Unavailable metadata has a safe explanation without echoing provider contents',async()=>{
  const result=await readImageModels({base:'https://fixture.invalid',fetchFn:async()=>new Response('private-key-and-details',{status:404})});
  assert.equal(result.ok,false);assert.equal(result.httpStatus,404);assert.doesNotMatch(JSON.stringify(result),/private-key/);
});
test('Model metadata requires parent authorization, caches repeated checks and shares failed-code throttling',async()=>{
  let calls=0;
  const app=createApp({apiKey:'sk-fixture-only',workspaceId:'ws-fixture',accessCode:'parent-code-fixture',fetchFn:async()=>{calls++;return json({data:{models:[{model:'qwen-image-plus'}],total:1}});}});
  app.listen(0,'127.0.0.1');await once(app,'listening');const base='http://127.0.0.1:'+app.address().port;
  try{
    const check=code=>fetch(base+'/api/parent/models',{method:'POST',headers:{'X-Robot-Access-Code':code}});
    assert.equal((await check('wrong')).status,401);assert.equal(calls,0);
    assert.equal((await (await check('parent-code-fixture')).json()).ok,true);await check('parent-code-fixture');assert.equal(calls,1);
    for(let i=0;i<7;i++)assert.equal((await check('wrong')).status,401);
    assert.equal((await check('parent-code-fixture')).status,429);
  }finally{await new Promise(resolve=>app.close(resolve));}
});
test('Main page keeps strict script policy while ML evaluation is limited to the local worker',async()=>{
  const app=createApp({apiKey:'',accessCode:'parent-code-fixture'});app.listen(0,'127.0.0.1');await once(app,'listening');const base='http://127.0.0.1:'+app.address().port;
  try{
    const page=await fetch(base),worker=await fetch(base+'/mini-face-worker.js');
    assert.doesNotMatch(page.headers.get('Content-Security-Policy'),/unsafe-eval/);assert.match(page.headers.get('Content-Security-Policy'),/worker-src 'self'/);
    assert.match(worker.headers.get('Content-Security-Policy'),/script-src 'self' 'unsafe-eval'/);
    const wasm=await fetch(base+'/vendor/mediapipe/face-mesh-0.4.1633559619-mini1/face_mesh_solution_wasm_bin.wasm');
    assert.equal(wasm.status,200);assert.equal(wasm.headers.get('Content-Type'),'application/wasm');assert.match(wasm.headers.get('Cache-Control'),/immutable/);
    assert.equal((await fetch(base+'/vendor/mediapipe/../server.mjs')).status,404);
  }finally{await new Promise(resolve=>app.close(resolve));}
});
