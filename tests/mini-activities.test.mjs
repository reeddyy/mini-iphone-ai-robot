import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
function load() {
  const window={};const ctx=vm.createContext({window});
  for(const name of ['mini-kids.js','mini-activities.js'])vm.runInContext(readFileSync(new URL('../public/'+name,import.meta.url),'utf8'),ctx);
  return window.MiniActivities;
}
test('Story retains bilingual choices through the ending, without retaining raw words',()=>{
  const activity=load();
  let state=activity.advance(activity.fresh(),'Mini, tell me a story');
  assert.equal(state.story.stage,'hero');
  state=activity.advance(state,'A dragon please');
  assert.equal(state.story.hero,'dragon');
  assert.equal(state.story.stage,'place');
  state=activity.advance(state,'森林');
  assert.equal(state.story.place,'forest');
  assert.match(activity.prompt(state,'en'),/star.*flower/);
  state=activity.advance(state,'星星');
  assert.equal(state.story.goal,'star');
  assert.equal(state.story.stage,'ending');
  state=activity.finishReply(state);
  assert.equal(state.story.stage,'complete');
  assert.match(activity.instructions(state),/dragon.*forest.*star/);
  assert.doesNotMatch(JSON.stringify(state),/please|森林|星星/);
  assert.match(activity.summary(state,'zh'),/小龙.*森林.*小星星/);
});
test('Unrecognized or ambiguous story choices are not invented or persisted',()=>{
  const activity=load();
  const state=activity.advance(activity.fresh(),'tell me a story');
  for(const answer of ['My secret address is somewhere private','cat or dragon','not cat','I do not want cat','不要小猫','恐龙']) {
    assert.equal(activity.advance(state,answer),state);
  }
  assert.equal(activity.advance(state,'not cat, dragon').story.hero,'dragon');
});
test('A story opening accepts a one-word answer; a new story resets its choices',()=>{
  const activity=load();
  let state=activity.fromOpening('Should our little story begin with a cat or a dragon?');
  state=activity.advance(state,'cat');
  assert.equal(state.story.hero,'cat');
  state=activity.advance(state,'tell me a new story');
  assert.equal(state.story.hero,null);
  assert.equal(state.story.stage,'hero');
  state=activity.advance(state,'finish the story');
  assert.equal(state.story.stage,'ending');
});
test('Riddles give easier clues and end after three correct rounds',()=>{
  const activity=load();
  let state=activity.advance(activity.fresh(),'let us play a guessing game');
  assert.match(activity.prompt(state),/long neck/);
  state=activity.advance(state,'dog');
  assert.equal(state.game.round,0);
  assert.equal(state.game.attempts,1);
  assert.match(activity.prompt(state),/leaves/);
  state=activity.advance(state,'长颈鹿');
  assert.equal(state.game.round,1);
  assert.equal(state.game.attempts,0);
  assert.match(activity.prompt(state),/trunk/);
  state=activity.advance(state,'elephant');
  state=activity.advance(state,'企鹅');
  assert.equal(state.game.round,3);
  assert.match(activity.prompt(state),/finished/);
  assert.equal(activity.advance(state,'yes'),state);
});
test('Changing to chat removes activity state and has no persistent history',()=>{
  const activity=load();
  let state=activity.advance(activity.fresh(),'tell me a story');
  state=activity.advance(state,'cat');
  state=activity.advance(state,"Let's just chat");
  assert.equal(state.kind,'chat');
  assert.equal(state.story,null);
  assert.equal(activity.instructions(state),'');
  assert.equal(activity.fresh().revision,0);
});
