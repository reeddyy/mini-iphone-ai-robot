// Shared scene protocol for the browser and server. Model output is data only.
(function () {
  'use strict';
  const actions=['keep','clear','activity','artwork','interact'];
  const motions=['none','float','bounce','wiggle','pulse'];
  const fail=(reason='SCHEMA_MISMATCH')=>{throw Object.assign(new Error('Invalid visual instruction'),{validationReason:reason});};
  function at(field,check){try{return check();}catch(error){error.validationField=field+(error.validationField?'.'+error.validationField:'');throw error;}}

  function object(value,keys) {
    if(!value || typeof value!=='object' || Array.isArray(value))fail('OBJECT_TYPE');
    if(Object.keys(value).some(key=>!keys.includes(key)))fail('UNSUPPORTED_FIELD');
    return value;
  }
  function text(value,max,required=false) {
    if(value===undefined && !required)return '';
    if(typeof value!=='string' || value.length>max || (required && !value.trim()) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))fail('TEXT_VALUE');
    return value.trim();
  }
  function number(value,min,max,fallback) {
    if(value===undefined && fallback!==undefined)return fallback;
    if(typeof value!=='number' || !Number.isFinite(value) || value<min || value>max)fail('NUMBER_RANGE');
    return value;
  }
  function id(value) {if(typeof value!=='string' || !/^[a-z][a-z0-9_-]{0,31}$/.test(value))fail('ID_VALUE');return value;}
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
    object(value,['version','action','title','message','choices','activity','prompt','choiceId','followUp','motion']);
    if(value.version!==1)at('version',()=>fail('VERSION'));
    if(!actions.includes(value.action))at('action',()=>fail('ACTION'));
    const result={version:1,action:value.action,title:at('title',()=>text(value.title,80)),message:at('message',()=>text(value.message,240)),
      ...(value.followUp!==undefined?{followUp:at('followUp',()=>text(value.followUp,140))}:{})};
    if(['keep','clear','interact'].includes(value.action)) {
      if(['activity','prompt','choices','motion'].some(key=>value[key]!==undefined))fail('UNSUPPORTED_FIELD');
      if(value.action==='interact')result.choiceId=at('choiceId',()=>id(value.choiceId));
      else if(value.choiceId!==undefined)fail('UNSUPPORTED_FIELD');
      return result;
    }
    if(value.choiceId!==undefined)fail('UNSUPPORTED_FIELD');
    result.choices=at('choices',()=>choices(value.choices));
    if(value.action==='artwork') {
      if(value.activity!==undefined)fail('UNSUPPORTED_FIELD');
      result.prompt=at('prompt',()=>text(value.prompt,800,true));
      if(value.motion!==undefined && !motions.includes(value.motion))at('motion',()=>fail('MOTION_VALUE'));
      result.motion=value.motion || 'float';
    }else{
      if(value.prompt!==undefined || value.motion!==undefined)fail('UNSUPPORTED_FIELD');
      result.activity=at('activity',()=>activity(value.activity));
      if(result.activity.type==='choices' && result.choices.length<2)at('choices',()=>fail('CHOICE_COUNT'));
    }
    return result;
  }
  const protocol=Object.freeze({validate:value=>at('plan',()=>validate(value))});
  if(typeof window!=='undefined')window.MiniVisualSchema=protocol;
  else globalThis.MiniVisualSchema=protocol;
})();
