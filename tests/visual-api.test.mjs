import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createApp} from '../server.mjs';

const CODE='visual-test-parent-code';
const OFFER='v=0\r\no=- 123 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\na=group:BUNDLE 0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=mid:0\r\na=sendrecv\r\n';
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64');
const countPlan={version:1,action:'activity',title:'Three apples',activity:{type:'count',count:3,symbol:'🍎',label:'apples'}};
const picturePlan={version:1,action:'artwork',title:'Moon cat',prompt:'A gentle cat waving from the moon.'};
function json(value){return new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}});}
async function withApp(options,task) {
  const calls=[];
  const fetchFn=async(url,init)=>{
    calls.push({url:String(url),init});
    if(String(url).includes('/webrtc/'))return new Response(OFFER);
    return options.provider(url,init);
  };
  const app=createApp({apiKey:'sk-test-payg',workspaceId:'ws-test',accessCode:CODE,fetchFn,imageModel:options.imageModel || '',...(options.visualModel?{visualModel:options.visualModel}:{}),...(options.imageEndpoint?{imageEndpoint:options.imageEndpoint}:{})});
  app.listen(0,'127.0.0.1');await once(app,'listening');
  const base='http://127.0.0.1:'+app.address().port;
  const start=async(images=false,visuals=true)=>{
    const response=await fetch(base+'/api/realtime/sdp',{method:'POST',headers:{'Content-Type':'application/sdp','X-Robot-Access-Code':CODE,'X-Mini-Visuals':String(visuals),'X-Mini-Images':String(images)},body:OFFER});
    assert.equal(response.status,200);return response.headers.get('X-Mini-Visual-Session');
  };
  const post=(path,token,body)=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json','X-Mini-Visual-Session':token},body:JSON.stringify(body)});
  try{await task({base,start,post,calls});}finally{await new Promise(resolve=>app.close(resolve));}
}
test('Visual calls need a grant issued after parent-authorized SDP, never the private parent code',async()=>{
  await withApp({provider:()=>{throw Error('No provider access expected');}},async({base,start,post,calls})=>{
    assert.equal((await post('/api/visual/plan',CODE,{request:'show apples'})).status,401);
    assert.equal(await start(false,false),null);
    const token=await start();assert.equal(token.length,43);
    assert.equal(calls.filter(call=>!call.url.includes('/webrtc/')).length,0);
    const config=await (await fetch(base+'/api/config')).text();assert.ok(!config.includes(token) && !config.includes(CODE));
    assert.equal((await fetch(base+'/api/visual/session',{method:'DELETE',headers:{'X-Mini-Visual-Session':token}})).status,200);
    assert.equal((await post('/api/visual/plan',token,{request:'show apples'})).status,401);
  });
});
test('The planner receives arbitrary requests and validated scene context through the same Singapore workspace',async()=>{
  await withApp({provider:(url,init)=>{
    assert.equal(String(url),'https://ws-test.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1/chat/completions');
    const body=JSON.parse(init.body);assert.equal(body.model,'qwen-plus');assert.deepEqual(body.response_format,{type:'json_object'});
    const user=JSON.parse(body.messages[1].content);assert.equal(user.request,'Become a jellyfish astronaut');assert.equal(user.imagesAllowed,false);assert.equal(user.spokenReply,'Our jellyfish is beside the moon.');
    return json({choices:[{message:{content:JSON.stringify(countPlan)}}]});
  }},async({start,post})=>{
    const token=await start();const response=await post('/api/visual/plan',token,{request:'Become a jellyfish astronaut',spokenReply:'Our jellyfish is beside the moon.',language:'en'});
    assert.equal(response.status,200);assert.equal((await response.json()).plan.activity.count,3);
  });
});
test('An image model in the planner setting produces actionable setup guidance without any planning charges',async()=>{
  await withApp({visualModel:'qwen-image-plus',imageModel:'qwen-image-plus',provider:()=>{throw Error('Wrong model must be rejected before provider access');}},async({base,start,post,calls})=>{
    const config=await (await fetch(base+'/api/config')).json();
    assert.equal(config.mode,'realtime','voice must stay available');assert.equal(config.awareness.available,true);
    assert.equal(config.visuals.available,false);assert.equal(config.visuals.imagesAvailable,false);
    assert.match(config.visuals.configurationError,/ALIBABA_VISUAL_MODEL=qwen-plus/);
    assert.match(config.visuals.configurationError,/ALIBABA_IMAGE_MODEL separately/);
    const token=await start();
    for(let i=0;i<3;i++){
      const response=await post('/api/visual/plan',token,{request:'Hello Mini'});assert.equal(response.status,400);
      const error=await response.json();assert.equal(error.code,'VISUAL_MODEL_CONFIGURATION');assert.match(error.error,/chat model/);
    }
    assert.equal(calls.filter(call=>!call.url.includes('/webrtc/')).length,0);
  });
});
test('Malformed provider data is rejected without leaking its body or interrupting the voice server',async()=>{
  await withApp({provider:()=>json({choices:[{message:{content:'secret-provider-details <script>bad</script>'}}]})},async({base,start,post})=>{
    const token=await start();const response=await post('/api/visual/plan',token,{request:'Continue this visual story'});
    assert.equal(response.status,502);assert.doesNotMatch(await response.text(),/secret-provider-details|script/);
    assert.equal((await fetch(base+'/api/config')).status,200);
    assert.equal((await post('/api/visual/plan',token,{request:'Continue this visual story',scene:{version:1,action:'scene',script:'bad'}})).status,400);
  });
});
test('Planner rejection returns safe actionable diagnostics while the voice server stays available',async()=>{
  await withApp({provider:()=>new Response(JSON.stringify({error:{code:'AccessDenied',message:'private API key and child transcript'}}),{status:403})},async({base,start,post,calls})=>{
    const response=await post('/api/visual/plan',await start(),{request:'Hello Mini'});assert.equal(response.status,502);
    const result=await response.json();assert.equal(result.diagnostic.code,'VISUAL_ACCESS');assert.equal(result.diagnostic.httpStatus,403);assert.equal(result.diagnostic.model,'qwen-plus');assert.equal(result.diagnostic.stage,'planner');
    assert.doesNotMatch(JSON.stringify(result),/private API key|child transcript/);assert.equal(calls.filter(call=>call.url.includes('/chat/completions')).length,1);
    assert.equal((await (await fetch(base+'/api/config')).json()).mode,'realtime');
  });
});
test('Generated artwork requires per-session consent and a single-use planner ticket',async()=>{
  await withApp({imageModel:'qwen-image-plus',provider:(url,init)=>{
    if(String(url).includes('/chat/completions'))return json({choices:[{message:{content:JSON.stringify(picturePlan)}}]});
    if(String(url).includes('/multimodal-generation/')) {
      assert.equal(String(url),'https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation');
      assert.equal(init.headers['X-DashScope-WorkSpace'],'ws-test');
      const body=JSON.parse(init.body);assert.equal(body.model,'qwen-image-plus');assert.equal(body.parameters.n,1);
      assert.match(body.input.messages[0].content[0].text,/Draw a cat/);
      return json({output:{choices:[{message:{content:[{image:'https://dashscope-result-sg.oss-ap-southeast-1.aliyuncs.com/fixture.png'}]}}]}});
    }
    assert.equal(init.headers,undefined,'API authorization must not go to the storage URL');
    assert.equal(init.redirect,'error');return new Response(PNG,{headers:{'Content-Type':'image/png'}});
  }},async({start,post,calls})=>{
    const without=await start();assert.equal((await (await post('/api/visual/plan',without,{request:'Draw a cat'})).json()).plan.action,'keep');
    assert.equal((await post('/api/visual/image',without,{ticket:'made-up'})).status,403);
    const token=await start(true);
    assert.equal((await post('/api/visual/image',token,{prompt:'bypass the planner'})).status,403);
    const plan=await (await post('/api/visual/plan',token,{request:'Draw a cat'})).json();assert.ok(plan.imageTicket);
    const image=await post('/api/visual/image',token,{ticket:plan.imageTicket});
    assert.equal(image.status,200);assert.equal(image.headers.get('Content-Type'),'image/png');
    assert.equal(Buffer.compare(Buffer.from(await image.arrayBuffer()),PNG),0);
    assert.equal((await post('/api/visual/image',token,{ticket:plan.imageTicket})).status,400);
    assert.equal(calls.filter(call=>call.url.includes('/multimodal-generation/')).length,1);
  });
});
test('An unavailable image model disables further artwork calls across new grants until server restart and future pictures stay unavailable without sketches',async()=>{
  const permissions=[];let imageCalls=0;
  await withApp({imageModel:'qwen-image-plus',provider:(url,init)=>{
    if(String(url).includes('/chat/completions')){
      const user=JSON.parse(JSON.parse(init.body).messages[1].content);permissions.push(user.imagesAllowed);
      const plan=user.imagesAllowed?picturePlan:{version:1,action:'keep',message:'Pictures are unavailable.'};
      return json({choices:[{message:{content:JSON.stringify(plan)}}]});
    }
    imageCalls++;return new Response(JSON.stringify({code:'InvalidParameter',message:'Model is unavailable.'}),{status:404});
  }},async({start,post})=>{
    const token=await start(true),planned=await (await post('/api/visual/plan',token,{request:'Continue the story with a painting of a cat'})).json();
    assert.equal(planned.plan.action,'artwork');assert.equal(planned.plan.fallback,undefined);
    const failed=await post('/api/visual/image',token,{ticket:planned.imageTicket}),details=await failed.json();
    assert.equal(failed.status,502);assert.equal(details.diagnostic.endpoint,'singapore');
    assert.equal((await post('/api/visual/image',token,{ticket:planned.imageTicket})).status,503);
    const next=await (await post('/api/visual/plan',token,{request:'Continue the story with another picture of the cat'})).json();assert.equal(next.plan.action,'keep');
    const freshToken=await start(true);await post('/api/visual/plan',freshToken,{request:'Continue this picture story'});
    assert.deepEqual(permissions,[true,false,false]);assert.equal(imageCalls,1,'no silent image retry or regional fallback');
  });
});
test('The workspace image endpoint is an explicit option, with workspace credentials kept server-side',async()=>{
  await withApp({imageModel:'qwen-image-plus',imageEndpoint:'workspace',provider:(url,init)=>{
    if(String(url).includes('/chat/completions'))return json({choices:[{message:{content:JSON.stringify(picturePlan)}}]});
    if(String(url).includes('/multimodal-generation/')){
      assert.equal(String(url),'https://ws-test.ap-southeast-1.maas.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation');
      assert.equal(init.headers['X-DashScope-WorkSpace'],'ws-test');return json({output:{choices:[{message:{content:[{image:'https://result.oss-ap-southeast-1.aliyuncs.com/a.png'}]}}]}});
    }
    assert.equal(init.headers,undefined);return new Response(PNG);
  }},async({start,post})=>{
    const token=await start(true),planned=await (await post('/api/visual/plan',token,{request:'Continue the story with a painting of a cat'})).json();
    assert.equal((await post('/api/visual/image',token,{ticket:planned.imageTicket})).status,200);
    assert.equal((await post('/api/visual/plan',token,{request:'hello',spokenReply:'x'.repeat(2001)})).status,400);
  });
});
test('Image outputs cannot redirect the server to an arbitrary URL or serve executable SVG',async()=>{
  for(const attack of ['https://127.0.0.1/private','https://evil.aliyuncs.com.attacker.test/file','https://api.aliyuncs.com/private','https://bucket.oss-ap-southeast-1.aliyuncs.com:8443/file','svg']) {
    let downloads=0;
    await withApp({imageModel:'qwen-image-plus',provider:url=>{
      if(String(url).includes('/chat/completions'))return json({choices:[{message:{content:JSON.stringify(picturePlan)}}]});
      if(String(url).includes('/multimodal-generation/'))return json({output:{choices:[{message:{content:[{image:attack==='svg'?'https://result.oss-ap-southeast-1.aliyuncs.com/image':attack}]}}]}});
      downloads++;return new Response('<svg onload="alert(1)"></svg>',{headers:{'Content-Type':'image/png'}});
    }},async({start,post})=>{
      const token=await start(true),plan=await (await post('/api/visual/plan',token,{request:'Draw a cat'})).json();
      assert.equal((await post('/api/visual/image',token,{ticket:plan.imageTicket})).status,502);
      assert.equal(downloads,attack==='svg'?1:0);
    });
  }
});
test('Visual request rate is bounded and expired grants stop new paid requests',async t=>{
  await withApp({provider:()=>json({choices:[{message:{content:'{"version":1,"action":"keep"}'}}]})},async({start,post,calls})=>{
    const token=await start();
    for(let i=0;i<8;i++)assert.equal((await post('/api/visual/plan',token,{request:'hello'})).status,200);
    assert.equal((await post('/api/visual/plan',token,{request:'hello'})).status,429);
    assert.equal(calls.filter(call=>call.url.includes('/chat/completions')).length,8);
    const future=Date.now()+61*60000;t.mock.method(Date,'now',()=>future);
    assert.equal((await post('/api/visual/plan',token,{request:'hello'})).status,401);
  });
});
test('Revoking a grant aborts a pending provider request',async()=>{
  let started,aborted=false;const ready=new Promise(resolve=>{started=resolve;});
  await withApp({provider:(_url,init)=>new Promise((_resolve,reject)=>{
    init.signal.addEventListener('abort',()=>{aborted=true;reject(new Error('cancelled'));},{once:true});started();
  })},async({base,start,post})=>{
    const token=await start();const pending=post('/api/visual/plan',token,{request:'Continue our visual story'});
    await ready;
    await fetch(base+'/api/visual/session',{method:'DELETE',headers:{'X-Mini-Visual-Session':token}});
    assert.equal((await pending).status,502);assert.equal(aborted,true);
  });
});

