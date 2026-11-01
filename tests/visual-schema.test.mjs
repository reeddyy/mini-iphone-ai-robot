import test from 'node:test';
import assert from 'node:assert/strict';
import {validateVisualPlan,visualModelIssue,planVisual} from '../visual-provider.mjs';

const duel={version:1,action:'activity',activity:{type:'hand_game',rounds:3,moves:[
  {id:'rock',label:'Stone',symbol:'✊',beats:['scissors']},
  {id:'paper',label:'Paper',symbol:'✋',beats:['rock']},
  {id:'scissors',label:'Scissors',symbol:'✌️',beats:['paper']},
]}};
test('Image-generation variants cannot be used as the chat-based visual planner',async()=>{
  for(const model of ['qwen-image','qwen-image-plus','qwen-image-2.0-pro','qwen-image-edit-plus']){
    assert.equal(visualModelIssue(model).code,'VISUAL_MODEL_CONFIGURATION');
    await assert.rejects(planVisual({model,fetchFn:()=>{throw Error('Must not call the provider');}}),error=>error.code==='VISUAL_MODEL_CONFIGURATION');
  }
  for(const model of ['qwen-plus','qwen-flash','qwen-vl-plus'])assert.equal(visualModelIssue(model),null,'accept other chat models without claiming their account access');
});
test('Novel scenes and character faces use generic drawing primitives, not a subject enum',()=>{
  for(const title of ['A cat with starry whiskers','A jellyfish astronaut','Three purple submarines']) {
    const scene=validateVisualPlan({version:1,action:'character',title,nodes:[
      {kind:'ellipse',x:50,y:50,w:70,h:60,fill:'#ffeedd'},
      {kind:'polygon',points:[[20,35],[30,10],[40,35]],fill:'#ffbbcc'},
      {kind:'line',x:30,y:60,w:10,h:54,stroke:'#302a51',strokeWidth:1},
      {kind:'text',text:'<hello> 你好',x:50,y:90,size:7,fill:'#ffffff'},
    ]});
    assert.equal(scene.title,title);assert.equal(scene.nodes.length,4);
    assert.equal(scene.nodes[3].text,'<hello> 你好');
    assert.equal(validateVisualPlan(scene).nodes.length,4,'normalized plans remain valid at the browser boundary');
  }
});
test('Executable markup, remote assets and unbounded geometry cannot enter a scene',()=>{
  for(const node of [
    {kind:'script',text:'alert(1)'},{kind:'rect',onclick:'alert(1)'},{kind:'rect',style:'position:fixed'},
    {kind:'ellipse',fill:'url(https://example.com)'},{kind:'image',href:'https://example.com'},
    {kind:'text',text:'a'.repeat(81)},{kind:'ellipse',x:Infinity},{kind:'polygon',points:[[0,0],[1,1],[999,3]]},
  ])assert.throws(()=>validateVisualPlan({version:1,action:'scene',nodes:[node]}));
  assert.throws(()=>validateVisualPlan({version:1,action:'scene',nodes:Array(33).fill({kind:'rect'})}));
  assert.throws(()=>validateVisualPlan(JSON.parse('{"version":1,"action":"keep","__proto__":{}}')));
  assert.throws(()=>validateVisualPlan({version:1,action:'keep',nodes:[]}));
});
test('Hand-game rules are complete, unambiguous and limited before play',()=>{
  const plan=validateVisualPlan(duel);assert.equal(plan.activity.moves.length,3);
  for(const modify of [
    value=>{value.activity.moves[0].beats=['rock'];},
    value=>{value.activity.moves[0].beats=['unknown'];},
    value=>{value.activity.moves[1].beats=['rock','scissors'];},
    value=>{value.activity.moves[0].beats=[];},
    value=>{value.activity.moves[1].id='rock';},
  ]){const value=structuredClone(duel);modify(value);assert.throws(()=>validateVisualPlan(value));}
});
test('Counts, choices and artwork have separate bounded contracts',()=>{
  const count=validateVisualPlan({version:1,action:'activity',activity:{type:'count',count:3,symbol:'🍎',label:'apples'}});
  assert.equal(count.activity.count,3);
  for(const value of [-1,3.5,21])assert.throws(()=>validateVisualPlan({version:1,action:'activity',activity:{type:'count',count:value,symbol:'🍎',label:'apples'}}));
  assert.throws(()=>validateVisualPlan({version:1,action:'activity',activity:{type:'choices'},choices:[{id:'cat',label:'cat'}]}));
  assert.equal(validateVisualPlan({version:1,action:'interact',choiceId:'paper'}).choiceId,'paper');
  assert.throws(()=>validateVisualPlan({version:1,action:'artwork',prompt:'cat',nodes:[]}));
  assert.equal(validateVisualPlan({version:1,action:'artwork',prompt:'A gentle moon cat.'}).prompt,'A gentle moon cat.');
});
