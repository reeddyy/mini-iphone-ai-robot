import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const browserFile = fileURLToPath(new URL('../public/mini-extras.js', import.meta.url));
const appFile = fileURLToPath(new URL('../public/app.js', import.meta.url));
const htmlFile = fileURLToPath(new URL('../public/index.html', import.meta.url));
const stylesheet = fileURLToPath(new URL('../public/style.css', import.meta.url));
const source = readFileSync(browserFile, 'utf8');

function loadExtras(storage) {
  const map = storage || new Map();
  const window = {
    localStorage: {
      getItem: key => map.has(key) ? map.get(key) : null,
      setItem: (key, value) => map.set(key, String(value)),
      removeItem: key => map.delete(key),
    },
  };
  vm.runInNewContext(source, {window, Uint8Array, Math, Number});
  return {extras: window.MiniExtras, map};
}

test('Browser code is syntactically valid JavaScript', () => {
  for (const file of [browserFile, appFile]) {
    assert.doesNotThrow(() => execFileSync(process.execPath, ['--check', file]));
  }
});

test('Session duration and VAD pacing are strictly bounded', () => {
  const {extras} = loadExtras();
  assert.equal(extras.MAX_SESSION_MINUTES, 60);
  for (const minutes of [5, 15, 30, 45, 60]) assert.equal(extras.durationMinutes(String(minutes)), minutes);
  for (const invalid of [0, -5, 90, 1.5, 'unknown', '']) assert.equal(extras.durationMinutes(invalid), 15);
  assert.equal(extras.silenceDuration('fast'), 500);
  assert.equal(extras.silenceDuration('balanced'), 800);
  assert.equal(extras.silenceDuration('patient'), 1200);
  assert.equal(extras.silenceDuration('invalid'), 800);
});

test('Mini prompts preserve bilingual and family-safe behavior', () => {
  const {extras} = loadExtras();
  const defaultText = extras.buildInstructions({});
  assert.match(defaultText, /Mandarin/i);
  assert.match(defaultText, /child/);
  assert.match(defaultText, /live camera/);
  assert.match(extras.buildInstructions({language:'zh', personality:'playful'}), /普通话/);
  assert.match(extras.buildInstructions({language:'en', personality:'calm'}), /Prefer English/);
  assert.match(extras.buildInstructions({note:'Short bedtime stories, please'}), /Short bedtime stories, please/);
  const giant = 'a'.repeat(800);
  assert.equal(extras.boundedNote(giant).length, extras.NOTE_LIMIT);
  assert.equal(extras.buildInstructions({note:giant}).includes(giant), false);
});

test('Preference memory is opt-in, browser-local, clearable, and stores no transcripts', () => {
  const map = new Map();
  const {extras} = loadExtras(map);
  assert.equal(extras.loadSavedNote(), null);
  assert.equal(map.size, 0);
  assert.equal(extras.saveNote('  Enjoy science stories.  '), true);
  assert.equal(extras.loadSavedNote(), 'Enjoy science stories.');
  assert.equal(map.size, 1);
  assert.equal([...map.keys()][0], 'mini-safe-family-note-v1');
  assert.equal(extras.clearNote(), true);
  assert.equal(extras.loadSavedNote(), null);
  assert.equal(map.size, 0);
});

test('Browser storage failures are handled without preventing live sessions', () => {
  const window = {localStorage: {
    getItem: () => { throw Error('blocked'); },
    setItem: () => { throw Error('blocked'); },
    removeItem: () => { throw Error('blocked'); },
  }};
  vm.runInNewContext(source, {window, Uint8Array, Math, Number});
  assert.equal(window.MiniExtras.loadSavedNote(), null);
  assert.equal(window.MiniExtras.saveNote('one'), false);
  assert.equal(window.MiniExtras.clearNote(), false);
  assert.equal(window.MiniExtras.createVoiceMeter({}), null);
});

test('HTML includes the controls expected by app.js and the separate helper script', () => {
  const html = readFileSync(htmlFile, 'utf8');
  const app = readFileSync(appFile, 'utf8');
  const css = readFileSync(stylesheet, 'utf8');
  assert.ok(html.indexOf('src="/mini-extras.js"') < html.indexOf('src="/app.js"'));
  for (const id of [
    'sessionLimit','extendBtn','remainingTime','replyDelay',
    'language','sendVideo','generatedPictures','resetSettingsBtn','settingsInfo',
  ]) {
    assert.match(html, new RegExp('id="' + id + '"'));
  }
  assert.match(app, /scheduleSessionStop/);
  assert.match(app, /extras\.buildInstructions/);
  assert.match(app, /extras\.createVoiceMeter/);
  assert.match(css, /face\.audible/);
});


test('Qwen diagnostics expose only structured error fields, never free-text child speech', () => {
  const {extras} = loadExtras();
  const error = {
    type:'invalid_request_error',
    code:'invalid_value',
    param:'session.instructions',
    message:'Secret phrase or transcript that must not be displayed',
  };
  const safe = extras.modelErrorDetails(error);
  assert.equal(safe.type,'invalid_request_error');
  assert.equal(safe.code,'invalid_value');
  assert.equal(safe.param,'session.instructions');
  assert.equal(JSON.stringify(safe).includes('Secret phrase'),false);
  assert.equal(extras.modelErrorDetails({code:'unsafe <script>'}).code,'unsafescript');
  assert.equal(extras.modelErrorDetails(null).code,'unknown');
  assert.equal(extras.modelErrorDetails({code:'x'.repeat(200)}).code.length,90);
});

test('Remembered settings accept only safe fixed preferences, never credentials or camera sharing',()=>{
  const {extras,map}=loadExtras();
  assert.equal(extras.loadSettings(),null);
  assert.equal(map.size,0);
  extras.saveSettings({language:'zh',sessionLimit:'15',favoriteTopic:'space',reactionSounds:false,
    accessCode:'must-not-save',sendVideo:true,visualAwareness:true,spokenGreetings:true,ALIBABA_API_KEY:'must-not-save',familyNote:'private words',userTranscript:'private words'});
  const stored=JSON.parse(map.get('mini-parent-settings-v1'));
  assert.deepEqual(stored,{language:'zh',sessionLimit:'15',favoriteTopic:'space',reactionSounds:false});
  assert.equal(extras.loadSettings().language,'zh');
  extras.saveNote('We like stories.');
  extras.clearSettings();
  assert.equal(extras.loadSettings(),null);
  assert.equal(extras.loadSavedNote(),'We like stories.');
});

test('Invalid settings and blocked storage do not prevent startup',()=>{
  const map=new Map([['mini-parent-settings-v1','{invalid']]);
  const {extras}=loadExtras(map);
  assert.equal(extras.loadSettings(),null);
  extras.saveSettings({language:'malicious',sessionLimit:'999',reactionSounds:'true',sendVideo:true});
  assert.equal(JSON.stringify(extras.loadSettings()),'{}');
  const window={localStorage:{getItem(){throw Error('blocked');},setItem(){throw Error('blocked');},removeItem(){throw Error('blocked');}}};
  vm.runInNewContext(source,{window,Uint8Array});
  assert.equal(window.MiniExtras.loadSettings(),null);
  assert.equal(window.MiniExtras.saveSettings({language:'en'}),false);
  assert.equal(window.MiniExtras.clearSettings(),false);
});
