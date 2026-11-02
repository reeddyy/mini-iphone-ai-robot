// Small, checked learning turns inside the conversation. Session memory only.
(function () {
  'use strict';
  const topics=[
    ['animals',/\b(?:cat|dog|animal|dinosaur|rabbit|bird|penguin)\b|小猫|小狗|动物|恐龙|兔|企鹅|小鸟/i],
    ['space',/\b(?:space|moon|star|rocket|planet|sun)\b|太空|月亮|星星|火箭|星球|太阳/i],
    ['nature',/\b(?:plant|flower|tree|garden|apple|leaf|leaves)\b|植物|花|树|花园|苹果|叶子/i],
    ['motion',/\b(?:car|ball|wheel|roll|robot|move)\b|汽车|小车|球|轮子|滚|机器人|移动/i],
  ];
  const pair=(en,zh)=>({en,zh});
  const language=value=>value==='zh'?'zh':'en';
  const uncertain=/^(?:(?:i )?(?:do not|don['’]?t) know|not sure|i['’]?m not sure|不知道|我不知道|不确定|不会|我不会)[.!?。！？]*$/i;
  const decline=/^(?:no(?: thanks)?|not now|skip(?: this)?|just (?:chat|talk)|stop the (?:quiz|lesson)|不要|不想|跳过|先不学|不想学|不想答)(?:了|吧)?[.!?。！？]*$/i;
  const endings=/\b(?:goodbye|bye|tired|leave me alone|no more|stop talking)\b|再见|拜拜|我累了|别说了|不想聊|害怕|难过|不开心|\b(?:scared|sad|upset)\b/i;
  const invitations={
    animals:[pair('Our animal explorer could hop or flap. Which shall we try in our pretend story?','我们故事里的动物可以蹦蹦跳，也可以拍拍翅膀。你选哪一个？'),pair('Let’s invent a tiny animal adventure. A moon cat or a garden dinosaur?','我们编个动物小冒险吧。选月亮小猫，还是花园恐龙？')],
    space:[pair('Our pretend rocket needs a destination. The Moon or Mars?','我们的想象火箭要出发啦。去月亮，还是火星？'),pair('Let’s be space detectives. Shall we explore stars or the Moon?','我们当太空小侦探吧。先探索星星，还是月亮？')],
    nature:[pair('Let’s imagine a tiny garden. Shall we plant a flower or an apple tree?','我们想象一个小花园吧。种花，还是种苹果树？'),pair('Garden detectives! Shall we wonder about leaves or flowers?','花园小侦探来啦！想研究叶子，还是花朵？')],
    motion:[pair('Beep boop! Shall our pretend robot roll or hop?','哔哔！我们故事里的机器人用滚的，还是用跳的？'),pair('Let’s invent a tiny vehicle. Should it have wheels or wings?','我们发明一辆小车吧。给它轮子，还是翅膀？')],
    general:[pair('Let’s invent a robot pet. Should it hop or roll?','我们想象一个机器人宠物吧。它用跳的，还是用滚的？'),pair('I have a little adventure idea. Shall we explore a garden or outer space?','我想到一个小冒险。去花园探索，还是去太空？')],
  };
  const sciences=[
    {id:'plant-light',topic:'nature',type:'choice',answers:[/\b(?:sun(?:ny|light)?|light|window)\b|阳光|太阳光|光|窗/,/\b(?:dark|cupboard)\b|黑暗|柜子/],correct:0,
      fact:pair('Plants use light to help make their food.','植物利用光来制造自己需要的养分。'),question:pair('Would a plant get more light by a sunny window or inside a dark cupboard?','放在有阳光的窗边，还是黑暗的柜子里，植物能得到更多光呢？'),hint:pair('Think about where the sunshine can reach. A window or a dark cupboard?','想一想，阳光能照到哪里？窗边，还是黑暗的柜子？'),explain:pair('The sunny window gives the plant light.','有阳光的窗边能给植物提供光。')},
    {id:'sun-star',topic:'space',type:'choice',answers:[/\bstar\b|恒星|星星/,/\bplanet\b|行星/],correct:0,
      fact:pair('The Sun makes its own light.','太阳会自己发光。'),question:pair('Is the Sun a star or a planet?','太阳是恒星，还是行星？'),hint:pair('A star makes its own light. Is the Sun a star or a planet?','恒星会自己发光。太阳是恒星，还是行星？'),explain:pair('The Sun is a star; it makes its own light.','太阳是恒星，它会自己发光。')},
    {id:'rolling',topic:'motion',type:'choice',answers:[/\b(?:ball|round)\b|球|圆的|圆球/,/\b(?:cube|block)\b|方块|积木/],correct:0,
      fact:pair('A round surface helps a ball roll smoothly.','圆圆的表面让球更容易滚动。'),question:pair('Which do you predict rolls more easily: a ball or a cube?','你预测一下，球和方块哪个更容易滚动？'),hint:pair('Imagine the curved surface of a ball and the flat faces of a cube. Which rolls more easily?','想象球的弯曲表面和方块平平的面。哪个更容易滚动呢？'),explain:pair('A ball rolls more easily because its surface is round. That is a prediction, not an experiment we have done.','球的表面是圆的，所以更容易滚动。这是我们的预测，还不是做过的实验结果。')},
    {id:'insect-legs',topic:'animals',type:'number',correct:6,
      fact:pair('A butterfly is an insect. Insects have six legs.','蝴蝶是昆虫，昆虫有六条腿。'),question:pair('How many legs does a butterfly have: six or eight?','蝴蝶有六条腿，还是八条腿？'),hint:pair('A butterfly is an insect. Insects have six legs. Which number fits?','蝴蝶是昆虫，昆虫有六条腿。你选哪个数字呢？'),explain:pair('Six! A butterfly is an insect, so it has six legs.','六条！蝴蝶是昆虫，所以它有六条腿。')},
    {id:'ice-melts',topic:'general',type:'choice',answers:[/\b(?:warm(?:er)?|heat|hot(?:ter)?)\b|温暖|暖和|热|变暖/,/\b(?:cold(?:er)?|freeze|freezer)\b|冷|冰箱|变冷/],correct:0,
      fact:pair('Ice is frozen water.','冰是冻起来的水。'),question:pair('Does ice melt when it gets warmer or colder?','冰变暖时会融化，还是变冷时会融化？'),hint:pair('Imagine an ice cube in warm air. Will warming or cooling help it become liquid water?','想象冰块放在温暖的空气里。变暖，还是变冷，会让它变成水呢？'),explain:pair('Warming helps ice melt into liquid water.','变暖会让冰融化成液态的水。')},
  ];
  function requestedDomain(value=''){
    if(/\b(?:not|don['’]?t|do not)\b|不要|不想|不学/i.test(value))return null;
    if(!/\b(?:learn|teach|quiz|test|question|practice|play|try)\b|学|教|考|题|练习|玩/i.test(value))return null;
    if(/\b(?:maths?|counting|addition|subtraction)\b|数学|算数|算术|加法|减法/i.test(value))return 'math';
    if(/\bscience\b|科学/i.test(value))return 'science';
    return null;
  }
  function numberAnswer(value){
    if(/\b(?:minus|negative)\b|负|(?:^|\s)-\s*\d/.test(value))return null;
    const words=['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen','twenty'];
    const chinese=['零','一','二','三','四','五','六','七','八','九','十'];
    const found=[];
    for(const match of value.matchAll(/\b\d{1,2}\b|\b(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\b|二十|十[一二三四五六七八九]?|[零一二三四五六七八九两]/g)){
      const text=match[0];
      const n=/^\d/.test(text)?Number(text):words.includes(text)?words.indexOf(text):text==='两'?2:text==='二十'?20:text.startsWith('十')?10+(text.length>1?chinese.indexOf(text[1]):0):chinese.indexOf(text);
      found.push(n);
    }
    // "three or four" and "not three" are not a definite answer.
    return found.length===1 && !/\b(?:not|or)\b|不是|或者|还是/.test(value)?found[0]:null;
  }
  function maths(topic,level,round){
    if(round%3===2)return {id:'triangle-sides',topic,type:'number',domain:'math',correct:3,
      fact:pair('A triangle is a flat shape with straight sides.','三角形是由直线边围成的平面图形。'),question:pair('How many sides does a triangle have?','三角形有几条边？'),hint:pair('Imagine tracing a triangle: one side, another side, then the last side. How many?','想象沿着三角形走一圈：一条边，再一条边，最后一条边。一共几条？'),explain:pair('Three! A triangle has three straight sides.','三条！三角形有三条直线边。')};
    const a=[2,3,4][level],b=[1,2,3][level],subtract=round%3===1,total=subtract?a+b:a;
    const noun={animals:pair('pretend animal explorers','想象中的动物探险家'),space:pair('pretend space explorers','想象中的太空探险家'),nature:pair('pretend garden explorers','想象中的花园探险家'),motion:pair('pretend robot explorers','想象中的机器人探险家'),general:pair('pretend explorers','想象中的小探险家')}[topic];
    return {id:(subtract?'subtract':'add')+'-'+total+'-'+b,topic,type:'number',domain:'math',correct:subtract?total-b:total+b,
      fact:pair(`Let’s count our ${noun.en}.`, `我们来数一数${noun.zh}吧。`),
      question:subtract?pair(`There are ${total}, and ${b} go home. How many are left?`,`原来有${total}位，${b}位回家了。还剩几位？`):pair(`There are ${total}, and ${b} more join. How many altogether?`,`原来有${total}位，又来了${b}位。一共有几位？`),
      hint:subtract?pair(`Start with ${total} and count back ${b}. Is it ${total-b} or ${total-b+1}?`,`从${total}开始往回数${b}个。是${total-b}，还是${total-b+1}呢？`):pair(`Start at ${total} and count on ${b}. Is it ${total+b} or ${total+b+1}?`,`从${total}开始再往后数${b}个。是${total+b}，还是${total+b+1}呢？`),
      explain:subtract?pair(`${total} minus ${b} makes ${total-b}.`,`${total}减${b}等于${total-b}。`):pair(`${total} plus ${b} makes ${total+b}.`,`${total}加${b}等于${total+b}。`)};
  }
  function create(){
    let topic='general',turns=0,lastOffered=-3,domain='math',active=null,attempts=0,mathRound=0,scienceRound=0,level=0,streak=0,lastResult=null,invitationRound=0;
    const usedScience=new Set();
    const invitation=lang=>invitations[topic][invitationRound++%invitations[topic].length][language(lang)];
    function observe(value){turns++;for(const [name,match] of topics)if(match.test(value)){topic=name;break;}}
    function dismiss(){active=null;attempts=0;}
    function prompt(lang){return active?active.fact[language(lang)]+' '+active.question[language(lang)]:'';}
    function offer(lang,{force=false,subject}={}){
      if(active || (!force && (turns<2 || turns-lastOffered<3)))return null;
      const next=subject || domain;
      if(next==='math')active=maths(topic,level,mathRound++);
      else{
        const candidates=sciences.filter(item=>!usedScience.has(item.id));
        if(!candidates.length)usedScience.clear();
        const pool=candidates.length?candidates:sciences;
        active={...(pool.find(item=>item.topic===topic) || pool[scienceRound++%pool.length]),domain:'science'};usedScience.add(active.id);
      }
      attempts=0;lastOffered=turns;domain=next==='math'?'science':'math';
      return {text:prompt(lang),kind:'learning',id:active.id};
    }
    function answer(value,lang){
      if(!active || typeof value!=='string')return null;
      const text=value.toLowerCase().trim().slice(0,300),l=language(lang);
      if(window.MiniLanguage?.requested(value))return {kind:'repeat',text:prompt(l)};
      if(decline.test(text)){dismiss();lastResult='skipped';return {kind:'skip',text:l==='zh'?'没问题，我们可以聊点别的。':'Of course. We can talk about something else.'};}
      if(endings.test(text) || window.MiniKidsContent?.wantsChat(text) || requestedDomain(text) ||
        /\b(?:tell|show|story|play|want|let['’]?s|why|how|what)\b|讲故事|给我看|我想|我要|为什么|怎么玩/.test(text)){dismiss();return null;}
      let result=null,ambiguous=false;
      if(active.type==='number'){
        const n=numberAnswer(text);result=n===null?null:n===active.correct;
        ambiguous=/\d|\b(?:one|two|three|four|five|six|seven|eight|nine|ten)\b|[一二三四五六七八九十]/.test(text) && /\bor\b|或者|还是/.test(text);
      }else{
        const selected=active.answers.map((match,i)=>match.test(text)?i:null).filter(i=>i!==null);
        ambiguous=selected.length>1;
        if(selected.length===1 && !/\bnot\b|不是/.test(text))result=selected[0]===active.correct;
      }
      if(result===null && !uncertain.test(text) && !ambiguous){dismiss();return null;}
      if(result===true){
        lastResult='correct';if(active.domain==='math' && ++streak>=2){level=Math.min(2,level+1);streak=0;}
        const reply=(l==='zh'?'你认真想出来啦！':'You worked it out! ')+active.explain[l]+' '+invitation(l);dismiss();
        return {kind:'correct',text:reply};
      }
      attempts++;lastResult='hint';if(active.domain==='math')streak=0;
      if(attempts===1)return {kind:'hint',text:(l==='zh'?'我们一起试试。':'Let’s try it together. ')+active.hint[l]};
      const reply=(l==='zh'?'谢谢你试着回答。':'Thanks for giving it a try. ')+active.explain[l]+' '+invitation(l);
      lastResult='modelled';if(active.domain==='math')level=Math.max(0,level-1);dismiss();return {kind:'modelled',text:reply};
    }
    function checkpoint(lang){
      return {topic,level,lastResult,pending:active?{id:active.id,domain:active.domain,question:active.question[language(lang)],attempts}:null};
    }
    return Object.freeze({observe,offer,answer,dismiss,invitation,prompt,checkpoint,help:lang=>active?.hint[language(lang)] || '',hasQuestion:()=>Boolean(active)});
  }
  function cameraInvitation(cue,lang,round=0){
    const lines={
      hello:[pair('Hello, explorer! Shall we imagine a garden or outer space?','你好呀，小探险家！我们想象去花园，还是去太空？')],
      smile:[pair('I spotted a smile! Here is my robot smile. Shall our pretend robot hop or roll?','我看到一个微笑啦！我也露个机器人微笑。我们故事里的机器人用跳的，还是用滚的？'),pair('Smile spotted! Let’s imagine a smiling star. Should it be blue or gold?','看到微笑啦！我们想象一颗微笑的星星吧。选蓝色，还是金色？')],
      wink:[pair('A wink! Beep boop, here is my wink back. Shall we invent a robot or a rocket?','眨一只眼啦！哔哔，我也眨眨眼。我们想象一个机器人，还是一枚火箭？')],
      motion:[pair('I noticed your head move. My robot eyes are following! Shall we imagine something that rolls or flies?','我注意到你的头动了一下，机器人的眼睛跟着看啦！我们想象一个会滚的东西，还是会飞的东西？')],
    };
    const options=lines[cue];return options?options[round%options.length][language(lang)]:'';
  }
  window.MiniLearning=Object.freeze({create,requestedDomain,cameraInvitation});
})();
