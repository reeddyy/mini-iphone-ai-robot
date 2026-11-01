import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const context=vm.createContext({window:{}});vm.runInContext(readFileSync(new URL('../public/mini-language.js',import.meta.url),'utf8'),context);const language=context.window.MiniLanguage;
test('Language continuity handles English, Mandarin, mixed speech and short learned words',()=>{
  for(const [options,expected] of [[{text:'我想要一只 blue cat'},'zh'],[{text:'Can we say 猫 in Chinese?'},'en'],[{text:'cat',previous:'zh'},'zh'],[{text:'猫',previous:'en'},'en'],[{text:'猫'},'zh'],[{device:['zh-SG']},'zh'],[{device:['en-SG']},'en']])assert.equal(language.resolve(options),expected);
});
test('Explicit language switches override a preference; vocabulary questions do not become switches',()=>{
  for(const [text,expected] of [['English please','en'],['Can you speak Chinese?','zh'],['我们用中文聊天吧','zh'],['请用英语回答','en']])assert.equal(language.requested(text),expected);
  assert.equal(language.requested('How do you say cat in Chinese?'),null);assert.equal(language.requested('猫用英语怎么说'),null);
  assert.equal(language.resolve({preferred:'en',text:'请用中文回答'}),'zh');
});
test('Local narration chooses an installed voice in the right language and avoids Cantonese for Mandarin',()=>{
  const voices=[{lang:'en-US'},{lang:'en-SG',localService:true},{lang:'zh-HK'},{lang:'zh-CN'},{lang:'zh-SG',localService:true}];
  assert.equal(language.voiceFor('en',voices).lang,'en-SG');assert.equal(language.voiceFor('zh',voices).lang,'zh-SG');
  assert.equal(language.voiceFor('zh',[{lang:'zh-HK'}]),null);
});
