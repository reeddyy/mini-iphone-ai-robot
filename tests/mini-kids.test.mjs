import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

const root = new URL('../public/', import.meta.url);
const kidsFile = fileURLToPath(new URL('mini-kids.js', root));
const uiFile = fileURLToPath(new URL('mini-child-ui.js', root));
const appFile = fileURLToPath(new URL('app.js', root));
const htmlFile = fileURLToPath(new URL('index.html', root));
const extrasFile = fileURLToPath(new URL('mini-extras.js', root));

function kidsContent() {
  const window = {};
  vm.runInNewContext(readFileSync(kidsFile,'utf8'),{window});
  return window.MiniKidsContent;
}

test('Child scripts and WebRTC app are syntactically valid',()=>{
  for (const file of [kidsFile,uiFile,appFile,extrasFile]) {
    assert.doesNotThrow(()=>execFileSync(process.execPath,['--check',file]),file);
  }
});

test('Child home shows one talking Mini and keeps diagnostics under parent controls',()=>{
  const html=readFileSync(htmlFile,'utf8');
  const kid=html.indexOf('class="kid-home"'),adult=html.indexOf('id="parentSetup"');
  assert.ok(kid>0 && adult>kid);
  for(const id of ['kidChat','kidGuess','kidStory','kidLook']) {
    assert.doesNotMatch(html,new RegExp('id="'+id+'"'),id+' should not be visible');
  }
  for(const id of ['robotFace','kidHint','kidGameMode','kidMicStatus','kidMicBar','kidVadStatus',
                   'kidMicHelp','listenSensitivity','kidParentLink','kidStopBtn','modelDiagnostic']) {
    assert.ok(html.includes('id="'+id+'"'),id);
  }
  assert.ok(html.indexOf('id="parentDiagnostics"')>adult,'hearing diagnostics are in parent area');
  assert.ok(html.indexOf('id="kidMicBar"')>adult,'mic status does not clutter the child screen');
  assert.ok(html.indexOf('id="modelDiagnostic"')<adult,'urgent errors remain visible');
  assert.match(html,/<input id="sendVideo" type="checkbox">/,'camera remains opt-in');
  assert.match(html,/<details id="parentSetup" class="parent-setup">/);
  assert.ok(html.indexOf('id="startBtn"')>adult,'paid AI still starts under parent setup');
});

test('Games build live AI instructions; answers in one word count',()=>{
  const kid=kidsContent();
  assert.deepEqual(Array.from(kid.modes),['chat','guess','story','look']);
  for(const mode of kid.modes){
    const en=kid.instructions('Base rules',mode,true);
    const off=kid.instructions('Base rules',mode,false);
    assert.match(en,/ONE short word|single word/i);
    assert.match(en,/never ignore a reply|Do not require .* wake word/i);
    assert.match(en,/Base rules/);
    assert.match(off,/camera is not shared/i);
    assert.match(off,/cannot see any objects/i);
    assert.ok(kid.getFallback(mode,'en').length>15);
    assert.ok(kid.getFallback(mode,'zh').length>5);
  }
  assert.match(kid.instructions('','guess',false),/giraffe/i);
  assert.match(kid.instructions('','story',false),/incorporate their spoken answer/i);
  assert.match(kid.getLabels('zh').chat,/聊天/);
});

