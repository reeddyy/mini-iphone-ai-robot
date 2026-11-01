// Camera landmarks stay on this device. Geometry estimates visible cues, never identity or feelings.
(function () {
  'use strict';
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  function geometry(points) {
    if(!Array.isArray(points) || points.length<468 || points.some(p=>!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)))return null;
    const width=distance(points[234],points[454]),mouth=distance(points[61],points[291]);
    if(width<.08 || mouth<.01)return null;
    const lift=((points[13].y+points[14].y-points[61].y-points[291].y)/2)/mouth;
    return {x:(points[234].x+points[454].x)/2,y:(points[10].y+points[152].y)/2,
      tilt:Math.atan2(points[263].y-points[33].y,points[263].x-points[33].x),
      smile:mouth/width>.37 && lift>.015,
      leftEye:distance(points[159],points[145])/distance(points[33],points[133]),
      rightEye:distance(points[386],points[374])/distance(points[362],points[263])};
  }
  function createPolicy() {
    let previous=null,motionAnchor=null,streak=0,lastCue=-Infinity,lastSeen=-Infinity,lastHello=-Infinity,hellos=0,smiling=false;
    return {accept(points,now,spoken=false){
      const g=geometry(points);
      if(!g){streak=0;previous=null;motionAnchor=null;smiling=false;return {face:false};}
      const arriving=now-lastSeen>10000;lastSeen=now;
      streak=g.smile?streak+1:0;
      const wink=Math.min(g.leftEye,g.rightEye)<.11 && Math.max(g.leftEye,g.rightEye)>.23;
      const moving=motionAnchor && (Math.hypot(g.x-motionAnchor.x,g.y-motionAnchor.y)>.035 || Math.abs(g.tilt-motionAnchor.tilt)>.12);
      let cue=streak>=2 && !smiling?'smile':wink?'wink':moving?'motion':arriving?'hello':null;
      if(!g.smile)smiling=false;
      previous=g;motionAnchor ||= g;
      if(now-lastCue<1500)cue=null;
      if(cue){if(cue==='motion')motionAnchor=g;if(cue!=='hello')lastCue=now;if(cue==='smile')smiling=true;}
      const speak=Boolean(cue==='hello' && spoken && hellos<2 && now-lastHello>=60000);
      if(speak){hellos++;lastHello=now;}
      return {face:true,smiling:g.smile,lookX:Math.max(-8,Math.min(8,(.5-g.x)*22)),lookY:Math.max(-5,Math.min(5,(g.y-.5)*14)),tilt:Math.max(-5,Math.min(5,-g.tilt*30)),cue,spoken:speak};
    }};
  }
  function start(options) {
    const policy=createPolicy(),now=options.now || Date.now;
    let stopped=false,paused=false,busy=false,ready=false,worker=null,timer=null,lastState='',epoch=0,jobEpoch=0,loadingTimer=null,lastJob=-Infinity,processing=0,lastMetrics=0,completed=0,warmupFrames=0,metricsSince=now();
    const status=(state,message)=>{if(lastState!==state){lastState=state;options.onStatus?.({state,message});}};
    const reset=()=>options.onLook?.(null);
    function failed(){if(stopped)return;clearTimeout(loadingTimer);(options.clearInterval || clearInterval)(timer);paused=true;busy=false;reset();worker?.terminate();worker=null;status('error','Local reactions could not run. Use Retry local reactions or update Safari. Voice and camera sharing can continue.');}
    async function tick() {
      if(stopped || paused || busy || !ready || now()-lastJob<Math.max(160,processing*1.5))return;
      if(!options.allowed()){epoch++;reset();status('waiting','Local reactions waiting for the camera.');return;}
      if(!options.video.videoWidth || options.video.readyState<2)return;
      busy=true;lastJob=now();const version=epoch;
      try{
        const bitmap=await (options.capture || createImageBitmap)(options.video);
        if(stopped || paused || version!==epoch || !options.allowed()){bitmap.close();busy=false;return;}
        jobEpoch=version;worker.postMessage({type:'frame',bitmap},[bitmap]);
      }catch{failed();}
    }
    status('loading','Loading local camera reactions…');
    try {
      worker=options.worker || new Worker('/mini-face-worker.js');
      worker.onerror=failed;
      worker.onmessage=({data})=>{
        if(stopped)return;
        if(data.type==='error'){failed();return;}
        if(data.type==='ready'){clearTimeout(loadingTimer);ready=true;timer=(options.setInterval || setInterval)(tick,80);tick();return;}
        if(data.type==='done'){const elapsed=now()-lastJob;warmupFrames++;processing=warmupFrames<=2?0:processing?processing*.7+elapsed*.3:elapsed;busy=false;completed++;if(now()-lastMetrics>=1000){options.onMetrics?.({fps:Number((completed*1000/Math.max(1,now()-metricsSince)).toFixed(1)),processingMs:Math.round(elapsed)});lastMetrics=now();metricsSince=now();completed=0;}return;}
        if(data.type!=='landmarks' || jobEpoch!==epoch || paused || !options.allowed())return;
        const cue=policy.accept(data.points,now(),options.spoken && options.canSpeak?.());
        options.onLook?.(cue.face?cue:null);
        if(cue.cue)options.onCue?.(cue);
        status(cue.face?'face':'searching',cue.face?'Local reactions on · face in view.':'Local reactions on · looking for a face.');
      };
      loadingTimer=setTimeout(failed,45000);worker.postMessage({type:'start'});
    }catch{failed();}
    return Object.freeze({tick,isPaused:()=>paused,isUnavailable:()=>!worker && paused,interrupt(){epoch++;reset();},
      toggle(){if(stopped || !worker)return true;paused=!paused;epoch++;reset();status(paused?'paused':'ready',paused?'Local camera reactions paused.':'Local camera reactions ready.');return paused;},
      stop(){if(stopped)return;stopped=true;epoch++;clearTimeout(loadingTimer);(options.clearInterval || clearInterval)(timer);worker?.terminate();worker=null;reset();status('off','Local camera reactions off.');}
    });
  }
  window.MiniLocalAwareness=Object.freeze({geometry,createPolicy,start});
})();
