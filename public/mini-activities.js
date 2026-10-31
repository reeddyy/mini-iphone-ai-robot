// Bounded, session-only activity state. Never stores a child's free-form words.
(function () {
  'use strict';
  const choices = {
    hero: [{id:'cat',en:'cat',zh:'小猫',match:/\bcat\b|小猫|猫咪|^猫$/}, {id:'dragon',en:'dragon',zh:'小龙',match:/\bdragon\b|小龙|飞龙|龙宝宝|^龙$/}],
    place: [{id:'forest',en:'forest',zh:'森林',match:/\bforest\b|森林/}, {id:'castle',en:'castle',zh:'城堡',match:/\bcastle\b|城堡/}],
    goal: [{id:'star',en:'a fallen star',zh:'小星星',match:/\bstar\b|星星/}, {id:'flower',en:'a glowing flower',zh:'发光的小花',match:/\bflower\b|小花|花朵/}],
  };
  const animals = [
    {id:'giraffe',zh:'长颈鹿',match:/\bgiraffe\b|长颈鹿/,clues:['It has a very long neck.','It eats leaves high in trees.','Its name begins with G.'],zhClues:['它的脖子很长。','它喜欢吃高高树上的叶子。','它是长颈鹿，你能说说它的名字吗？']},
    {id:'elephant',zh:'大象',match:/\belephant\b|大象/,clues:['It has a long trunk.','It has big floppy ears.','Its name begins with E.'],zhClues:['它有长长的鼻子。','它的耳朵很大。','它是大象，你能说说它的名字吗？']},
    {id:'penguin',zh:'企鹅',match:/\bpenguin\b|企鹅/,clues:['This black-and-white bird waddles.','It swims well but cannot fly.','Its name begins with P.'],zhClues:['这种黑白色的小鸟走路摇摇摆摆。','它会游泳，却不会飞。','它是企鹅，你能说说它的名字吗？']},
  ];
  const fresh = () => ({kind:'chat',revision:0,story:null,game:null});
  function select(list,text) {
    const found=list.filter(choice => {
      const match=choice.match.exec(text);
      return match && !/(?:\bnot\s+|\bno\s+|(?:do not|don['’]t) want\s+|不要|不是)$/.test(text.slice(0,match.index));
    });
    return found.length===1 ? found[0].id : null;
  }
  function advance(previous, value) {
    const state=previous || fresh();
    if(typeof value!=='string' || !value.trim()) return state;
    const text=value.trim().toLowerCase().slice(0,400);
    if(state.kind==='story' && /\b(?:finish|end|wrap up)\b.*\bstory\b|讲完故事|故事结尾|结束故事/.test(text)) {
      return {...state,revision:state.revision+1,story:{...state.story,stage:'ending'}};
    }
    const requested=window.MiniKidsContent.detectRequestedActivity(text,state.kind);
    const newStory=/\b(?:another|new|restart)\b.*\bstory\b|再讲.*故事|新的故事/.test(text);
    if(requested!==state.kind || (requested==='story' && newStory)) {
      return {kind:requested,revision:state.revision+1,
        story:requested==='story'?{stage:'hero',hero:null,place:null,goal:null}:null,
        game:requested==='guess'?{round:0,attempts:0,lastResult:null}:null};
    }
    if(state.kind==='story' && choices[state.story?.stage]) {
      const stage=state.story.stage;
      const answer=select(choices[stage],text);
      if(!answer)return state;
      const next={hero:'place',place:'goal',goal:'ending'}[stage];
      return {...state,revision:state.revision+1,story:{...state.story,[stage]:answer,stage:next}};
    }
    if(state.kind==='guess' && state.game?.round<animals.length) {
      const game=state.game;
      const correct=animals[game.round].match.test(text) && !/\bnot\b|不是/.test(text);
      return {...state,revision:state.revision+1,game:{
        round:correct?game.round+1:game.round,attempts:correct?0:Math.min(2,game.attempts+1),lastResult:correct?'correct':'try',
      }};
    }
    return state;
  }
  function fromOpening(opening) {
    return /story|故事/i.test(opening || '') ? advance(fresh(),'tell me a story') : fresh();
  }
  function finishReply(state) {
    return state?.kind==='story' && state.story.stage==='ending'
      ? {...state,revision:state.revision+1,story:{...state.story,stage:'complete'}} : state;
  }
  function prompt(state,lang='en') {
    const zh=lang==='zh';
    if(state?.kind==='story') {
      const prompts={hero:zh?'主角是小猫还是小龙？':'Should our hero be a cat or a dragon?',place:zh?'去森林还是城堡？':'Should our hero visit a forest or a castle?',goal:zh?'去找小星星还是发光的小花？':'Should we find a fallen star or a glowing flower?',ending:zh?'一起给故事一个温柔的结尾吧。':'Let’s give our story a gentle ending.',complete:zh?'故事结束啦。':'The end.'};
      return prompts[state.story.stage];
    }
    if(state?.kind==='guess') {
      const animal=animals[state.game.round];
      return animal?(zh?animal.zhClues:animal.clues)[state.game.attempts]+(zh?' 是什么动物呢？':' Which animal is it?'):(zh?'三个小谜语都猜完啦！':'Our three little riddles are finished!');
    }
    return '';
  }
  function summary(state,lang='en') {
    const zh=lang==='zh';
    if(state?.kind==='story') {
      return ['hero','place','goal'].map(key=>choices[key].find(item=>item.id===state.story[key]))
        .filter(Boolean).map(item=>item[zh?'zh':'en']).join(' · ');
    }
    return state?.kind==='guess'?(zh?'猜猜动物':'Animal riddles')+' · '+Math.min(3,state.game.round+1)+'/3':'';
  }
  function instructions(state,lang='en') {
    if(!state || state.kind==='chat' || state.kind==='look')return '';
    return 'Session-only activity checkpoint (fixed choices, not private information): '+JSON.stringify(state)+'. Keep all chosen characters, places and goals consistent. The next useful step is: '+prompt(state,lang)+
      '. Incorporate the last choice in one or two story sentences before offering the next choice. If the story or three-riddle game is complete, celebrate briefly and wait; do not restart without a request. Respect the parent follow-up preference and child requests to change topic.';
  }
  window.MiniActivities=Object.freeze({fresh,advance,fromOpening,finishReply,prompt,summary,instructions});
})();
