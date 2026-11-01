import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

function environment(overrides={}) {
  function element() {
    const classes=new Set(),events={};
    return {children:[],dataset:{},style:{},textContent:'',disabled:false,
      classList:{add:()=>{},remove:()=>{},contains:name=>classes.has(name)},
      replaceChildren(...nodes){this.children=nodes;},append(...nodes){this.children.push(...nodes);},
      get childNodes(){return this.children;},setAttribute(){},
      addEventListener(type,fn){events[type]=fn;},click(){if(!this.disabled)events.click?.();},querySelectorAll(){return this.children;},
    };
  }
  const elements=new Map(),get=id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id);};
  const states=[],interactions=[],revoked=[];let draws=0;
  const window={crypto:{getRandomValues:value=>{draws++;value[0]=1;return value;}},scrollTo(){}};
  const ctx=vm.createContext({window,document:{getElementById:get,querySelector:()=>get('shell'),createElement:element,createElementNS:element},
    AbortController,Uint32Array,URL:{createObjectURL:()=> 'blob:fixture',revokeObjectURL:url=>revoked.push(url)}});
  for(const file of ['mini-visual-schema.js','mini-visuals.js'])vm.runInContext(readFileSync(new URL('../public/'+file,import.meta.url),'utf8'),ctx);
  const renderer=window.MiniVisuals.init({getLanguage:()=> 'en',onStateChange:state=>states.push(state),onInteraction:choice=>interactions.push(choice),...overrides});
  return {renderer,get,states,interactions,revoked,draws:()=>draws,handResult:window.MiniVisuals.handResult};
}
const moves=[{id:'rock',label:'Stone',symbol:'✊',beats:['scissors']},{id:'paper',label:'Paper',symbol:'✋',beats:['rock']},{id:'scissors',label:'Scissors',symbol:'✌️',beats:['paper']}];

test('Every hand-game pairing has the correct result, including ties and unknown moves',()=>{
  const {handResult}=environment();
  for(const child of moves)for(const mini of moves)assert.equal(handResult(moves,child.id,mini.id),child.id===mini.id?'draw':child.beats.includes(mini.id)?'child':'mini');
  assert.throws(()=>handResult(moves,'unknown','rock'),/Unknown/);
  const novel=[{id:'sun',beats:['rain']},{id:'rain',beats:['cloud']},{id:'cloud',beats:['sun']}];
  assert.equal(handResult(novel,'sun','rain'),'child');
});
test('Mini commits before selection, rejects repeated selection and commits once per next round',async()=>{
  const env=environment();
  await env.renderer.apply({version:1,action:'activity',activity:{type:'hand_game',moves,rounds:2}});
  assert.equal(env.draws(),1);
  const oldButton=env.get('visualChoices').children[0];oldButton.click();oldButton.click();
  assert.equal(env.draws(),1);assert.equal(env.states.at(-1).winner,'mini');assert.equal(env.states.at(-1).round,1);
  env.get('visualChoices').children[0].click();assert.equal(env.draws(),2);
  await env.renderer.apply({version:1,action:'interact',choiceId:'scissors'});
  assert.equal(env.states.at(-1).winner,'child');assert.equal(env.states.at(-1).round,2);
});
test('Counting is exact and each object can only be counted once',async()=>{
  const env=environment();
  await env.renderer.apply({version:1,action:'activity',activity:{type:'count',count:3,symbol:'🍎',label:'apple'}});
  const items=env.get('visualCanvas').children[0].children;
  assert.equal(items.length,3);
  for(const item of items){item.click();item.click();}
  assert.equal(env.get('visualResult').textContent,'3 / 3');
});
test('A repeated model choice cannot create an automatic planning loop',async()=>{
  const env=environment();
  await env.renderer.apply({version:1,action:'activity',activity:{type:'choices'},choices:[{id:'moon',label:'Moon'},{id:'sea',label:'Sea'}]});
  await env.renderer.apply({version:1,action:'interact',choiceId:'moon'});
  assert.equal(env.interactions.length,1);
  await env.renderer.apply({version:1,action:'interact',choiceId:'moon'},{allowChoiceContinuation:false});
  assert.equal(env.interactions.length,1);
});
test('Leaving a pending picture aborts it and a late result cannot replace the next scene',async()=>{
  let resolve,signal;
  const env=environment({requestArtwork:(_ticket,value)=>{signal=value;return new Promise(r=>{resolve=r;});}});
  const pending=env.renderer.apply({version:1,action:'artwork',prompt:'A moon cat.'},{imageTicket:'fixture'});
  await env.renderer.apply({version:1,action:'activity',title:'Three apples',activity:{type:'count',count:3,symbol:'🍎',label:'apple'}});
  assert.equal(signal.aborted,true);
  resolve({type:'image/png',size:10});await pending;
  assert.equal(env.renderer.current().title,'Three apples');assert.equal(env.get('visualCanvas').children[0].children.length,3);
});
test('An image-service failure leaves the matching fallback drawing visible without another provider request',async()=>{
  let requests=0;
  const env=environment({requestArtwork:async()=>{requests++;throw Error('Image unavailable');}});
  await env.renderer.apply({version:1,action:'artwork',title:'Moon cat',message:'Our cat is on the moon.',prompt:'A cat on the moon',fallback:{nodes:[{kind:'emoji',text:'🐈'}]}},{imageTicket:'ticket'});
  assert.equal(requests,1);assert.equal(env.get('visualCanvas').children.length,1);assert.equal(env.states.at(-1).status,'fallback');
  assert.equal(env.renderer.describe().objects[0],'🐈');assert.match(env.renderer.speech(),/cat is on the moon.*Sketch only/);
});
test('Spoken counts and hand-game results are taken from the same state rendered on screen',async()=>{
  const spoken=[],env=environment({onNarrate:text=>spoken.push(text)});
  await env.renderer.apply({version:1,action:'activity',activity:{type:'hand_game',moves,rounds:2}});
  env.get('visualChoices').children[0].click();
  assert.match(spoken.at(-1),/You chose Stone.*Mini chose Paper.*Mini won/);
  env.get('visualChoices').children[0].click();env.get('visualChoices').children[2].click();
  assert.match(spoken.at(-1),/You chose Scissors.*Mini chose Paper.*You won/);
  await env.renderer.apply({version:1,action:'activity',activity:{type:'count',count:3,symbol:'🍎',label:'apple'}});
  env.get('visualCanvas').children[0].children[0].click();
  assert.equal(spoken.at(-1),'1 of 3.');assert.equal(env.get('visualResult').textContent,'1 / 3');
});
