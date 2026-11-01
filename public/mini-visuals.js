// Reusable renderer. Generated pictures and local animation; interactive games use browser rules.
(function () {
  'use strict';
  function handResult(moves,child,mini) {
    const a=moves.find(move=>move.id===child),b=moves.find(move=>move.id===mini);
    if(!a || !b)throw new Error('Unknown hand-game move');
    if(child===mini)return 'draw';
    return a.beats.includes(b.id)?'child':'mini';
  }
  function init(options) {
    const $=id=>document.getElementById(id),panel=$('visualScene'),canvas=$('visualCanvas'),choices=$('visualChoices'),result=$('visualResult');
    let plan=null,epoch=0,objectURL=null,imageAbort=null,game=null,artworkStatus=null;
    const lang=()=>options.getLanguage()==='zh' || (options.getLanguage()==='auto' && /[\u3400-\u9fff]/.test((plan?.title || '')+(plan?.message || '')))?'zh':'en';
    function clear(notify=false) {
      epoch++;imageAbort?.abort();imageAbort=null;
      if(objectURL){URL.revokeObjectURL(objectURL);objectURL=null;}
      plan=null;game=null;artworkStatus=null;canvas.replaceChildren();choices.replaceChildren();result.textContent='';
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
      canvas.dataset.aspect='square';
      canvas.classList.remove('hidden');
      window.scrollTo({top:0,behavior:'auto'});
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
        const item=button(plan.activity.symbol,()=>{if(item.disabled)return;item.disabled=true;item.classList.add('counted');selected++;result.textContent=selected+' / '+count;
          options.onStateChange?.({...describe(),type:'count',counted:selected,total:count});options.onNarrate?.(lang()==='zh'?'数到 '+selected+' 个，一共 '+count+' 个。':selected+' of '+count+'.');},'visual-count-item');
        item.setAttribute('aria-label',plan.activity.label+' '+(i+1));grid.append(item);
      }
      canvas.append(grid);result.textContent=count===0?(lang()==='zh'?'这里是零个。':'There are zero here.'):(lang()==='zh'?'点一点，一起数。':'Tap each one to count.');
    }
    function nextHandRound(announce=true) {
      if(!game || game.round>=plan.activity.rounds)return;
      const values=new Uint32Array(1);window.crypto.getRandomValues(values);
      // This choice is committed before the child's click, and stays fixed.
      game.committed=plan.activity.moves[values[0]%plan.activity.moves.length].id;game.picked=false;game.lastNarration=null;
      choices.replaceChildren();result.textContent=(lang()==='zh'?'第 ':'Round ')+(game.round+1)+' / '+plan.activity.rounds;
      for(const move of plan.activity.moves) {
        const choice=button('',()=>pickHand(move.id),'visual-choice visual-hand-choice');
        const symbol=document.createElement('span');symbol.textContent=move.symbol;
        const label=document.createElement('span');label.textContent=move.label;choice.append(symbol,label);choices.append(choice);
      }
      const prompt=document.createElement('p');prompt.className='visual-hand-prompt';prompt.textContent=lang()==='zh'?'Mini 已经选好啦。轮到你！':'Mini has chosen. Your turn!';canvas.replaceChildren(prompt);
      if(announce){options.onStateChange?.({...describe(),type:'hand_game',round:game.round+1,status:'choosing'});options.onNarrate?.(result.textContent+'. '+prompt.textContent);}
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
      options.onStateChange?.({...describe(),type:'hand_game',child:id,mini:mini.id,winner,round:game.round,score:{child:game.child,mini:game.mini}});
      game.lastNarration=lang()==='zh'?'你选了'+child.label+'，Mini 选了'+mini.label+'。'+result.textContent:'You chose '+child.label+'. Mini chose '+mini.label+'. '+result.textContent;
      options.onNarrate?.(game.lastNarration);
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
        artworkStatus='generating';options.onStateChange?.(describe());
        result.textContent=lang()==='zh'?'Mini 正在生成图片……':'Making your picture…';
        imageAbort=new AbortController();
        try {
          const blob=await options.requestArtwork(metadata.imageTicket,imageAbort.signal);
          if(epoch!==token || imageAbort.signal.aborted)return;
          if(!['image/png','image/jpeg','image/webp'].includes(blob.type) || blob.size>10*1024*1024)throw new Error('Unsupported picture');
          objectURL=URL.createObjectURL(blob);const image=document.createElement('img');image.src=objectURL;image.draggable=false;image.classList.add('visual-motion-'+plan.motion);image.alt=plan.title || (lang()==='zh'?'Mini 画的图':'Mini’s picture');
          await image.decode();if(epoch!==token)return;
          canvas.replaceChildren(image);result.textContent='';artworkStatus='visible';options.onStateChange?.(describe());
        } catch(error) {
          if(epoch===token){
            if(objectURL){URL.revokeObjectURL(objectURL);objectURL=null;}
            artworkStatus='failed';canvas.replaceChildren();
            result.textContent=error.message || (lang()==='zh'?'图片暂时生成不了，我们还可以聊天。':'The picture couldn’t finish. We can still talk.');
            options.onStateChange?.(describe());
          }
        }
        finally {if(epoch===token){imageAbort=null;addChoices();}}
        return;
      }
      if(plan.action==='activity' && plan.activity.type==='hand_game'){game={round:0,child:0,mini:0,draw:0};nextHandRound(false);}
      else if(plan.action==='activity' && plan.activity.type==='count')renderCount();
      else addChoices();
      if(!canvas.childNodes.length)canvas.classList.add('hidden');
      options.onStateChange?.(describe());
    }
    function describe(){return plan?{action:plan.action,title:plan.title,message:plan.message,activity:plan.activity,choices:plan.choices,
      ...(plan.action==='artwork'?{prompt:plan.prompt,motion:plan.motion}:{}),...(artworkStatus?{status:artworkStatus}:{})}:null;}
    $('visualExit').addEventListener('click',()=>clear(true));
    return Object.freeze({apply,clear,isActive:()=>Boolean(plan),current:()=>plan,
      cancelPending:()=>{if(imageAbort){epoch++;imageAbort.abort();imageAbort=null;if(objectURL){URL.revokeObjectURL(objectURL);objectURL=null;}
        artworkStatus='paused';result.textContent=lang()==='zh'?'图片已暂停。':'Picture paused.';options.onStateChange?.(describe());}},
      setBusy:busy=>{for(const el of choices.querySelectorAll('button'))el.disabled=busy;},describe,
      speech:()=>game?.lastNarration || (plan?[plan.message,result.textContent].filter(Boolean).join(' '):'')});
  }
  window.MiniVisuals=Object.freeze({init,handResult});
})();
