// Reusable renderer. Qwen composes data; the browser supplies drawing and rules.
(function () {
  'use strict';
  const NS='http://www.w3.org/2000/svg';
  function handResult(moves,child,mini) {
    const a=moves.find(move=>move.id===child),b=moves.find(move=>move.id===mini);
    if(!a || !b)throw new Error('Unknown hand-game move');
    if(child===mini)return 'draw';
    return a.beats.includes(b.id)?'child':'mini';
  }
  function init(options) {
    const $=id=>document.getElementById(id),panel=$('visualScene'),canvas=$('visualCanvas'),choices=$('visualChoices'),result=$('visualResult');
    let plan=null,epoch=0,objectURL=null,imageAbort=null,game=null;
    const lang=()=>options.getLanguage()==='zh' || (options.getLanguage()==='auto' && /[\u3400-\u9fff]/.test((plan?.title || '')+(plan?.message || '')))?'zh':'en';
    function clear(notify=false) {
      epoch++;imageAbort?.abort();imageAbort=null;
      if(objectURL){URL.revokeObjectURL(objectURL);objectURL=null;}
      plan=null;game=null;canvas.replaceChildren();choices.replaceChildren();result.textContent='';
      panel.classList.add('hidden');
      const shell=document.querySelector('.shell');if(shell.dataset.visualActivity==='scene')delete shell.dataset.visualActivity;
      if(notify)options.onExit?.();
    }
    function show() {
      options.onStart?.();
      document.querySelector('.shell').dataset.visualActivity='scene';panel.classList.remove('hidden');
      panel.dataset.type=plan.activity?.type || plan.action;
      $('visualTitle').textContent=plan.title || (lang()==='zh'?'和 Mini 一起看':'Look with Mini');
      $('visualMessage').textContent=plan.message;
      $('visualExit').textContent=lang()==='zh'?'回到 Mini':'Back to Mini';
      canvas.dataset.aspect=plan.aspect || 'square';canvas.style.backgroundColor=plan.background || '#222b48';
      canvas.classList.remove('hidden');
      window.scrollTo({top:0,behavior:'auto'});
    }
    function svgElement(name,attrs={}) {const el=document.createElementNS(NS,name);for(const [key,value] of Object.entries(attrs))el.setAttribute(key,String(value));return el;}
    function draw(nodes) {
      const svg=svgElement('svg',{viewBox:'0 0 100 100',role:'img','aria-label':plan.title || 'Mini visual scene'});
      for(const node of nodes) {
        let el;
        const paint={fill:node.fill,stroke:node.stroke,'stroke-width':node.strokeWidth};
        if(node.kind==='ellipse')el=svgElement('ellipse',{cx:node.x,cy:node.y,rx:node.w/2,ry:node.h/2,...paint});
        if(node.kind==='rect')el=svgElement('rect',{x:node.x-node.w/2,y:node.y-node.h/2,width:node.w,height:node.h,rx:Math.min(node.w,node.h)*.15,...paint});
        if(node.kind==='line')el=svgElement('line',{x1:node.x,y1:node.y,x2:node.w,y2:node.h,...paint,'stroke-linecap':'round'});
        if(node.kind==='polygon')el=svgElement('polygon',{points:node.points.map(point=>point.join(',')).join(' '),...paint});
        if(['text','emoji'].includes(node.kind)) {
          el=svgElement('text',{x:node.x,y:node.y,'font-size':node.size,'text-anchor':'middle','dominant-baseline':'middle',fill:node.fill});
          el.textContent=node.text;
        }
        const rotate=svgElement('g',{transform:`rotate(${node.rotation} ${node.x} ${node.y})`});
        const motion=svgElement('g');motion.classList.add('visual-motion-'+node.motion);motion.append(el);rotate.append(motion);svg.append(rotate);
      }
      canvas.append(svg);
    }
    function button(label,handler,className='visual-choice') {const el=document.createElement('button');el.type='button';el.className=className;el.textContent=label;el.addEventListener('click',handler);return el;}
    function addChoices() {
      for(const choice of plan.choices || [])choices.append(button(choice.label,()=>options.onInteraction?.({id:choice.id,label:choice.label})));
    }
    function renderCount() {
      canvas.replaceChildren();const grid=document.createElement('div');grid.className='visual-count-grid';
      let selected=0;const count=plan.activity.count;
      grid.style.gridTemplateColumns='repeat('+Math.min(4,Math.max(1,count))+',minmax(0,1fr))';
      for(let i=0;i<count;i++) {
        const item=button(plan.activity.symbol,()=>{if(item.disabled)return;item.disabled=true;item.classList.add('counted');selected++;result.textContent=selected+' / '+count;},'visual-count-item');
        item.setAttribute('aria-label',plan.activity.label+' '+(i+1));grid.append(item);
      }
      canvas.append(grid);result.textContent=count===0?(lang()==='zh'?'这里是零个。':'There are zero here.'):(lang()==='zh'?'点一点，一起数。':'Tap each one to count.');
    }
    function nextHandRound() {
      if(!game || game.round>=plan.activity.rounds)return;
      const values=new Uint32Array(1);window.crypto.getRandomValues(values);
      // This choice is committed before the child's click, and stays fixed.
      game.committed=plan.activity.moves[values[0]%plan.activity.moves.length].id;game.picked=false;
      choices.replaceChildren();result.textContent=(lang()==='zh'?'第 ':'Round ')+(game.round+1)+' / '+plan.activity.rounds;
      for(const move of plan.activity.moves) {
        const choice=button('',()=>pickHand(move.id),'visual-choice visual-hand-choice');
        const symbol=document.createElement('span');symbol.textContent=move.symbol;
        const label=document.createElement('span');label.textContent=move.label;choice.append(symbol,label);choices.append(choice);
      }
      const prompt=document.createElement('p');prompt.className='visual-hand-prompt';prompt.textContent=lang()==='zh'?'Mini 已经选好啦。轮到你！':'Mini has chosen. Your turn!';canvas.replaceChildren(prompt);
    }
    function pickHand(id) {
      if(!game || game.picked)return;game.picked=true;
      const moves=plan.activity.moves,child=moves.find(move=>move.id===id),mini=moves.find(move=>move.id===game.committed);
      const winner=handResult(moves,id,mini.id);game[winner]++;game.round++;
      choices.replaceChildren();canvas.replaceChildren();
      for(const [name,move] of [[lang()==='zh'?'你':'You',child],['Mini',mini]]) {
        const card=document.createElement('div');card.className='visual-hand-card';
        const symbol=document.createElement('span');symbol.textContent=move.symbol;
        const label=document.createElement('p');label.textContent=name+': '+move.label;card.append(symbol,label);canvas.append(card);
      }
      result.textContent=(winner==='draw'?(lang()==='zh'?'平局！':'A tie!'):winner==='child'?(lang()==='zh'?'你赢了这一轮！':'You won this round!'):(lang()==='zh'?'Mini 赢了这一轮。':'Mini won this round.'))+
        ' '+(lang()==='zh'?'你 ':'You ')+game.child+' · Mini '+game.mini;
      options.onStateChange?.({type:'hand_game',child:id,mini:mini.id,winner,round:game.round});
      if(game.round<plan.activity.rounds)choices.append(button(lang()==='zh'?'下一轮':'Next round',nextHandRound));
      else choices.append(button(lang()==='zh'?'再玩一次':'Play again',()=>{game={round:0,child:0,mini:0,draw:0};nextHandRound();}));
    }
    async function apply(value,metadata={}) {
      const next=window.MiniVisualSchema.validate(value);
      if(next.action==='keep')return;
      if(next.action==='interact') {
        if(plan?.activity?.type==='hand_game' && plan.activity.moves.some(move=>move.id===next.choiceId))pickHand(next.choiceId);
        else {const choice=plan?.choices?.find(choice=>choice.id===next.choiceId);if(choice && metadata.allowChoiceContinuation!==false)options.onInteraction?.({...choice,interpreted:true});}
        return;
      }
      if(next.action==='clear'){clear(true);return;}
      clear();plan=next;const token=epoch;
      if(plan.action==='activity' && plan.activity.type==='tictactoe'){options.openBoard?.();return;}
      show();
      if(plan.action==='artwork') {
        result.textContent=lang()==='zh'?'Mini 正在画画……':'Mini is drawing…';
        imageAbort=new AbortController();
        try {
          const blob=await options.requestArtwork(metadata.imageTicket,imageAbort.signal);
          if(epoch!==token || imageAbort.signal.aborted)return;
          if(!['image/png','image/jpeg','image/webp'].includes(blob.type) || blob.size>10*1024*1024)throw new Error('Unsupported picture');
          objectURL=URL.createObjectURL(blob);const image=document.createElement('img');image.src=objectURL;image.alt=plan.title || (lang()==='zh'?'Mini 画的图':'Mini’s picture');
          await image.decode();if(epoch!==token)return;
          canvas.append(image);result.textContent='';options.onStateChange?.({action:'artwork',title:plan.title,status:'visible'});
        } catch(error) {
          if(epoch===token){
            if(objectURL){URL.revokeObjectURL(objectURL);objectURL=null;}
            result.textContent=error.message || 'Mini could not finish the picture.';
          }
        }
        finally {if(epoch===token)imageAbort=null;}
        return;
      }
      if(plan.nodes.length)draw(plan.nodes);
      if(plan.action==='activity' && plan.activity.type==='hand_game'){game={round:0,child:0,mini:0,draw:0};nextHandRound();}
      else if(plan.action==='activity' && plan.activity.type==='count')renderCount();
      else addChoices();
      if(!canvas.childNodes.length)canvas.classList.add('hidden');
      options.onStateChange?.({action:plan.action,title:plan.title,activity:plan.activity});
    }
    $('visualExit').addEventListener('click',()=>clear(true));
    return Object.freeze({apply,clear,isActive:()=>Boolean(plan),current:()=>plan,
      cancelPending:()=>{if(imageAbort){epoch++;imageAbort.abort();imageAbort=null;result.textContent=lang()==='zh'?'图片已暂停。':'Picture paused.';}},
      setBusy:busy=>{for(const el of choices.querySelectorAll('button'))el.disabled=busy;},describe:()=>plan?{action:plan.action,title:plan.title,activity:plan.activity}:null});
  }
  window.MiniVisuals=Object.freeze({init,handResult});
})();
