import test from 'node:test';
import assert from 'node:assert/strict';
import {parseVisualContent,planVisual,generateArtwork,describeVisualFailure} from '../visual-provider.mjs';

const json=value=>new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}});
const args={base:'https://ws-test.ap-southeast-1.maas.aliyuncs.com',apiKey:'sk-private-fixture',model:'qwen-plus',request:'private-child-words',scene:null,language:'en',imagesAllowed:false};
test('Ordinary-chat JSON tolerates complete fences and empty optional placeholders without weakening the protocol',()=>{
  const plans=['{"version":1,"action":"keep"}','```json\n{"version":1,"action":"keep"}\n```','{"version":1,"action":"keep","title":null,"nodes":[],"choices":[],"activity":null,"background":null,"prompt":null}'];
  for(const content of plans)assert.equal(parseVisualContent(content).action,'keep');
  for(const content of ['{"version":1,"action":"keep","script":null}','{"version":1,"action":"keep","nodes":[{"kind":"text","text":"bad"}]}','Before: {"version":1,"action":"keep"}','{"version":1,"action":"scene","nodes":[{"kind":"image","href":"https://example.com"}]}'])assert.throws(()=>parseVisualContent(content));
  assert.equal(parseVisualContent('{"version":1,"action":"scene","nodes":[{"kind":"emoji","text":"⭐"}]}').nodes[0].text,'⭐');
});
test('Planner HTTP failures expose only bounded codes, status and model, never provider messages or private request text',async()=>{
  for(const [status,code,expected] of [[401,'InvalidApiKey','VISUAL_AUTH'],[403,'AccessDenied','VISUAL_ACCESS'],[404,'ModelNotFound','VISUAL_MODEL_UNAVAILABLE'],[400,'InvalidParameter','VISUAL_REQUEST'],[429,'unknown','VISUAL_RATE_LIMIT'],[503,'private-child-words','VISUAL_PROVIDER_UNAVAILABLE']]) {
    let calls=0;
    await assert.rejects(planVisual({...args,fetchFn:async()=>{calls++;return new Response(JSON.stringify({error:{code,param:'response_format',message:'sk-private-fixture private-child-words'}}),{status});}}),error=>{
      const result=describeVisualFailure(error,{stage:'planner',model:args.model});
      assert.equal(result.diagnostic.code,expected);assert.equal(result.diagnostic.httpStatus,status);assert.equal(result.diagnostic.model,'qwen-plus');
      assert.doesNotMatch(JSON.stringify(result),/sk-private-fixture|private-child-words/);return true;
    });
    assert.equal(calls,1,'no automatic provider retries');
  }
});
test('A denied JSON parameter is distinguishable from truncated JSON and invalid drawing instructions',async()=>{
  for(const [body,expected] of [[{choices:[{finish_reason:'length',message:{content:'{"version":'}}]},'VISUAL_OUTPUT_LIMIT'],[{choices:[{message:{content:'not json'}}]},'VISUAL_RESPONSE_JSON'],[{choices:[{message:{content:'{"version":1,"action":"unknown"}'}}]},'VISUAL_PLAN_INVALID'],[{output:{text:'private-provider-details'}},'VISUAL_RESPONSE_FORMAT']]) {
    await assert.rejects(planVisual({...args,fetchFn:async()=>json(body)}),error=>error.code===expected);
  }
});
test('Network and timeout diagnostics do not echo underlying exceptions',async()=>{
  await assert.rejects(planVisual({...args,fetchFn:async()=>{throw new Error('secret proxy URL and credentials');}}),error=>{
    assert.equal(error.code,'VISUAL_NETWORK');assert.doesNotMatch(error.message,/secret/);return true;
  });
  const abort=new AbortController();abort.abort('visual-timeout');
  assert.equal(describeVisualFailure(new Error('secret'),{stage:'planner',model:'qwen-plus',signal:abort.signal}).diagnostic.code,'VISUAL_TIMEOUT');
});
test('A JSON/thinking conflict is recognized without exposing the provider explanation',async()=>{
  await assert.rejects(planVisual({...args,fetchFn:async()=>new Response(JSON.stringify({error:{code:'InvalidParameter',message:'response_format json_object cannot be used with thinking. secret-api-key private-child-words'}}),{status:400})}),error=>{
    const result=describeVisualFailure(error,{stage:'planner',model:'qwen-plus'});
    assert.equal(result.diagnostic.reason,'JSON_REQUIRES_NON_THINKING');assert.equal(result.diagnostic.parameter,'response_format');assert.doesNotMatch(JSON.stringify(result),/secret-api-key|private-child-words/);return true;
  });
});
test('Image generation failures identify the artwork stage and storage restrictions remain enforced',async()=>{
  await assert.rejects(generateArtwork({...args,model:'qwen-image-plus',prompt:'A flower',fetchFn:async()=>new Response(JSON.stringify({code:'AccessDenied',message:'secret image provider details'}),{status:403})}),error=>{
    const result=describeVisualFailure(error,{stage:'artwork',model:'qwen-image-plus'});assert.equal(result.diagnostic.stage,'artwork');assert.equal(result.diagnostic.code,'VISUAL_ACCESS');assert.doesNotMatch(JSON.stringify(result),/secret/);return true;
  });
  await assert.rejects(generateArtwork({...args,prompt:'A flower',fetchFn:async()=>json({output:{choices:[{message:{content:[{image:'https://127.0.0.1/private'}]}}]}})}),error=>error.code==='IMAGE_DESTINATION');
});

