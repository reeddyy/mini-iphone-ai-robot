// Mini V6.3: child-facing UI is only Mini’s face and a live conversation.
// Parent controls retain connection, microphone diagnostics, and privacy safeguards.
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
    const sessionNotice = $('kidSessionNotice');
    let activity = 'chat';
    let touchCount = 0;
    let speechActive = false;
    let lastLevel = -1;
    let activeNarration = null;
    let pendingStarter = null;
    let moodTimer = null;
    let sparkleTimer = null;
    let lastVoiceAt = 0;
    let reactionTimers=[];
    let localTimers=[];
    let localGame=null;
    let chimeContext=null;
    const canSpeak = Boolean(window.speechSynthesis && window.SpeechSynthesisUtterance);
    const language = () => options.getLanguage() === 'zh' ? 'zh' : 'en';
    const words = () => content.getLabels(language());
    function setHint(message) { hint.textContent = message; }
    function setModeLabel() {
      const session = options.getSession();
      if (session?.ready && session.mode === 'realtime' && !session.stopped) {
        modeLine.textContent = session.muted
          ? language() === 'zh' ? '麦克风已静音' : 'The microphone is off'
          : language() === 'zh'
          ? '💜 直接跟 Mini 说话吧！' : '💜 Just talk to Mini!';
      } else {
        modeLine.textContent = language() === 'zh'
          ? '请大人先开启 Mini' : 'A grown-up can wake Mini up';
      }
    }
    function releaseSpeech() {
      const value = activeNarration;
      activeNarration = null;
      delete face.dataset.localVoice;
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
    function sayFallback(mode, phrase=null, replyLanguage=null) {
      const spokenLanguage = replyLanguage === 'zh' ? 'zh' : replyLanguage === 'en' ? 'en' : language();
      const message = typeof phrase === 'string' && phrase.trim()
        ? phrase.trim().slice(0,300) : content.getFallback(mode,spokenLanguage);
      stopSpeech();
      pendingStarter = {mode,text:message,language:spokenLanguage};
      setHint(message);
      micHelp.textContent='Answer Mini out loud. If the voice is silent, tap Mini’s face to hear the question.';
      if (!canSpeak) return;
      const session = options.getSession();
      if (!session?.ready || session.stopped) return;
      const mic = session.audioInputTrack;
      const utterance = new window.SpeechSynthesisUtterance(message);
      utterance.lang = spokenLanguage === 'zh' ? 'zh-CN' : 'en-US';
      utterance.rate = 0.9;
      utterance.pitch = 1.05;
      const item = {mic,session,restore:false,guard:null};
      activeNarration = item;
      // Do NOT disable the child's microphone before Safari actually speaks.
      // If Safari blocks speech synthesis, their answer must still reach Qwen.
      utterance.onstart = () => {
        if (activeNarration !== item) return;
        face.dataset.localVoice = 'true';
        if (mic?.enabled && !session.stopped && !session.muted) {
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
    function sayFollowUp(mode, phrase, replyLanguage) {
      const session=options.getSession();
      if (!session?.ready || session.stopped || session.muted || speechActive) return false;
      sayFallback(mode, phrase, replyLanguage);
      micHelp.textContent='Mini has another question for you. Answer it out loud!';
      return true;
    }
    function mood(type, duration=850) {
      clearTimeout(moodTimer);
      face.classList.remove('kid-happy','kid-wink','kid-peek','kid-surprised','kid-proud','kid-curious','kid-gentle');
      void face.offsetWidth;
      // setStatus() rewrites className. Dataset expression survives it.
      face.dataset.expression = type;
      face.classList.add('kid-'+type);
      moodTimer = setTimeout(()=>{
        face.classList.remove('kid-'+type);
        if (face.dataset.expression === type) delete face.dataset.expression;
      },duration);
    }
    function cancelReactions() {
      reactionTimers.forEach(clearTimeout);reactionTimers=[];
      clearTimeout(moodTimer);
      delete face.dataset.sequence;
      if(face.dataset.expression!=='sleepy')delete face.dataset.expression;
    }
    function celebrate() {
      cancelReactions();
      face.dataset.sequence='celebrate';
      mood('proud',250);sparkle('⭐');
      reactionTimers.push(setTimeout(()=>mood('happy',650),250));
      reactionTimers.push(setTimeout(()=>mood('curious',450),950));
      reactionTimers.push(setTimeout(()=>{delete face.dataset.sequence;},1450));
    }
    function prepareChimes() {
      if(!options.getReactionSounds?.())return;
      try {
        const Ctor=window.AudioContext || window.webkitAudioContext;
        if(!Ctor)return;
        chimeContext ||= new Ctor();
        chimeContext.resume().catch(()=>{});
      } catch {}
    }
    function chirp() {
      prepareChimes();
      if(!chimeContext)return;
      try {
        const osc=chimeContext.createOscillator(),gain=chimeContext.createGain(),now=chimeContext.currentTime;
        osc.type='sine';osc.frequency.setValueAtTime(620,now);osc.frequency.exponentialRampToValueAtTime(820,now+.1);
        gain.gain.setValueAtTime(.001,now);gain.gain.exponentialRampToValueAtTime(.025,now+.02);gain.gain.exponentialRampToValueAtTime(.001,now+.15);
        osc.connect(gain);gain.connect(chimeContext.destination);osc.start(now);osc.stop(now+.16);
        osc.onended=()=>{osc.disconnect();gain.disconnect();};
      } catch {}
    }
    function stopLocalPlay() {
      const wasPlaying=Boolean(localGame);
      localTimers.forEach(clearTimeout);localTimers=[];localGame=null;
      $('localPlayBtn').textContent='✦ Play a tap game · free';
      try{chimeContext?.close().catch(()=>{});}catch{}
      chimeContext=null;
      if(wasPlaying){
        cancelReactions();tag.textContent='♡ NEEDS GROWN-UP';setHint(words().blocked);setModeLabel();
        $('status').textContent=language()==='zh'?'Mini 休息中 · 麦克风和摄像头关闭':'Mini is resting · mic and camera off';
        $('faceTip').textContent=language()==='zh'?'直接跟 Mini 说话吧！💜':'No buttons to learn. Just talk to me! 💜';
      }
    }
    function showTapRound() {
      if(!localGame)return;
      const expected=[2,3,2][localGame.round];
      localGame.phase='watch';localGame.expected=expected;localGame.received=0;
      setHint(language()==='zh'?'看看 Mini 笑几次，然后跟着点！':'Watch Mini smile, then copy with your taps!');
      for(let i=0;i<expected;i++)localTimers.push(setTimeout(()=>{mood('happy',230);chirp();},i*650));
      localTimers.push(setTimeout(()=>{
        if(!localGame)return;
        localGame.phase='copy';
        setHint(language()==='zh'?'轮到你啦，点 Mini '+expected+' 次！':'Your turn—tap Mini '+expected+' times!');
      },expected*650+150));
    }
    function startLocalPlay() {
      const session=options.getSession();
      if(session && !session.stopped)return;
      if(localGame){stopLocalPlay();cancelReactions();setHint(words().blocked);setModeLabel();tag.textContent='♡ NEEDS GROWN-UP';return;}
      stopLocalPlay();cancelReactions();
      localGame={round:0,phase:'watch'};
      $('localPlayBtn').textContent=language()==='zh'?'结束点击游戏':'■ Stop tap game';
      tag.textContent=language()==='zh'?'✦ 本地游戏':'✦ LOCAL PLAY';
      modeLine.textContent=language()==='zh'?'麦克风和摄像头关闭 · 无 AI 费用':'Mic and camera off · no AI charges';
      $('status').textContent=language()==='zh'?'本地游戏 · 麦克风和摄像头关闭':'Local play · mic and camera off';
      $('faceTip').textContent=language()==='zh'?'看看 Mini，再跟着点一点。':'Watch Mini, then copy by tapping the face.';
      prepareChimes();showTapRound();
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
      if(localGame) {
        if(localGame.phase!=='copy')return;
        localGame.received+=1;mood('happy',220);chirp();
        if(localGame.received===localGame.expected) {
          localGame.phase='celebrate';celebrate();
          localGame.round+=1;
          setHint(language()==='zh'?'跟上啦！真棒！':'You copied it! Lovely!');
          localTimers.push(setTimeout(()=>{
            if(!localGame)return;
            if(localGame.round<3)showTapRound();
            else {stopLocalPlay();cancelReactions();onSessionEnded(language());}
          },1700));
        }
        return;
      }
      if(activeNarration && face.dataset.localVoice==='true') {
        stopSpeech();setHint(words().listening);return;
      }
      if (pendingStarter && options.getSession()?.ready) {
        const again = pendingStarter;
        sayFallback(again.mode, again.text, again.language); // A touch can unlock Safari narration.
        return;
      }
      touchCount+=1;
      const reaction=['happy','wink','surprised','peek'][(touchCount-1)%4];
      const isPeek=reaction==='peek';
      mood(reaction,isPeek?1250:1000);
      sparkle(isPeek?'✨':'💜');
      const session=options.getSession();
      setHint(isPeek ? (language()==='zh'?'躲猫猫！':'Peekaboo!')
        : session?.ready && !session.muted ? words().ready
        : language()==='zh'?'碰一下，笑一下！':'Boop! Hello, little friend.');
    }
    function onStatus(info={}) {
      const online=Boolean(info.online);
      $('localPlayBtn').classList.toggle('hidden',Boolean(info.running));
      if(info.running && localGame){stopLocalPlay();cancelReactions();}
      if(info.running && face.dataset.expression==='sleepy') delete face.dataset.expression;
      tag.classList.toggle('active',online);
      tag.textContent=online?(options.getSession()?.muted?'● MIC MUTED':'● AI READY'):'♡ NEEDS GROWN-UP';
      kidStop.classList.toggle('hidden',!info.running);
      if(!info.running) {
        sessionNotice.classList.add('hidden');
        micStatus.textContent='🎤 Microphone off';
        micBar.style.width='0%';
        vadStatus.textContent='AI speech detection: off';
        micHelp.textContent='Ask a grown-up to start Mini. Then answer out loud, even with one word.';
        setHint(words().blocked);
      } else if(options.getSession()?.muted) {
        setHint(words().muted);
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
      micStatus.textContent=options.getSession()?.muted?'🔇 Microphone muted':'🎤 Microphone on';
      micHelp.textContent='When Mini asks, answer normally. Mini now listens for one-word replies.';
      vadStatus.textContent='AI speech detection: ready';
      parent.open=false;
      window.scrollTo({top:0,behavior:'smooth'});
      setModeLabel();
      setHint(words().starting);
      mood('happy',1150);
      sparkle('💜');
    }
    function onTimeRemaining(seconds) {
      const soon = seconds > 0 && seconds <= 60;
      sessionNotice.classList.toggle('hidden', !soon);
      const message = language() === 'zh'
        ? 'Mini 快要休息啦。我们可以把故事说完，然后歇一歇。'
        : 'Mini will rest soon. Let’s finish this little moment, then take a break.';
      if (soon && sessionNotice.textContent !== message) sessionNotice.textContent = message;
    }
    function onSessionEnded(replyLanguage) {
      stopLocalPlay();cancelReactions();
      clearTimeout(moodTimer);
      clearTimeout(sparkleTimer);
      sparkles.textContent='';
      face.dataset.expression='sleepy';
      sessionNotice.classList.add('hidden');
      const zh = replyLanguage === 'zh';
      setHint(zh ? 'Mini 休息啦。谢谢你一起玩！' : 'Mini is resting now. Thanks for playing!');
      modeLine.textContent = zh ? '麦克风和摄像头已关闭。休息一下吧。' : 'Microphone and camera are off. Time for a little break.';
      tag.textContent = zh ? '♡ 休息中' : '♡ RESTING';
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
      cancelReactions();
      stopSpeech();
      setHint(words().prompting);
    }
    function reactToMiniSpeech(transcript) {
      // React only to Mini's own reply, not to the child's face or inferred emotion.
      if (typeof transcript !== 'string' || !transcript.trim()) return;
      const t = transcript.toLowerCase().slice(0,1100);
      if (/\b(?:correct|great job|well done|you got it|brilliant|excellent|awesome)\b|答对|真棒|太棒|厉害|做得好/i.test(t)) {
        celebrate();
      } else if (/\b(?:wow|whoa|amazing|oh my|surprise)\b|哇|真的吗|惊喜/i.test(t)) {
        mood('surprised',1000);
      } else if (/\b(?:it(?:'|’)s okay|no worries|take your time|that(?:'|’)s okay)\b|没关系|慢慢来|别着急/i.test(t)) {
        mood('gentle',1600);
      } else if (/[?？][\s”’"']*$/.test(t)) {
        mood('curious',800);
      } else {
        mood('happy',650);
      }
    }
    function onResponseFinished() {
      if(speechActive) return;
      setHint(options.getSession()?.muted?words().muted:words().listening);
    }
    function onVoiceDetected(heard) {
      speechActive=heard;
      if(heard) {
        cancelReactions();
        pendingStarter = null;
        lastVoiceAt=Date.now();
        vadStatus.textContent='✅ '+words().speech;
        setHint(words().speech);
        mood('curious',680);
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
    $('kidParentLink').addEventListener('click',()=>{
      parent.open=true;
      parent.scrollIntoView({block:'start',behavior:'smooth'});
    });
    $('localPlayBtn').addEventListener('click',startLocalPlay);
    kidStop.addEventListener('click',()=>{
      stopSpeech();
      options.stopSession('Live AI stopped by family.', {gentle:true});
    });
    setModeLabel();
    setHint(words().blocked);
    return Object.freeze({
      onStatus,
      onLiveReady,
      onTimeRemaining,
      onSessionEnded,
      onActivityStart,
      onResponseStarted,
      onResponseFinished,
      reactToMiniSpeech,
      onVoiceDetected,
      onTranscription,
      onMicLevel,
      sayFallback,
      sayFollowUp,
      stopSpeech,
      stopLocalPlay,
      syncLanguage:()=>{setModeLabel();setHint(options.getSession()?.ready?words().ready:words().blocked);},
    });
  }
  window.MiniChildUI=Object.freeze({init});
})();
