// Observable camera cues only. No identity profiles or emotion classification.
(function () {
  'use strict';
  function validate(value) {
    const keys=['version','personPresent','faceVisible','smiling','waving','confidence'];
    if(!value || typeof value!=='object' || Array.isArray(value) || Object.keys(value).some(key=>!keys.includes(key)) || value.version!==1 ||
      keys.slice(1,5).some(key=>typeof value[key]!=='boolean') || typeof value.confidence!=='number' || !Number.isFinite(value.confidence) || value.confidence<0 || value.confidence>1 ||
      (value.faceVisible && !value.personPresent) || (value.smiling && !value.faceVisible) || (value.waving && !value.personPresent))throw new Error('Invalid visual observation');
    return Object.fromEntries(keys.map(key=>[key,value[key]]));
  }
  function createPolicy() {
    let present=false,absentAt=null,lastReaction=-Infinity,lastSpoken=-Infinity,reactions=0,previous={smiling:false,waving:false};
    return {isExhausted:()=>reactions>=8,accept(value,now,speak=false){
      const observation=validate(value);
      if(observation.confidence<.85)return null;
      if(!observation.personPresent) {
        absentAt ??= now;
        if(now-absentAt>=20000){present=false;previous={smiling:false,waving:false};}
        return null;
      }
      const arrived=!present || (absentAt!==null && now-absentAt>=20000);absentAt=null;present=true;
      const cue=observation.waving && !previous.waving?'wave':arrived?'hello':observation.smiling && !previous.smiling?'smile':null;
      previous={smiling:observation.smiling,waving:observation.waving};
      if(!cue || reactions>=8 || now-lastReaction<30000)return null;
      reactions++;lastReaction=now;
      const spoken=speak && cue!=='smile' && now-lastSpoken>=60000;
      if(spoken)lastSpoken=now;
      return {cue,spoken};
    }};
  }
  function motionDifference(before,after) {
    if(!before || before.length!==after.length)return 255;
    let delta=0;
    for(let i=0;i<after.length;i+=4)delta+=(Math.abs(before[i]-after[i])+Math.abs(before[i+1]-after[i+1])+Math.abs(before[i+2]-after[i+2]))/3;
    return delta/(after.length/4);
  }
  function createSampler(video) {
    const canvas=document.createElement('canvas'),tiny=document.createElement('canvas');tiny.width=32;tiny.height=24;
    const ctx=canvas.getContext('2d',{alpha:false}),small=tiny.getContext('2d',{alpha:false,willReadFrequently:true});
    if(!ctx || !small)throw new Error('Camera sampling unavailable.');
    let detector=null;
    try{if(typeof window.FaceDetector==='function')detector=new window.FaceDetector({fastMode:true,maxDetectedFaces:1});}catch{}
    return async()=>{
      if(!video.videoWidth || !video.videoHeight || video.readyState<2)return null;
      const ratio=Math.min(1,320/video.videoWidth,240/video.videoHeight);
      canvas.width=Math.max(1,Math.round(video.videoWidth*ratio));canvas.height=Math.max(1,Math.round(video.videoHeight*ratio));
      ctx.drawImage(video,0,0,canvas.width,canvas.height);small.drawImage(canvas,0,0,32,24);
      let facePresent=null;
      if(detector){try{facePresent=(await detector.detect(canvas)).length>0;}catch{detector=null;}}
      const frame=canvas.toDataURL('image/jpeg',.65),pixels=small.getImageData(0,0,32,24).data;
      // Clear full camera pixels immediately; only the temporary pair is retained.
      ctx.clearRect(0,0,canvas.width,canvas.height);small.clearRect(0,0,32,24);
      return {frame,pixels,facePresent};
    };
  }
  function start(options) {
    const now=options.now || Date.now,policy=createPolicy();
    let stopped=false,paused=false,epoch=0,busy=false,pair=null,previous=null,lastFace=null,lastCheck=-Infinity,checks=0,abort=null,dirty=false;
    const status=(state,message)=>options.onStatus?.({state,message,checks});
    function interrupt(){epoch++;abort?.abort();abort=null;pair=null;previous=null;lastFace=null;dirty=false;}
    const capture=options.capture || createSampler(options.video);
    async function tick() {
      if(stopped || paused)return;
      if(policy.isExhausted()){paused=true;interrupt();status('limit','Reaction limit reached. Voice chat can continue.');return;}
      if(!options.allowed()){interrupt();status('waiting','Waiting for a quiet moment.');return;}
      if(busy)return;
      busy=true;const version=epoch;
      try {
        const sample=await capture();
        if(stopped || paused || version!==epoch || !options.allowed())return;
        if(!sample)return;
        const time=now(),motion=motionDifference(previous,sample.pixels)>8,faceChanged=sample.facePresent!==null && sample.facePresent!==lastFace;
        dirty ||= motion || faceChanged;
        previous=sample.pixels;lastFace=sample.facePresent;
        if(time-lastCheck<15000)return;
        if(!pair) {
          // Motion and optional native face detection are local gates, not proof of a person or wave.
          if(dirty || time-lastCheck>=45000){pair={frame:sample.frame,at:time};dirty=false;}
          status('ready','Visual awareness ready.');return;
        }
        if(time-pair.at<700)return;
        if(time-pair.at>6000){pair={frame:sample.frame,at:time};return;}
        if(checks>=40){paused=true;pair=null;status('limit','Visual check limit reached. Voice chat can continue.');return;}
        const frames=[pair.frame,sample.frame];pair=null;lastCheck=time;checks++;
        const controller=new AbortController();abort=controller;
        status('checking','Checking visible cues…');
        const observation=validate(await options.observe(frames,controller.signal));
        if(stopped || paused || version!==epoch || controller.signal.aborted || !options.allowed())return;
        const reaction=policy.accept(observation,now(),options.spoken);
        if(reaction)options.onCue(reaction);
        status('ready',reaction?'Mini noticed a '+(reaction.cue==='hello'?'person':reaction.cue)+'.':'Visual awareness ready.');
      } catch(error) {
        if(!stopped && version===epoch){paused=true;interrupt();status('error','Visual awareness paused. Resume to try again; voice chat can continue.');}
      } finally {busy=false;if(version===epoch)abort=null;}
    }
    const timer=(options.setInterval || setInterval)(tick,2000);
    status('ready','Visual awareness ready.');
    return Object.freeze({tick,interrupt,
      toggle(){if(stopped)return false;paused=!paused;interrupt();status(paused?'paused':'ready',paused?'Visual awareness paused.':'Visual awareness ready.');return paused;},
      stop(){if(stopped)return;stopped=true;interrupt();(options.clearInterval || clearInterval)(timer);status('off','Visual awareness off.');},
      isPaused:()=>paused,
    });
  }
  const api=Object.freeze({validate,createPolicy,motionDifference,createSampler,start});
  if(typeof window!=='undefined')window.MiniAwareness=api;else globalThis.MiniAwareness=api;
})();
