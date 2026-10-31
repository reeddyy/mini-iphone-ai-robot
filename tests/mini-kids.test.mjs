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

test('Child home has four live conversation buttons and microphone feedback',()=>{
  const html=readFileSync(htmlFile,'utf8');
  const kid=html.indexOf('class="kid-home"'),adult=html.indexOf('id="parentSetup"');
  assert.ok(kid>0 && adult>kid);
  for(const id of ['kidChat','kidGuess','kidStory','kidLook','kidMicStatus','kidMicBar','kidVadStatus','kidMicHelp','listenSensitivity']) {
    assert.ok(html.includes('id="'+id+'"'),id);
  }
  assert.match(html,/<input id="sendVideo" type="checkbox">/,'camera is opt-in');
  assert.match(html,/<details id="parentSetup" class="parent-setup">/);
  assert.ok(html.indexOf('id="startBtn"')>adult,'paid AI starts under parent area');
  assert.doesNotMatch(html,/FREE · OFFLINE|OFFLINE<\/small>/);
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

test('The child UI never stops Qwen simply because a game is selected',()=>{
  const script=readFileSync(uiFile,'utf8');
  assert.match(script,/options\.requestActivity\(activity\)/);
  assert.doesNotMatch(script,/Switched to free offline play/);
  assert.doesNotMatch(script,/function switchToOfflinePlay/);
  assert.doesNotMatch(script,/fetch\(|RTCPeerConnection\(/);
  assert.match(script,/onVoiceDetected/);
  assert.match(script,/onMicLevel/);
  assert.match(script,/onTranscription/);
  assert.match(script,/mic\.enabled = false/,'brief local fallback avoids echo');
  assert.match(script,/mic\.enabled = true/,'mic is restored after fallback');
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
