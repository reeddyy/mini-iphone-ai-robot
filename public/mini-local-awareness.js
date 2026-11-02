// Camera landmarks stay on this device. Geometry estimates visible cues, never identity or feelings.
(function () {
  'use strict';
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  function geometry(points,aspect=1) {
    if(!Array.isArray(points) || points.length<468 || points.some(p=>!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)))return null;
    const width=distance(points[234],points[454]),mouth=distance(points[61],points[291]);
    if(width<.08 || mouth<.01)return null;
    const lift=((points[13].y+points[14].y-points[61].y-points[291].y)/2)/mouth;
    return {x:(points[234].x+points[454].x)/2,y:(points[10].y+points[152].y)/2,
      tilt:Math.atan2(points[263].y-points[33].y,(points[263].x-points[33].x)*(Number.isFinite(aspect) && aspect>0?aspect:1)),
      smile:mouth/width>.37 && lift>.015,
      leftEye:distance(points[159],points[145])/distance(points[33],points[133]),
      rightEye:distance(points[386],points[374])/distance(points[362],points[263])};
  }
  function createPolicy() {
    let motionAnchor=null,streak=0,lastCue=-Infinity,lastSeen=-Infinity,lastSpoken=-Infinity,spokenCount=0,smiling=false,pending=null,neutralTilt=null,headTilt=0;
    return {accept(points,now,spoken=false,aspect=1){
      const g=geometry(points,aspect);
      if(!g){streak=0;motionAnchor=null;smiling=false;pending=null;neutralTilt=null;headTilt=0;return {face:false};}
      const arriving=now-lastSeen>10000;lastSeen=now;
      streak=g.smile?streak+1:0;
      const wink=Math.min(g.leftEye,g.rightEye)<.11 && Math.max(g.leftEye,g.rightEye)>.23;
      const moving=motionAnchor && (Math.hypot(g.x-motionAnchor.x,g.y-motionAnchor.y)>.035 || Math.abs(g.tilt-motionAnchor.tilt)>.12);
      let cue=streak>=2 && !smiling?'smile':wink?'wink':moving?'motion':arriving?'hello':null;
      if(!g.smile)smiling=false;
      motionAnchor ||= g;
      if(now-lastCue<1500)cue=null;
      if(cue){if(cue==='motion')motionAnchor=g;if(cue!=='hello')lastCue=now;if(cue==='smile')smiling=true;}
      if(cue)pending={cue,at:now};
      if(pending && now-pending.at>15000)pending=null;
      // Keep a fresh cue until a quiet moment; first detection often coincides
      // with the opening voice. Holding a smile does not make a speech loop.
      const speak=Boolean(pending && spoken && spokenCount<8 && now-lastSpoken>=20000);
      const spokenCue=speak?pending.cue:null;
      if(speak){spokenCount++;lastSpoken=now;pending=null;}
      neutralTilt ??= g.tilt;
      const angle=Math.atan2(Math.sin(g.tilt-neutralTilt),Math.cos(g.tilt-neutralTilt));
      const target=Math.max(-14,Math.min(14,-angle*180/Math.PI));
      headTilt=headTilt*.6+target*.4;
      return {face:true,smiling:g.smile,lookX:Math.max(-12,Math.min(12,(.5-g.x)*30)),lookY:Math.max(-6,Math.min(6,(g.y-.5)*18)),tilt:headTilt,cue,spoken:speak,spokenCue};
    }};
  }
  function start(options) {
    const now=options.now || Date.now,later=options.setTimeout || setTimeout,clearLater=options.clearTimeout || clearTimeout;
    let policy=createPolicy(),stopped=false,paused=false,busy=false,ready=false,worker=null,timer=null,lastState='',epoch=0,jobEpoch=0,activeJob=0,loadingTimer=null;
    let lastJob=-Infinity,lastResult=now(),lastResume=-Infinity,processing=0,lastMetrics=0,completed=0,warmupFrames=0,metricsSince=now(),restarts=0,hasLook=false;
    const status=(state,message)=>{if(lastState!==state){lastState=state;options.onStatus?.({state,message});}};
    const reset=()=>{hasLook=false;options.onLook?.(null);};
    function failed(){
      if(stopped)return;
      clearLater(loadingTimer);(options.clearInterval || clearInterval)(timer);paused=true;ready=false;busy=false;epoch++;activeJob++;reset();
      worker?.terminate();worker=null;status('error','Local reactions could not run. Use Retry local reactions or update Safari. Voice and camera sharing can continue.');
    }
    function recover(){
      epoch++;activeJob++;busy=false;ready=false;reset();clearLater(loadingTimer);worker?.terminate();worker=null;
      if(restarts>=2){failed();return;}
      restarts++;processing=0;warmupFrames=0;policy=createPolicy();lastJob=-Infinity;lastResult=now();
      status('recovering','Restarting local face tracking after a stalled frame. Voice and camera sharing continue.');
      beginWorker();
    }
    async function tick() {
      if(stopped || paused || !ready)return;
      if(hasLook && now()-lastResult>1200){reset();status('waiting','Waiting for fresh camera reactions.');}
      if(!options.allowed()){epoch++;reset();status('waiting','Local reactions waiting for the camera.');return;}
      if((busy && now()-lastJob>6000) || now()-lastResult>6000){recover();return;}
      if(options.video.paused){
        reset();status('waiting','Resuming the existing camera preview for local reactions.');
        if(now()-lastResume>2000){lastResume=now();try{Promise.resolve(options.video.play?.()).catch(()=>{});}catch{}}
        return;
      }
      if(busy || now()-lastJob<Math.max(160,processing*1.5) || !options.video.videoWidth || options.video.readyState<2)return;
      busy=true;lastJob=now();const version=epoch,job=++activeJob,instance=worker;
      try{
        const bitmap=await (options.capture || createImageBitmap)(options.video);
        if(stopped || paused || version!==epoch || worker!==instance || job!==activeJob || !options.allowed()){
          bitmap.close();if(job===activeJob)busy=false;return;
        }
        jobEpoch=version;instance.postMessage({type:'frame',bitmap},[bitmap]);
      }catch{if(!stopped && version===epoch && worker===instance)failed();}
    }
    let initialWorker=options.worker;
    function beginWorker(){
      if(stopped || paused)return;
      try{
        const instance=initialWorker || (options.createWorker?options.createWorker():new Worker('/mini-face-worker.js'));initialWorker=null;worker=instance;
        instance.onerror=()=>{if(worker===instance)failed();};
        instance.onmessage=({data})=>{
          if(stopped || worker!==instance)return;
          if(data.type==='error'){failed();return;}
          if(data.type==='ready'){clearLater(loadingTimer);ready=true;lastResult=now();tick();return;}
          if(data.type==='done'){
            const elapsed=now()-lastJob;busy=false;
            if(jobEpoch!==epoch)return;
            warmupFrames++;processing=warmupFrames<=2?0:processing?processing*.7+elapsed*.3:elapsed;completed++;
            if(now()-lastMetrics>=1000){options.onMetrics?.({fps:Number((completed*1000/Math.max(1,now()-metricsSince)).toFixed(1)),processingMs:Math.round(elapsed)});lastMetrics=now();metricsSince=now();completed=0;}
            return;
          }
          if(data.type!=='landmarks' || jobEpoch!==epoch || paused || !options.allowed())return;
          lastResult=now();
          const aspect=options.video.videoWidth/options.video.videoHeight;
          const cue=policy.accept(data.points,now(),options.spoken && options.canSpeak?.(),aspect);
          hasLook=Boolean(cue.face);options.onLook?.(cue.face?cue:null);
          if(cue.cue || cue.spokenCue)options.onCue?.(cue);
          status(cue.face?'face':'searching',cue.face?'Local reactions on · face in view.':'Local reactions on · looking for a face.');
        };
        loadingTimer=later(()=>{if(worker===instance && !ready)failed();},45000);instance.postMessage({type:'start'});
      }catch{failed();}
    }
    status('loading','Loading local camera reactions…');
    timer=(options.setInterval || setInterval)(tick,80);beginWorker();
    return Object.freeze({tick,isPaused:()=>paused,isUnavailable:()=>!worker && paused,
      interrupt(){epoch++;reset();policy=createPolicy();},
      toggle(){if(stopped || !worker)return true;paused=!paused;epoch++;reset();policy=createPolicy();lastResult=now();status(paused?'paused':'ready',paused?'Local camera reactions paused.':'Local camera reactions ready.');return paused;},
      stop(){if(stopped)return;stopped=true;epoch++;activeJob++;clearLater(loadingTimer);(options.clearInterval || clearInterval)(timer);worker?.terminate();worker=null;reset();status('off','Local camera reactions off.');}
    });
  }
  window.MiniLocalAwareness=Object.freeze({geometry,createPolicy,start});
})();
