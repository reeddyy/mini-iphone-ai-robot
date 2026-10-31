import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const file = name => fileURLToPath(new URL('../public/' + name, import.meta.url));
const html = readFileSync(file('index.html'), 'utf8');
const css = readFileSync(file('mini-face.css'), 'utf8');
const childSource = readFileSync(file('mini-child-ui.js'), 'utf8');
const appSource = readFileSync(file('app.js'), 'utf8');

test('The expressive face keeps the same accessible, clickable robot element', () => {
  assert.match(html, /id="robotFace" class="face idle"/);
  assert.match(html, /href="\/mini-face\.css"/);
  assert.equal((html.match(/class="mini-lid"/g) || []).length, 2);
  assert.equal((html.match(/class="mini-cheek (?:left|right)"/g) || []).length, 2);
  assert.equal((html.match(/class="mini-star (?:left|right)"/g) || []).length, 2);
  for (const name of ['mini-antenna','mini-brows','mini-ear','mini-freckle','pupil','mouth']) {
    assert.match(html, new RegExp('class="' + name + '(?:[ "])'));
  }
  assert.match(childSource, /face\.setAttribute\('role','button'\)/);
  assert.match(childSource, /face\.setAttribute\('tabindex','0'\)/);
  assert.match(childSource, /face\.addEventListener\('click',tapFace\)/);
  // Child-facing navigation stays free of game-selection buttons.
  for (const id of ['kidChat','kidGuess','kidStory','kidLook']) {
    assert.doesNotMatch(html, new RegExp('id="' + id + '"'));
  }
});

test('Robot expressions are animated without external assets and honor reduced motion', () => {
  assert.match(css, /mini-blink/);
  assert.match(css, /mini-float/);
  assert.match(css, /mini-talk/);
  assert.match(css, /mini-spark/);
  for (const selector of ['\.listening','\.thinking','\.speaking','\.error',
                          '\[data-expression="proud"\]','\[data-expression="surprised"\]',
                          '\[data-expression="curious"\]','\[data-local-voice="true"\]']) {
    assert.match(css, new RegExp(selector));
  }
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.doesNotMatch(css, /(?:url\s*\(|@import\b)/i);
});

test('WebRTC logic still receives Qwen audio; expressions only follow Mini transcript', () => {
  assert.match(appSource, /childUI\?\.reactToMiniSpeech\?\.\(ev\.transcript\)/);
  assert.match(childSource, /face\.dataset\.expression = type/);
  assert.match(childSource, /delete face\.dataset\.expression/);
  assert.match(childSource, /face\.dataset\.localVoice = 'true'/);
  assert.match(childSource, /delete face\.dataset\.localVoice/);
  // Animations do not make new paid requests or save user data.
  assert.doesNotMatch(childSource, /(?:fetch\(|localStorage|sessionStorage|response\.create)/);
  assert.doesNotThrow(() => execFileSync(process.execPath, ['--check', file('mini-child-ui.js')]));
  assert.doesNotThrow(() => execFileSync(process.execPath, ['--check', file('app.js')]));
});

test('Mini reacts to its own positive replies, surprises and questions', () => {
  const elements = new Map();
  const element = () => ({
    textContent:'', dataset:{}, offsetWidth:20,
    classList:{add(){},remove(){},toggle(){}},
    style:{width:'',setProperty(){},removeProperty(){}},
    appendChild(){},setAttribute(){},removeAttribute(){},
    addEventListener(){},scrollIntoView(){},querySelector(){return {textContent:''}},
  });
  const get = id => { if (!elements.has(id)) elements.set(id,element()); return elements.get(id); };
  const labels={chat:'Chat',guess:'Guess',story:'Story',look:'Show',blocked:'Parent setup',
                ready:'Listening',listening:'Listening',speech:'I hear you',prompting:'Thinking'};
  const win={
    MiniKidsContent:{getLabels:()=>labels,mode:m=>m,getFallback:()=> 'Hello there!'},
    scrollTo(){},
  };
  const ctx=vm.createContext({
    window:win,document:{getElementById:get,createElement:element},
    setTimeout:()=>1,clearTimeout(){},Date,
  });
  vm.runInContext(childSource,ctx);
  const ui=win.MiniChildUI.init({
    getSession:()=>null,getLanguage:()=> 'en',stopSession(){},
  });
  const face=get('robotFace');
  ui.reactToMiniSpeech('Correct! Great job!');
  assert.equal(face.dataset.expression,'proud');
  ui.reactToMiniSpeech('Wow! That is wonderful.');
  assert.equal(face.dataset.expression,'surprised');
  ui.reactToMiniSpeech('Which animal do you like?');
  assert.equal(face.dataset.expression,'curious');
  ui.onVoiceDetected(true);
  assert.equal(face.dataset.expression,'curious');
});