test('A visual grant cannot exceed its total planning budget even at a slow request rate',async t=>{
  let now=Date.now();t.mock.method(Date,'now',()=>now);
  await withApp({provider:()=>json({choices:[{message:{content:'{"version":1,"action":"keep"}'}}]})},async({start,post,calls})=>{
    const token=await start();
    for(let i=0;i<60;i++){now+=8000;assert.equal((await post('/api/visual/plan',token,{request:'hello'})).status,200);}
    now+=60000;
    assert.equal((await post('/api/visual/plan',token,{request:'hello'})).status,429);
    assert.equal(calls.filter(call=>call.url.includes('/chat/completions')).length,60);
  });
});
test('Fresh artwork tickets cannot bypass the four-image budget',async()=>{
  await withApp({imageModel:'fixture-image',provider:url=>{
    if(String(url).includes('/chat/completions'))return json({choices:[{message:{content:JSON.stringify(picturePlan)}}]});
    if(String(url).includes('/multimodal-generation/'))return json({output:{choices:[{message:{content:[{image:'https://result.oss-ap-southeast-1.aliyuncs.com/image.png'}]}}]}});
    return new Response(PNG);
  }},async({start,post,calls})=>{
    const token=await start(true);
    for(let i=0;i<4;i++){
      const planned=await post('/api/visual/plan',token,{request:'Draw a new picture'});assert.equal(planned.status,200);
      const {imageTicket}=await planned.json();
      assert.equal((await post('/api/visual/image',token,{ticket:imageTicket})).status,200);
    }
    const exhausted=await (await post('/api/visual/plan',token,{request:'Draw a new picture'})).json();assert.equal(exhausted.plan.action,'keep');assert.equal(exhausted.imageTicket,undefined);
    assert.equal(calls.filter(call=>call.url.includes('/multimodal-generation/')).length,4);
  });
});

