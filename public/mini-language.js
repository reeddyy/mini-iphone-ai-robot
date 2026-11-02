// Session-only language continuity for English/Mandarin and local narration.
(function () {
  'use strict';
  function requested(text=''){
    if(/how.*say|translate|translation|怎么说|怎么念|什么意思|翻译/i.test(text))return null;
    if(/\b(?:speak|talk|reply|answer|switch(?: to)?|use)\s+(?:to me\s+)?(?:in\s+)?(?:english)\b|^(?:in\s+)?english\s*(?:please)?[!.。！]?$/i.test(text) || /(?:说|用|讲|换成|改用|切换到)(?:英文|英语)/.test(text))return 'en';
    if(/\b(?:speak|talk|reply|answer|switch(?: to)?|use)\s+(?:to me\s+)?(?:in\s+)?(?:chinese|mandarin)\b|^(?:to me\s+)?(?:in\s+)?(?:chinese|mandarin)\s*(?:please)?[!.。！]?$/i.test(text) || /(?:说|用|讲|换成|改用|切换到)(?:中文|汉语|普通话|华语|华文)/.test(text))return 'zh';
    return null;
  }
  function resolve({preferred='auto',text='',previous,device=[]}={}){
    const switchTo=requested(text);if(switchTo)return switchTo;
    if(preferred==='en' || preferred==='zh')return preferred;
    const chinese=(text.match(/[\u3400-\u9fff]/g) || []).length,english=(text.match(/[a-z]+(?:['’][a-z]+)?/gi) || []).filter(word=>word.toLowerCase()!=='mini').length;
    if(previous && ((chinese===0 && english<=2) || (english===0 && chinese<=2)))return previous;
    if(chinese || english)return chinese>english*1.5?'zh':'en';
    if(previous==='zh' || previous==='en')return previous;
    return /^zh(?:-|$)/i.test(device[0] || '')?'zh':'en';
  }
  function voiceFor(language,voices=[]){
    const preferred=language==='zh'?['zh-sg','zh-cn','zh-hans','zh-tw','zh']:['en-sg','en-gb','en-us','en'];
    // Web Speech exposes no gender field. Prefer familiar installed female
    // voices over region/default; the old region-first order could pick Daniel.
    const friendly=language==='zh'?/ting[\s-]?ting|mei[\s-]?jia|tian[\s-]?tian|yu[\s-]?shu|xiaoxiao|xiaoyi|xiaoxuan|female/i:/samantha|karen|moira|tessa|serena|fiona|veena|victoria|zira|aria|jenny|hazel|joanna|salli|susan|allison|\bfemale\b/i;
    const deep=/\b(?:daniel|alex|fred|ralph|bruce|albert|junior|thomas|aaron|david|george|gordon|oliver|arthur|rishi|ryan|guy|yunxi|yunyang|male)\b/i;
    return voices.filter(voice=>{
      const tag=String(voice.lang || '').toLowerCase().replaceAll('_','-');
      return language==='zh'?/^zh(?:-|$)/.test(tag) && !/(?:^|-)(?:hk|mo|yue)(?:-|$)/.test(tag):/^en(?:-|$)/.test(tag);
    }).map(voice=>{
      const tag=voice.lang.toLowerCase().replaceAll('_','-'),index=preferred.findIndex(value=>tag===value);
      const name=String(voice.name || '');
      return {voice,score:(friendly.test(name)?160:deep.test(name)?-160:0)+(index<0?0:50-index*8)+
        (/enhanced|premium|natural|neural/i.test(name)?12:0)+(voice.localService?3:0)+(voice.default?2:0)};
    }).sort((a,b)=>b.score-a.score)[0]?.voice || null;
  }
  function createVoicePicker(){
    const selected=new Map();
    return Object.freeze({select(language,voices=[]){
      const previous=selected.get(language);
      if(previous){
        const current=voices.find(voice=>previous.voiceURI && voice.voiceURI?voice.voiceURI===previous.voiceURI:voice.name===previous.name && voice.lang===previous.lang);
        if(current || !voices.length)return current || previous;
      }
      const voice=voiceFor(language,voices);if(voice)selected.set(language,voice);
      return voice;
    }});
  }
  window.MiniLanguage=Object.freeze({requested,resolve,voiceFor,createVoicePicker});
})();