test('Child UI uses Mini face and speech, not activity buttons',()=>{
  const script=readFileSync(uiFile,'utf8');
  for(const id of ['kidChat','kidGuess','kidStory','kidLook']) assert.doesNotMatch(script,new RegExp(id));
  assert.doesNotMatch(script,/options\.requestActivity\(activity\)/);
  assert.doesNotMatch(script,/Switched to free offline play/);
  assert.doesNotMatch(script,/function switchToOfflinePlay/);
  assert.doesNotMatch(script,/fetch\(|RTCPeerConnection\(/);
  assert.match(script,/face\.addEventListener\('click',tapFace\)/);
  assert.match(script,/onVoiceDetected/);
  assert.match(script,/onMicLevel/);
  assert.match(script,/onTranscription/);
  assert.match(script,/mic\.enabled = false/,'local TTS briefly disables mic to avoid echo');
  assert.match(script,/mic\.enabled = true/,'mic is restored after local TTS');
});

test('Voice requests change context without a child-facing menu or an extra AI request',()=>{
  const kids=kidsContent();
  const examples=[
    ['Mini, tell me a story','chat','story'],
    ['请给我讲故事','chat','story'],
    ['Let us play a guessing game','chat','guess'],
    ['我们猜动物吧','chat','guess'],
    ['Look at my toy','story','look'],
    ['你看看这个玩具','chat','look'],
    ["Let's chat",'guess','chat'],
    ['我想聊天','story','chat'],
    ['Giraffe','guess','guess'],
    ['forest','story','story'],
    ['Stop','guess','chat'],
  ];
  for(const [text,from,want] of examples) {
    assert.equal(kids.detectRequestedActivity(text,from),want,JSON.stringify(text));
  }
  const prompt=kids.instructions('Family safety rules','chat',false);
  assert.match(prompt,/NO activity buttons/);
  assert.match(prompt,/story/);
  assert.match(prompt,/guess/);
  assert.match(prompt,/same conversation/i);
  assert.match(prompt,/cannot see any objects/i);
});

test('Qwen game changes use session.update and local starter voice, not response.create',()=>{
  const script=readFileSync(appFile,'utf8');
  assert.match(script,/function requestActivity/);
  assert.match(script,/function startActivity/);
  assert.match(script,/type:'session\.update'/);
  assert.doesNotMatch(script,/type:'response\.create'/);
  assert.match(script,/case 'session\.updated'/);
  assert.match(script,/case 'response\.done'/);
  assert.match(script,/childUI\?\.onLiveReady\(\)/);
  assert.match(script,/childUI\?\.sayFallback\('chat',s\.opening\)/,'Safari starts the chat while Qwen listens via VAD');
  assert.match(script,/case 'input_audio_buffer\.speech_started'/);
  assert.match(script,/case 'input_audio_buffer\.speech_stopped'/);
  assert.match(script,/childUI\?\.onVoiceDetected/);
  assert.match(script,/type:'server_vad'/,'short replies use acoustic VAD');
  assert.match(script,/threshold:s\.vadThreshold/);
});

test('Quiet child sensitivity is lower and clamped to known choices',()=>{
  const window={};
  vm.runInNewContext(readFileSync(extrasFile,'utf8'),{window,Uint8Array});
  const extras=window.MiniExtras;
  assert.equal(extras.speechThreshold('quiet'),0.25);
  assert.equal(extras.speechThreshold('normal'),0.5);
  assert.equal(extras.speechThreshold('noisy'),0.7);
  assert.equal(extras.speechThreshold('unknown'),0.25);
  assert.equal(extras.createMicInputMeter(null,()=>{}),null);
});


test('Conversation preference controls optional questions in every activity',()=>{
  const kid=kidsContent();
  for (const mode of kid.modes) {
    const prompt=kid.instructions('Parent safety instructions',mode,false);
    assert.match(prompt,/SAME AI reply/,mode);
    assert.match(prompt,/ONE short, concrete, new question/);
    assert.match(prompt,/Place the question LAST/);
    assert.match(prompt,/stop speaking and LISTEN/);
    assert.match(prompt,/DO NOT keep asking questions/);
    assert.match(prompt,/Parent safety instructions/);
    assert.match(prompt,/can stand alone without another question/);
    const off=kid.instructions('Parent safety instructions',mode,false,{keepConversationGoing:false});
    assert.match(off,/Optional follow-up questions are OFF/);
    assert.doesNotMatch(off,/questions are ON|ALWAYS|MUST.*question/);
  }
});

test('Follow-up detection skips model questions and respects bedtime and stopping',()=>{
  const kid=kidsContent();
  assert.equal(kid.needsFollowUp('Yes, giraffe! Well done.','Giraffe','completed','guess'),true);
  assert.equal(kid.needsFollowUp('Yes! Which animal has stripes?','Giraffe','completed'),false);
  assert.equal(kid.needsFollowUp('Great! Do you want another animal','dog','completed'),false);
  assert.equal(kid.needsFollowUp('真聪明！我们再玩一次吗？','长颈鹿','completed'),false);
  assert.equal(kid.needsFollowUp('真棒！接下来想去哪里','森林','completed'),false);
  assert.equal(kid.needsFollowUp('Well done!','I do not want to play','completed'),false);
  assert.equal(kid.needsFollowUp('Good guessing!','Stop','completed'),false);
  assert.equal(kid.needsFollowUp('Bye, have a nice day!','bye','completed'),false);
  assert.equal(kid.needsFollowUp('It has a long neck.','no','completed','guess'),true,'ordinary no answer is not a stop request');
  assert.equal(kid.needsFollowUp('Yes!','rabbit','failed'),false);
  assert.equal(kid.needsFollowUp('','rabbit','completed'),false);
});

test('One brief follow-up has activity and English/Mandarin versions, without personal data',()=>{
  const kid=kidsContent();
  for(const mode of kid.modes){
    const en=kid.getFollowUp(mode,'en',0);
    const zh=kid.getFollowUp(mode,'zh',0);
    assert.match(en,/\?/);
    assert.match(zh,/？/);
    assert.ok(en.length>12 && en.length<120);
    assert.ok(zh.length>5 && zh.length<60);
    assert.notEqual(en,zh);
    assert.notEqual(kid.getFollowUp(mode,'en',1),en,'follows up with some variety');
  }
});

test('Direct bilingual stop commands end capture without matching story quotes or negation',()=>{
  const kid=kidsContent();
  for(const text of ['Stop!','Mini, stop talking now.','Please stop listening','Goodbye Mini','I want to stop',"I'm tired",'Mini，别说了！','请停下来','再见','Mini 我累了']) {
    assert.equal(kid.isStopCommand(text),true,text);
  }
  for(const text of ["Don't stop",'Do not stop talking','The dragon said stop','Can we stop the story and guess animals?','I said goodbye to the bear','不要停','故事里的小猫说再见','no',null]) {
    assert.equal(kid.isStopCommand(text),false,String(text));
  }
});

test('Openings vary in both languages and the model receives the exact local question',()=>{
  const kid=kidsContent();
  for(const lang of ['en','zh']) {
    const values=Array.from({length:4},(_,i)=>kid.getOpening(lang,i));
    assert.equal(new Set(values).size,4);
    assert.equal(kid.getOpening(lang,4),values[0]);
    const instructions=kid.instructions('Safety','chat',false,{opening:values[1]});
    assert.ok(instructions.includes(values[1]));
    assert.match(instructions,/Treat the first answer as a response/);
  }
  assert.equal(kid.getOpening('unknown',-1),kid.getOpening('en',0));
});

test('Story choices have consequences and finished stories and ordinary chat stay quiet',()=>{
  const kid=kidsContent();
  const prompt=kid.instructions('Safety','story',false);
  assert.match(prompt,/Make each choice change what happens next/);
  assert.match(prompt,/gentle complete ending without another question/);
  for(const reply of ['You are welcome!','Thanks for playing.','They lived happily ever after. The end.','小猫回家了，故事结束啦！']) {
    assert.equal(kid.needsFollowUp(reply,'forest','completed','story'),false,reply);
  }
  assert.equal(kid.needsFollowUp('I like blue too.','blue','completed','chat'),false);
  assert.equal(kid.needsFollowUp('Correct! Well done!','giraffe','completed','guess'),false);
  assert.equal(kid.needsFollowUp('答对了，真棒！','长颈鹿','completed','guess'),false);
  assert.equal(kid.needsFollowUp('The dragon reaches the forest.','forest','completed','story'),true);
});