test('Benign color and size variants normalize without allowing executable fields',()=>{
  const plan=parseVisualContent(JSON.stringify({version:1,action:'scene',background:'#abc',nodes:[{kind:'ellipse',fill:'pink',stroke:'none',w:120}],followUp:'Should the pink moon glow?'}));
  assert.equal(plan.background,'#aabbcc');assert.equal(plan.nodes[0].fill,'#ffc0cb');assert.equal(plan.nodes[0].stroke,'none');assert.equal(plan.nodes[0].w,100);
  for(const node of [{kind:'image',href:'https://example.com'}, {kind:'ellipse',fill:'url(javascript:alert(1))'}, {kind:'text',text:'hi',onclick:'bad'}]){
    assert.throws(()=>parseVisualContent(JSON.stringify({version:1,action:'scene',nodes:[node]})),error=>error.code==='VISUAL_PLAN_INVALID' && /^[A-Z_]+$/.test(error.details.reason));
  }
});

test('Qwen Image 2.0/3.0 use one 1K image on the native API while legacy models retain their resolution',async()=>{
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64');
  for(const [model,size] of [['qwen-image-3.0','1024*1024'],['qwen-image-3.0-pro','1024*1024'],['qwen-image-2.0','1024*1024'],['qwen-image-2.0-pro','1024*1024'],['qwen-image-plus','1328*1328']]) {
    let calls=0;
    const image=await generateArtwork({...args,base:'https://dashscope-intl.aliyuncs.com',workspaceId:'ws-fixture',model,prompt:'One purple kitten with a yellow hat.',fetchFn:async(url,init)=>{
      calls++;
      if(calls===1){
        assert.equal(url,'https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation');
        const body=JSON.parse(init.body);assert.equal(body.model,model);assert.equal(body.parameters.size,size);assert.equal(body.parameters.n,1);
        assert.equal(body.parameters.prompt_extend,false);assert.match(body.input.messages[0].content[0].text,/One purple kitten with a yellow hat/);
        return json({output:{choices:[{message:{content:[{image:'https://dashscope-fixture.oss-accelerate.aliyuncs.com/picture.png'}]}}]}});
      }
      assert.equal(init.headers,undefined);assert.equal(init.redirect,'error');return new Response(png);
    }});
    assert.equal(calls,2,'one generation and one credential-free download, no model retries');assert.equal(image.contentType,'image/png');
  }
});
