// Shared scene protocol for the browser and server. Model output is data only.
(function () {
  'use strict';
  const actions=['keep','clear','scene','character','activity','artwork','interact'];
  const kinds=['ellipse','rect','line','polygon','text','emoji'];
  const motions=['none','float','bounce','wiggle','pulse'];
  const fail=()=>{throw new Error('Invalid visual instruction');};
  function object(value,keys) {
    if(!value || typeof value!=='object' || Array.isArray(value) || Object.keys(value).some(key=>!keys.includes(key)))fail();
    return value;
  }
  function text(value,max,required=false) {
    if(value===undefined && !required)return '';
    if(typeof value!=='string' || value.length>max || (required && !value.trim()) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))fail();
    return value.trim();
  }
  function number(value,min,max,fallback) {
    if(value===undefined && fallback!==undefined)return fallback;
    if(typeof value!=='number' || !Number.isFinite(value) || value<min || value>max)fail();
    return value;
  }
  function color(value,fallback) {
    if(value===undefined)return fallback;
    if(typeof value!=='string' || !/^#[a-f0-9]{6}$/i.test(value))fail();
    return value;
  }
  function id(value) {if(typeof value!=='string' || !/^[a-z][a-z0-9_-]{0,31}$/.test(value))fail();return value;}
  function node(value) {
    object(value,['kind','x','y','w','h','fill','stroke','strokeWidth','text','size','points','motion','rotation']);
    if(!kinds.includes(value.kind) || (value.motion!==undefined && !motions.includes(value.motion)))fail();
    const result={kind:value.kind,x:number(value.x,0,100,50),y:number(value.y,0,100,50),
      w:number(value.w,0,100,20),h:number(value.h,0,100,20),fill:color(value.fill,'#c8b6ff'),
      stroke:color(value.stroke,'#302a51'),strokeWidth:number(value.strokeWidth,0,5,0),
      rotation:number(value.rotation,-180,180,0),motion:value.motion || 'none'};
    if(['text','emoji'].includes(value.kind)){result.text=text(value.text,80,true);result.size=number(value.size,3,50,12);}
    else if(value.text!==undefined || value.size!==undefined)fail();
    if(value.kind==='polygon') {
      if(!Array.isArray(value.points) || value.points.length<3 || value.points.length>16)fail();
      result.points=value.points.map(point=>{if(!Array.isArray(point) || point.length!==2)fail();return [number(point[0],0,100),number(point[1],0,100)];});
    } else if(value.points!==undefined)fail();
    return result;
  }
  function choices(value) {
    if(value===undefined)return [];
    if(!Array.isArray(value) || value.length>6)fail();
    const result=value.map(choice=>{object(choice,['id','label']);return {id:id(choice.id),label:text(choice.label,70,true)};});
    if(new Set(result.map(choice=>choice.id)).size!==result.length)fail();
    return result;
  }
  function activity(value) {
    object(value,['type','moves','rounds','count','symbol','label']);
    if(!['tictactoe','hand_game','choices','count'].includes(value.type))fail();
    if(value.type==='count') {
      if(value.moves!==undefined || value.rounds!==undefined)fail();
      const count=number(value.count,0,20);if(!Number.isInteger(count))fail();
      return {type:'count',count,symbol:text(value.symbol,8,true),label:text(value.label,40,true)};
    }
    if(['count','symbol','label'].some(key=>value[key]!==undefined))fail();
    if(value.type!=='hand_game') {
      if(value.moves!==undefined || value.rounds!==undefined)fail();
      return {type:value.type};
    }
    if(!Array.isArray(value.moves) || value.moves.length<2 || value.moves.length>5)fail();
    const moves=value.moves.map(move=>{
      object(move,['id','label','symbol','beats']);
      if(!Array.isArray(move.beats) || move.beats.length>4)fail();
      return {id:id(move.id),label:text(move.label,40,true),symbol:text(move.symbol,8,true),beats:move.beats.map(id)};
    });
    const ids=moves.map(move=>move.id);
    if(new Set(ids).size!==ids.length)fail();
    for(const move of moves)if(new Set(move.beats).size!==move.beats.length || move.beats.some(other=>other===move.id || !ids.includes(other)))fail();
    for(let i=0;i<moves.length;i++)for(let j=i+1;j<moves.length;j++) {
      if(Number(moves[i].beats.includes(moves[j].id))+Number(moves[j].beats.includes(moves[i].id))!==1)fail();
    }
    const rounds=number(value.rounds,1,5,3);if(!Number.isInteger(rounds))fail();
    return {type:value.type,moves,rounds};
  }
  function validate(value) {
    object(value,['version','action','title','message','background','aspect','nodes','choices','activity','prompt','choiceId']);
    if(value.version!==1 || !actions.includes(value.action))fail();
    const result={version:1,action:value.action,title:text(value.title,80),message:text(value.message,240)};
    if(['keep','clear','interact'].includes(value.action)) {
      if(['nodes','activity','prompt','choices','background','aspect'].some(key=>value[key]!==undefined))fail();
      if(value.action==='interact')result.choiceId=id(value.choiceId);
      else if(value.choiceId!==undefined)fail();
      return result;
    }
    if(value.choiceId!==undefined)fail();
    if(value.action==='artwork') {
      if(['nodes','choices','activity','background','aspect'].some(key=>value[key]!==undefined))fail();
      return {...result,prompt:text(value.prompt,800,true)};
    }
    if(value.prompt!==undefined)fail();
    result.background=color(value.background,'#222b48');
    if(value.aspect!==undefined && !['square','wide'].includes(value.aspect))fail();
    result.aspect=value.aspect || 'square';
    if(value.nodes!==undefined && (!Array.isArray(value.nodes) || value.nodes.length>32))fail();
    result.nodes=(value.nodes || []).map(node);result.choices=choices(value.choices);
    if(value.action==='activity') {
      result.activity=activity(value.activity);
      if(result.activity.type==='choices' && result.choices.length<2)fail();
    } else {
      if(value.activity!==undefined || !result.nodes.length)fail();
    }
    return result;
  }
  const protocol=Object.freeze({validate});
  if(typeof window!=='undefined')window.MiniVisualSchema=protocol;
  else globalThis.MiniVisualSchema=protocol;
})();
