import test from 'node:test';
import assert from 'node:assert/strict';
import {directPicturePlan} from '../picture-request.mjs';

test('Explicit picture intent accepts arbitrary subjects in English and Mandarin',()=>{
  for(const request of ['Show me a cat','Can you show me a purple cat with yellow boots?','Please draw a jellyfish astronaut','Paint a moon garden','I want a picture of a moon snail','Mini，给我看一只猫','我想看一只紫色的猫','请帮我画一只长翅膀的水母']){
    const plan=directPicturePlan({request,imagesAllowed:true,spokenReply:'A playful illustration is coming.'});
    assert.equal(plan?.action,'artwork',request);assert.ok(plan.prompt.includes(request));assert.ok(plan.prompt.length<=800);assert.equal(plan.nodes,undefined);
  }
  assert.equal(directPicturePlan({request:'Show me a cat',imagesAllowed:true,spokenReply:"I cannot show pictures myself, but imagine a little cat."}).action,'artwork','voice capability disclaimers do not block an enabled image service');
});
test('Picture routing respects consent, ordinary conversation, refusal, games and exact counts',()=>{
  assert.equal(directPicturePlan({request:'Show me a cat',imagesAllowed:false}).action,'keep');
  for(const request of ['My favourite animal is a cat','Create a story about a cat','Play tic tac toe','Show me three cats','Show me how to draw a cat','Can I show you my cat?','Do not draw a cat','Show scissors paper stone','Count the apples','你看到我的猫了吗','给你看我的猫'])assert.equal(directPicturePlan({request,imagesAllowed:true}),null,request);
  assert.equal(directPicturePlan({request:'Draw a picture',imagesAllowed:true,spokenReply:'I cannot help with that. Please ask a trusted adult.'}),null);
});

test('Picture invitations encourage observation and imagination only with follow-up permission',()=>{
  const options={request:'Show me a cat',imagesAllowed:true};
  assert.equal(directPicturePlan(options).followUp,undefined);
  const first=directPicturePlan({...options,followUpsAllowed:true,pictureIndex:0});const second=directPicturePlan({...options,followUpsAllowed:true,pictureIndex:1});
  assert.match(first.followUp,/notice/);assert.match(second.followUp,/story/);assert.notEqual(first.followUp,second.followUp);
  assert.equal(directPicturePlan({...options,imagesAllowed:false,followUpsAllowed:true}).followUp,undefined);
});
