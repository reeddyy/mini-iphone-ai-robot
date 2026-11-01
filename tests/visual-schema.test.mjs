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
test('Novel subjects use generated-image prompts and allowlisted animation',()=>{
  for(const title of ['A cat with starry whiskers','A jellyfish astronaut','Three purple submarines']){
    const plan=validateVisualPlan({version:1,action:'artwork',title,prompt:title,motion:'wiggle',choices:[{id:'moon',label:'Visit the moon'}]});
    assert.equal(plan.prompt,title);assert.equal(plan.motion,'wiggle');assert.equal(validateVisualPlan(plan).choices[0].id,'moon');
  }
});
test('Generated markup, nodes, arbitrary motion and remote image URLs cannot enter the protocol',()=>{
  for(const extra of [{nodes:[]},{fallback:{nodes:[]}},{html:'<svg></svg>'},{src:'https://example.com/cat.png'},{motion:'position:fixed'}])assert.throws(()=>validateVisualPlan({version:1,action:'artwork',prompt:'A kitten',...extra}));
  assert.throws(()=>validateVisualPlan(JSON.parse('{"version":1,"action":"keep","__proto__":{}}')));
  assert.throws(()=>validateVisualPlan({version:1,action:'artwork',prompt:'a'.repeat(801)}));
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
test('Generated artwork never accepts sketch fallbacks or nodes',()=>{
  for(const action of ['artwork','keep','activity'])assert.throws(()=>validateVisualPlan({version:1,action,prompt:'A moon cat',fallback:{nodes:[{kind:'emoji',text:'🐈'}]}}));
});
