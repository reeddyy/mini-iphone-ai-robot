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
  assert.match(script,/childUI\?\.sayFallback\('chat'\)/,'Safari starts the chat while Qwen listens via VAD');
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


test('The companion explicitly asks a NEW question after every ordinary answer',()=>{
  const kid=kidsContent();
  for (const mode of kid.modes) {
    const prompt=kid.instructions('Parent safety instructions',mode,false);
    assert.match(prompt,/SAME (?:spoken|SPOKEN|AUDIO|AI) (?:answer|response|reply)|SAME SPOKEN REPLY/i,mode);
    assert.match(prompt,/ONE short, concrete, new question/);
    assert.match(prompt,/Place the question LAST/);
    assert.match(prompt,/stop speaking and LISTEN/);
    assert.match(prompt,/DO NOT keep asking questions/);
    assert.match(prompt,/Parent safety instructions/);
  }
});

test('Follow-up detection skips model questions and respects bedtime and stopping',()=>{
  const kid=kidsContent();
  assert.equal(kid.needsFollowUp('Yes, giraffe! Well done.','Giraffe','completed'),true);
  assert.equal(kid.needsFollowUp('Yes! Which animal has stripes?','Giraffe','completed'),false);
  assert.equal(kid.needsFollowUp('Great! Do you want another animal','dog','completed'),false);
  assert.equal(kid.needsFollowUp('真聪明！我们再玩一次吗？','长颈鹿','completed'),false);
  assert.equal(kid.needsFollowUp('真棒！接下来想去哪里','森林','completed'),false);
  assert.equal(kid.needsFollowUp('Well done!','I do not want to play','completed'),false);
  assert.equal(kid.needsFollowUp('Good guessing!','Stop','completed'),false);
  assert.equal(kid.needsFollowUp('Bye, have a nice day!','bye','completed'),false);
  assert.equal(kid.needsFollowUp('Nice try!','no','completed'),true,'ordinary no answer is not a stop request');
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