test('A parent-approved cat or novel picture skips malformed drawing plans and reaches the image model',async()=>{
  let generations=0,plans=0;
  await withApp({imageModel:'qwen-image-3.0',provider:(url,init)=>{
    if(String(url).includes('/chat/completions')){plans++;return json({choices:[{message:{content:'{"version":1,"action":"scene","nodes":[{"kind":"ellipse","size":null,"text":null}]}'}}]});}
    if(String(url).includes('/multimodal-generation/')){
      generations++;const body=JSON.parse(init.body);assert.equal(body.model,'qwen-image-3.0');assert.equal(body.parameters.size,'1024*1024');
      assert.match(body.input.messages[0].content[0].text,/cat|jellyfish astronaut/);
      return json({output:{choices:[{message:{content:[{image:'https://fixture.oss-accelerate.aliyuncs.com/picture.png'}]}}]}});
    }
    return new Response(PNG);
  }},async({start,post})=>{
    const token=await start(true);
    for(const request of ['Show me a cat','Please draw a jellyfish astronaut']){
      const response=await post('/api/visual/plan',token,{request,spokenReply:'Let’s make that picture.'});assert.equal(response.status,200);
      const data=await response.json();assert.equal(data.plan.action,'artwork');assert.ok(data.imageTicket);
      assert.equal(generations,request.includes('jellyfish')?1:0,'planning does not itself generate a paid image');
      const picture=await post('/api/visual/image',token,{ticket:data.imageTicket});assert.equal(picture.status,200);assert.equal(picture.headers.get('Content-Type'),'image/png');
    }
    assert.equal(plans,0);assert.equal(generations,2);
  });
});
