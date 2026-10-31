// Mini V6 companion surface: all activity buttons use the SAME live Qwen session.
// No activity stops the microphone or starts an offline fake conversation.
(function () {
  'use strict';
  function init(options) {
    const $ = id => document.getElementById(id);
    const content = window.MiniKidsContent;
    if (!content) throw new Error('Mini activity instructions missing');
    const face = $('robotFace');
    const hint = $('kidHint');
    const modeLine = $('kidGameMode');
    const tag = $('kidLiveTag');
    const sparkles = $('kidSparkles');
    const parent = $('parentSetup');
    const micStatus = $('kidMicStatus');
    const micBar = $('kidMicBar');
    const vadStatus = $('kidVadStatus');
    const micHelp = $('kidMicHelp');
    const kidStop = $('kidStopBtn');
    const buttons = [
      {id:'kidChat', mode:'chat'},
      {id:'kidGuess', mode:'guess'},
      {id:'kidStory', mode:'story'},
      {id:'kidLook', mode:'look'},
    ];
    let activity = 'chat';
    let touchCount = 0;
    let speechActive = false;
    let lastLevel = -1;
    let activeNarration = null;
    let pendingStarter = null;
    let moodTimer = null;
    let sparkleTimer = null;
    let lastVoiceAt = 0;
    const canSpeak = Boolean(window.speechSynthesis && window.SpeechSynthesisUtterance);
    const language = () => options.getLanguage() === 'zh' ? 'zh' : 'en';
    const words = () => content.getLabels(language());
    function setHint(message) { hint.textContent = message; }
    function setModeLabel() {
      const labels = words();
      for (const item of buttons) {
        const button = $(item.id);
        const selected = item.mode === activity;
        button.classList.toggle('selected',selected);
        button.setAttribute('aria-pressed',String(selected));
        button.querySelector('strong').textContent = labels[item.mode];
      }
      const session = options.getSession();
      modeLine.textContent = session?.ready && session.mode === 'realtime'
        ? '🎲 ' + labels[activity] + ' · AI conversation'
        : '🎤 Ask a grown-up to start the AI';
    }
    function releaseSpeech() {
      const value = activeNarration;
      activeNarration = null;
      if (!value) return;
      clearTimeout(value.guard);
      if (value.mic && value.restore && !value.session?.stopped && !value.session?.muted) {
        value.mic.enabled = true;
      }
    }
    function stopSpeech() {
      pendingStarter = null;
      try { window.speechSynthesis?.cancel(); } catch {}
      releaseSpeech();
    }
    function sayFallback(mode) {
      const message = content.getFallback(mode,language());
      stopSpeech();
      pendingStarter = mode;
      setHint(message);
      micHelp.textContent='If I am silent, tap my face to hear the question again.';
      if (!canSpeak) return;
      const session = options.getSession();
      if (!session?.ready || session.stopped) return;
      const mic = session.audioInputTrack;
      const utterance = new window.SpeechSynthesisUtterance(message);
      utterance.lang = language() === 'zh' ? 'zh-CN' : 'en-US';
      utterance.rate = 0.9;
      utterance.pitch = 1.05;
      const item = {mic,session,restore:false,guard:null};
      activeNarration = item;
      // Do NOT disable the child's microphone before Safari actually speaks.
      // If Safari blocks speech synthesis, their answer must still reach Qwen.
      utterance.onstart = () => {
        if (activeNarration === item && mic?.enabled && !session.stopped && !session.muted) {
          item.restore = true;
          mic.enabled = false;
        }
      };
      const done = () => { if (activeNarration === item) releaseSpeech(); };
      item.guard = setTimeout(done, 12000);
      utterance.onend = () => { done(); pendingStarter = null; };
      utterance.onerror = () => { done(); micHelp.textContent='Tap Mini’s face to try hearing the question again.'; };
      try { window.speechSynthesis.speak(utterance); }
      catch { done(); }
    }
    function mood(type, duration=850) {
      clearTimeout(moodTimer);
      face.classList.remove('kid-happy','kid-wink','kid-peek','kid-surprised');
      void face.offsetWidth;
      face.classList.add('kid-'+type);
      moodTimer = setTimeout(()=>face.classList.remove('kid-'+type),duration);
    }
    function sparkle(symbol='💜') {
      clearTimeout(sparkleTimer);
      sparkles.textContent = '';
      for(let i=0;i<4;i++){
        const span=document.createElement('span');
        span.className='kid-spark';
        span.textContent=i%2?'✦':symbol;
        sparkles.appendChild(span);
      }
      sparkleTimer=setTimeout(()=>{sparkles.textContent='';},1400);
    }
    function tapFace() {
      if (pendingStarter && options.getSession()?.ready) {
        const again = pendingStarter;
        sayFallback(again); // Direct iPhone touch gesture can unlock Safari narration.
        return;
      }
      touchCount+=1;
      const isPeek=touchCount%4===0;
      mood(isPeek?'peek':'happy',isPeek?1250:850);
      sparkle(isPeek?'✨':'💜');
      setHint(isPeek ? 'Peekaboo!' : words().ready);
    }
    function showParentHelp(message) {
      setHint(message);
      parent.open=true;
      parent.scrollIntoView({block:'start',behavior:'smooth'});
    }
    function select(mode) {
      const session=options.getSession();
      if(!session?.ready || session.mode!=='realtime' || session.stopped) {
        showParentHelp(words().blocked);
        return;
      }
      if(session.muted || !session.audioInputTrack?.enabled) {
        setHint(words().muted);
        return;
      }
      activity=content.mode(mode);
      setModeLabel();
      options.requestActivity(activity);
    }
    function onStatus(info={}) {
      const online=Boolean(info.online);
      tag.classList.toggle('active',online);
      tag.textContent=online?'● AI READY':'♡ NEEDS GROWN-UP';
      kidStop.classList.toggle('hidden',!info.running);
      if(!info.running) {
        micStatus.textContent='🎤 Microphone off';
        micBar.style.width='0%';
        vadStatus.textContent='AI speech detection: off';
        micHelp.textContent='Ask a grown-up to start Mini. Then answer out loud, even with one word.';
        setHint(words().blocked);
      } else if(!online) {
        const session=options.getSession();
        micStatus.textContent=session?.mode==='preview'?'🎤 Local preview only':'🎤 Connecting…';
        vadStatus.textContent=session?.mode==='preview'?'AI is not connected':'AI speech detection: waiting';
      } else if(info.state==='speaking') {
        setHint(words().playing);
      } else if(info.state==='thinking') {
        setHint(words().prompting);
      } else if(info.state==='listening' && !speechActive) {
        setHint(words().listening);
      }
      setModeLabel();
    }
    function onLiveReady() {
      activity='chat';
      speechActive=false;
      micStatus.textContent='🎤 Microphone on';
      micHelp.textContent='When Mini asks, answer normally. Mini now listens for one-word replies.';
      vadStatus.textContent='AI speech detection: ready';
      parent.open=false;
      window.scrollTo({top:0,behavior:'smooth'});
      setModeLabel();
      setHint(words().starting);
    }
    function onActivityStart(value,queued=false) {
      activity=content.mode(value);
      setModeLabel();
      setHint(queued?words().queued:words().prompting);
      if (!queued) {
        mood('happy');
        sparkle('✨');
      }
    }
    function onResponseStarted() {
      stopSpeech();
      setHint(words().playing);
    }
    function onResponseFinished() {
      if(speechActive) return;
      setHint(words().listening);
    }
    function onVoiceDetected(heard) {
      speechActive=heard;
      if(heard) {
        pendingStarter = null;
        lastVoiceAt=Date.now();
        vadStatus.textContent='✅ '+words().speech;
        setHint(words().speech);
        mood('surprised',600);
      } else {
        vadStatus.textContent='✅ AI detected your voice · making a reply';
        setHint(words().prompting);
      }
    }
    function onTranscription(value) {
      if(typeof value!=='string'||!value.trim())return;
      vadStatus.textContent='✅ AI heard: '+value.trim().slice(0,60);
      lastVoiceAt=Date.now();
    }
    function onMicLevel(value) {
      const level=Number.isFinite(value)?Math.max(0,Math.min(100,Math.round(value))):0;
      if(Math.abs(level-lastLevel)<3 && level!==0)return;
      lastLevel=level;
      micBar.style.width=level+'%';
      const session=options.getSession();
      if(!session?.ready || session.stopped) return;
      micStatus.textContent=session.muted||!session.audioInputTrack?.enabled
        ? '🔇 Microphone muted'
        : level>=8?'🎤 Sound reaching mic':'🎤 Mic on · speak near phone';
      // Mic sound is only a local signal, not proof the model recognised speech.
      if(level>=8 && !speechActive && Date.now()-lastVoiceAt>7000) {
        micHelp.textContent='Sound is reaching the phone. If Mini stays silent, move closer, speak clearly, and reduce background noise.';
      }
    }

    face.setAttribute('role','button');
    face.setAttribute('tabindex','0');
    face.setAttribute('aria-label','Tap Mini to make it react');
    face.removeAttribute('aria-hidden');
    face.addEventListener('click',tapFace);
    face.addEventListener('keydown',event=>{
      if(event.key==='Enter'||event.key===' '){event.preventDefault();tapFace();}
    });
    face.addEventListener('pointermove',event=>{
      if(event.pointerType==='touch')return;
      const rect=face.getBoundingClientRect();
      const x=Math.max(-8,Math.min(8,(event.clientX-rect.left-rect.width/2)/9));
      const y=Math.max(-5,Math.min(5,(event.clientY-rect.top-rect.height/2)/14));
      face.style.setProperty('--look-x',x.toFixed(1)+'px');
      face.style.setProperty('--look-y',y.toFixed(1)+'px');
    });
    face.addEventListener('pointerleave',()=>{
      face.style.removeProperty('--look-x');
      face.style.removeProperty('--look-y');
    });
    for(const item of buttons) $(item.id).addEventListener('click',()=>select(item.mode));
    $('kidParentLink').addEventListener('click',()=>{
      parent.open=true;
      parent.scrollIntoView({block:'start',behavior:'smooth'});
    });
    kidStop.addEventListener('click',()=>{
      stopSpeech();
      options.stopSession('Live AI stopped by family.');
    });
    setModeLabel();
    setHint(words().blocked);
    return Object.freeze({
      onStatus,
      onLiveReady,
      onActivityStart,
      onResponseStarted,
      onResponseFinished,
      onVoiceDetected,
      onTranscription,
      onMicLevel,
      sayFallback,
      stopSpeech,
      syncLanguage:()=>{setModeLabel();setHint(options.getSession()?.ready?words().ready:words().blocked);},
    });
  }
  window.MiniChildUI=Object.freeze({init});
})();
