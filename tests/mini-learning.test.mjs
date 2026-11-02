import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
function api(){
  const context=vm.createContext({window:{}});
  for(const file of ['mini-language.js','mini-kids.js','mini-learning.js'])vm.runInContext(readFileSync(new URL('../public/'+file,import.meta.url),'utf8'),context);
  return context.window.MiniLearning;
}

test('Learning requests work in either language and respect negation',()=>{
  const {requestedDomain}=api();
  for(const text of ['Teach me maths','Ask me a math question','我想学数学','教我算数'])assert.equal(requestedDomain(text),'math',text);
  for(const text of ['Let’s try a science quiz','Teach me science','我想学科学'])assert.equal(requestedDomain(text),'science',text);
  for(const text of ["Don't teach me maths",'我不想学数学','I like cats'])assert.equal(requestedDomain(text),null,text);
});

test('Maths checks real answers in English, Mandarin and mixed short replies',()=>{
  for(const lang of ['en','zh'])for(const answer of ['3','three','三','I think three','三个']){
    const learning=api().create();
    const invitation=learning.offer(lang,{force:true,subject:'math'});
    assert.match(invitation.text,lang==='zh'?/原来有2位，又来了1位/:/There are 2, and 1 more join/);
    const reply=learning.answer(answer,lang);
    assert.equal(reply.kind,'correct',answer);assert.match(reply.text,lang==='zh'?/2加1等于3/:/2 plus 1 makes 3/);
    assert.equal(learning.hasQuestion(),false);
  }
});

test('Mistakes and uncertainty get one useful hint, then an explanation and a return to play',()=>{
  const learning=api().create();learning.offer('zh',{force:true,subject:'math'});
  assert.equal(learning.answer('不知道','zh').kind,'hint');
  assert.equal(learning.checkpoint('zh').pending.attempts,1);
  const reply=learning.answer('四','zh');assert.equal(reply.kind,'modelled');
  assert.match(reply.text,/2加1等于3/);assert.match(reply.text,/想象|冒险|故事/);
  assert.equal(learning.hasQuestion(),false);assert.equal(learning.checkpoint('zh').lastResult,'modelled');
});

test('A child can correct a mistaken answer after the hint',()=>{
  const learning=api().create();learning.offer('en',{force:true,subject:'math'});
  assert.equal(learning.answer('four','en').kind,'hint');
  assert.equal(learning.answer('three','en').kind,'correct');
});

test('Maths gradually expands within ten and includes subtraction and shapes',()=>{
  const learning=api().create();
  learning.offer('en',{force:true,subject:'math'});learning.answer('3','en');
  assert.match(learning.offer('en',{force:true,subject:'math'}).text,/3, and 1 go home/);learning.answer('2','en');
  assert.equal(learning.checkpoint('en').level,1);
  assert.match(learning.offer('en',{force:true,subject:'math'}).text,/triangle/);learning.answer('3','en');
  assert.match(learning.offer('en',{force:true,subject:'math'}).text,/3, and 2 more join/);learning.answer('5','en');
  assert.equal(learning.checkpoint('en').level,2);
  assert.match(learning.offer('en',{force:true,subject:'math'}).text,/7, and 3 go home/);
});

test('Science gives accurate observations and predictions with checked bilingual answers',()=>{
  for(const [topic,answer,concept] of [['plant','window','plant-light'],['星星','恒星','sun-star'],['car','ball','rolling'],['cat','六','insect-legs']]){
    const learning=api().create();learning.observe(topic);
    learning.offer('zh',{force:true,subject:'science'});
    assert.equal(learning.checkpoint('zh').pending.id,concept);
    const reply=learning.answer(answer,'zh');assert.equal(reply.kind,'correct',topic);
    if(topic==='car')assert.match(reply.text,/预测.*不是.*实验/);
  }
});

test('Learning is spaced through play, alternates domains and avoids repeating the same science fact',()=>{
  const learning=api().create();learning.observe('cat');assert.equal(learning.offer('en'),null);
  learning.observe('a blue cat');assert.equal(learning.offer('en').kind,'learning');
  assert.equal(learning.checkpoint('en').pending.domain,'math');learning.answer('three','en');
  learning.observe('cat');assert.equal(learning.offer('en'),null);
  learning.observe('cat');assert.equal(learning.offer('en'),null);
  learning.observe('cat');learning.offer('en');assert.equal(learning.checkpoint('en').pending.domain,'science');
  const first=learning.checkpoint('en').pending.id;learning.answer('six','en');
  learning.offer('en',{force:true,subject:'science'});assert.notEqual(learning.checkpoint('en').pending.id,first);
});

test('Language switching restates the same challenge without marking an error',()=>{
  const learning=api().create();learning.offer('en',{force:true,subject:'math'});
  const before=learning.checkpoint('en').pending.id;
  const reply=learning.answer('请用中文回答','zh');assert.equal(reply.kind,'repeat');assert.match(reply.text,/一共有几位/);
  assert.equal(learning.checkpoint('zh').pending.id,before);assert.equal(learning.checkpoint('zh').pending.attempts,0);
  assert.equal(learning.answer('三','zh').kind,'correct');
});

test('Skipping, changing topic and distress are never treated as wrong answers',()=>{
  for(const text of ['no thanks','跳过','Tell me a story about three cats','我想聊天','I feel sad','a blue cat']){
    const learning=api().create();learning.offer('en',{force:true,subject:'math'});
    const reply=learning.answer(text,'en');assert.notEqual(reply?.kind,'hint',text);
    assert.equal(learning.hasQuestion(),false,text);
  }
});

test('Ambiguous numbers are not rewarded as correct and camera invitations describe observable cues only',()=>{
  const learning=api().create();learning.offer('en',{force:true,subject:'math'});
  assert.equal(learning.answer('three or four','en').kind,'hint');
  const local=api();
  for(const cue of ['hello','smile','wink','motion'])for(const lang of ['en','zh']){
    const text=local.cameraInvitation(cue,lang);assert.ok(text.length>10);assert.ok(text.length<=300);
    assert.doesNotMatch(text,/you (?:feel|are happy|are sad)|你(?:很开心|很难过)/i);
  }
});

test('Session checkpoints keep only catalog choices and progress, never child free-form words',()=>{
  const learning=api().create();learning.observe('My private phrase about a cat');learning.offer('en');
  assert.doesNotMatch(JSON.stringify(learning.checkpoint('en')),/My private phrase/);
  const fresh=api().create();assert.equal(fresh.checkpoint('en').level,0);assert.equal(fresh.hasQuestion(),false);
});
