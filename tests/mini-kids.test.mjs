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

test('Kid scripts and main Mini app parse as JavaScript',()=>{
  for (const path of [kidsFile,uiFile,appFile,extrasFile]) {
    assert.doesNotThrow(()=>execFileSync(process.execPath,['--check',path]),path);
  }
});

test('The child home is first, and advanced controls are under parent details',()=>{
  const html = readFileSync(htmlFile,'utf8');
  const kid = html.indexOf('class="kid-home"');
  const adult = html.indexOf('id="parentSetup"');
  const start = html.indexOf('id="startBtn"');
  assert.ok(kid > 0);
  assert.ok(adult > kid,'parent settings follow the face and child actions');
  assert.ok(start > adult,'the charged AI session starts inside parent settings');
  assert.match(html,/<details id="parentSetup" class="parent-setup">/);
  assert.match(html,/<button id="kidStopBtn"/);
  assert.match(html,/<button class="kid-action story" id="kidStory"/);
  assert.match(html,/<button class="kid-action guess" id="kidGuess"/);
  assert.match(html,/<button class="kid-action look" id="kidLook"/);
  assert.match(html,/<input id="sendVideo" type="checkbox">/,'camera sharing opt-in');
  const extras=html.indexOf('/mini-extras.js');
  const stories=html.indexOf('/mini-kids.js');
  const kidUI=html.indexOf('/mini-child-ui.js');
  const app=html.indexOf('/app.js');
  assert.ok(extras > 0 && extras < stories && stories < kidUI && kidUI < app);
});

test('Original bilingual stories contain titles and narration but no user data',()=>{
  const kids=kidsContent();
  assert.ok(kids.storyCount >= 3);
  for(let i=0;i<kids.storyCount;i++) {
    const en=kids.story(i,'en');
    const zh=kids.story(i,'zh');
    assert.ok(en.title.length > 5 && en.text.length > 70);
    assert.ok(zh.title.length > 3 && zh.text.length > 40);
    assert.notEqual(en.title,zh.title);
    assert.notEqual(en.text,zh.text);
  }
  assert.equal(kids.story(kids.storyCount,'en').title,kids.story(0,'en').title);
});

test('Offline animal quiz is bounded, varied and bilingual',()=>{
  const kids=kidsContent();
  assert.ok(kids.quizCount >= 6);
  const positions=new Set();
  for(let i=0;i<kids.quizCount;i++) {
    const en=kids.quiz(i,'en'),zh=kids.quiz(i,'zh');
    assert.ok(en.question.length >= 12);
    assert.ok(zh.question.length >= 8);
    assert.equal(en.choices.length,3);
    assert.equal(zh.correct,en.correct);
    assert.equal(en.choices[en.correct],zh.choices[zh.correct]);
    assert.ok(en.correct>=0 && en.correct<3);
    positions.add(en.correct);
  }
  assert.ok(positions.size>=2,'correct choice is not always in the same position');
});

test('Child UI is offline-first and never sends AI requests directly',()=>{
  const script=readFileSync(uiFile,'utf8');
  assert.match(script,/options\.stopSession\('Switched to free offline play/);
  assert.match(script,/audioInputTrack/);
  assert.match(script,/speechSynthesis/);
  assert.doesNotMatch(script,/fetch\(|sendModelEvent\(|WebSocket\(|RTCPeerConnection\(/);
  assert.match(script,/kidParentLink/);
  assert.match(script,/kidStopBtn/);
});

test('Family companion AI instructions are age-appropriate and avoid emotional dependence',()=>{
  const window={};
  vm.runInNewContext(readFileSync(extrasFile,'utf8'),{window,Uint8Array});
  const instructions=window.MiniExtras.buildInstructions({personality:'playful'});
  assert.match(instructions,/six years old/);
  assert.match(instructions,/trusted grown-up/);
  assert.match(instructions,/family and offline play/);
  assert.match(instructions,/no|never/i);
});
