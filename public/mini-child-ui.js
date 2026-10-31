// Mini's default child-friendly companion screen.
// Touch play and original offline activities require no Model Studio calls.
// Parent setup remains responsible for starting every paid AI session.
(function () {
  'use strict';
  function init(options) {
    const $ = id => document.getElementById(id);
    const content = window.MiniKidsContent;
    if (!content) throw new Error('Mini Kids content is missing');
    const face = $('robotFace');
    const hint = $('kidHint');
    const tag = $('kidLiveTag');
    const sparkles = $('kidSparkles');
    const activity = $('kidActivity');
    const title = $('kidActivityTitle');
    const body = $('kidActivityBody');
    const choices = $('kidChoices');
    const next = $('kidNext');
    const close = $('kidClose');
    const parent = $('parentSetup');
    const kidStop = $('kidStopBtn');
    const buttons = [
      {id:'kidStory', kind:'story'},
      {id:'kidGuess', kind:'quiz'},
      {id:'kidLook', kind:'look'},
    ];
    let storyIndex = 0;
    let quizIndex = 0;
    let openActivity = '';
    let touchCount = 0;
    let moodTimeout = null;
    let sparkleTimeout = null;
    let activeSpeech = null;
    const localSpeechAvailable = Boolean(window.speechSynthesis && window.SpeechSynthesisUtterance);

    function currentLanguage() {
      return options.getLanguage() === 'zh' ? 'zh' : 'en';
    }
    function words() { return content.words(currentLanguage()); }
    function setHint(message) { hint.textContent = message; }
    function releaseSpeech() {
      const spoken = activeSpeech;
      activeSpeech = null;
      if (!spoken) return;
      clearTimeout(spoken.guardTimer);
      if (spoken.mic && spoken.restore && !spoken.session?.stopped && !spoken.session?.muted) {
        spoken.mic.enabled = true;
      }
    }
    function stopSpeech() {
      try { window.speechSynthesis?.cancel(); } catch {}
      releaseSpeech();
    }
    function speakLocal(message) {
      stopSpeech();
      if (!message || !localSpeechAvailable) return false;
      const session = options.getSession();
      const mic = session?.audioInputTrack;
      const restore = Boolean(mic?.enabled && !session?.muted);
      if (restore) mic.enabled = false; // Don't send our own local voice back to Qwen.
      const utterance = new window.SpeechSynthesisUtterance(message);
      utterance.lang = currentLanguage() === 'zh' ? 'zh-CN' : 'en-US';
      utterance.rate = currentLanguage() === 'zh' ? 0.86 : 0.9;
      utterance.pitch = 1.07;
      utterance.volume = 0.95;
      const spoken = {mic, session, restore, guardTimer:null};
      activeSpeech = spoken;
      const finish = () => { if (activeSpeech === spoken) releaseSpeech(); };
      spoken.guardTimer = setTimeout(finish, 90000);
      utterance.onend = finish;
      utterance.onerror = finish;
      try { window.speechSynthesis.speak(utterance); return true; }
      catch { finish(); return false; }
    }
    function mood(name, duration = 1000) {
      clearTimeout(moodTimeout);
      face.classList.remove('kid-happy','kid-wink','kid-peek','kid-surprised');
      void face.offsetWidth;
      face.classList.add('kid-' + name);
      moodTimeout = setTimeout(() => face.classList.remove('kid-' + name), duration);
    }
    function sparkle(message = '💜') {
      clearTimeout(sparkleTimeout);
      sparkles.textContent = '';
      for (let i = 0; i < 4; i++) {
        const bit = document.createElement('span');
        bit.textContent = i % 2 ? '✦' : message;
        bit.className = 'kid-spark';
        bit.style.setProperty('--spark-i', String(i));
        sparkles.appendChild(bit);
      }
      sparkleTimeout = setTimeout(() => { sparkles.textContent = ''; }, 1400);
    }
    function touchFace() {
      touchCount += 1;
      const peekaboo = touchCount % 4 === 0;
      mood(peekaboo ? 'peek' : 'happy', peekaboo ? 1350 : 900);
      sparkle(peekaboo ? '✨' : '💜');
      setHint(peekaboo ? words().peek : words().pet);
      if (peekaboo) speakLocal(words().peek);
    }
    function closeActivity() {
      stopSpeech();
      activity.classList.add('hidden');
      activity.setAttribute('aria-hidden', 'true');
      choices.textContent = '';
      openActivity = '';
      setHint(options.getSession()?.ready ? words().ready : words().hello);
    }
    function showActivity(name, heading, text) {
      openActivity = name;
      activity.classList.remove('hidden');
      activity.setAttribute('aria-hidden', 'false');
      title.textContent = heading;
      body.textContent = text;
      choices.textContent = '';
      setHint(heading);
    }
    function switchToOfflinePlay() {
      const session = options.getSession();
      if (session && !session.stopped && session.mode === 'realtime') {
        options.stopSession('Switched to free offline play. Paid AI disconnected.');
      }
    }
    function story() {
      switchToOfflinePlay();
      const item = content.story(storyIndex++, currentLanguage());
      showActivity('story', '📖 ' + item.title, item.text);
      next.textContent = words().nextStory;
      next.classList.remove('hidden');
      mood('happy');
      speakLocal(item.text);
    }
    function quiz() {
      switchToOfflinePlay();
      const item = content.quiz(quizIndex++, currentLanguage());
      showActivity('quiz', '🐾 ' + words().quiz, item.question);
      next.textContent = words().nextQuiz;
      next.classList.remove('hidden');
      const idx = quizIndex;
      item.choices.forEach((emoji, choiceIndex) => {
        const button = document.createElement('button');
        button.className = 'kid-choice';
        button.type = 'button';
        button.textContent = emoji;
        button.setAttribute('aria-label', 'Choice ' + (choiceIndex + 1) + ': ' + emoji);
        button.addEventListener('click', () => {
          if (openActivity !== 'quiz' || idx !== quizIndex) return;
          if (choiceIndex === item.correct) {
            mood('happy');
            sparkle('⭐');
            body.textContent = words().right;
            for (const child of choices.children) child.disabled = true;
            speakLocal(words().right);
          } else {
            mood('surprised');
            body.textContent = words().wrong;
            speakLocal(words().wrong);
          }
        });
        choices.appendChild(button);
      });
      speakLocal(item.question);
    }
    function look() {
      const session = options.getSession();
      const canSee = session?.ready && session.mode === 'realtime' &&
        session.wantVideo && !session.videoPaused;
      const message = canSee ? words().lookOnline : words().lookOffline;
      showActivity('look', '👀 ' + words().look, message);
      next.classList.add('hidden');
      mood(canSee ? 'happy' : 'surprised');
      speakLocal(message);
    }
    function onStatus(info = {}) {
      const live = Boolean(info.online);
      tag.textContent = live ? '● LIVE' : '♡ QUIET PLAY';
      tag.classList.toggle('active', live);
      kidStop.classList.toggle('hidden', !info.running);
      // Leave activity instructions on screen until the child dismisses them.
      if (openActivity) return;
      if (info.state === 'speaking') setHint(words().speaking);
      else if (info.state === 'listening' && live) setHint(words().listening);
      else if (info.state === 'thinking' && live) setHint(words().thinking);
      else if (live) setHint(words().ready);
      else if (info.running) setHint(words().hello);
      else setHint(words().hello);
    }

    face.setAttribute('role', 'button');
    face.setAttribute('tabindex', '0');
    face.setAttribute('aria-label', 'Pet Mini to make it smile and react');
    face.removeAttribute('aria-hidden');
    face.addEventListener('click', touchFace);
    face.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        touchFace();
      }
    });
    face.addEventListener('pointermove', event => {
      if (event.pointerType === 'touch') return;
      const rect = face.getBoundingClientRect();
      const dx = Math.max(-8, Math.min(8, (event.clientX - rect.left - rect.width / 2) / 9));
      const dy = Math.max(-5, Math.min(5, (event.clientY - rect.top - rect.height / 2) / 14));
      face.style.setProperty('--look-x', dx.toFixed(1) + 'px');
      face.style.setProperty('--look-y', dy.toFixed(1) + 'px');
    });
    face.addEventListener('pointerleave', () => {
      face.style.removeProperty('--look-x');
      face.style.removeProperty('--look-y');
    });

    for (const entry of buttons) {
      $(entry.id).addEventListener('click', () => {
        if (entry.kind === 'story') story();
        if (entry.kind === 'quiz') quiz();
        if (entry.kind === 'look') look();
      });
    }
    next.addEventListener('click', () => {
      if (openActivity === 'story') story();
      else if (openActivity === 'quiz') quiz();
    });
    close.addEventListener('click', closeActivity);
    kidStop.addEventListener('click', () => {
      stopSpeech();
      options.stopSession('A grown-up stopped the live voice and camera.');
      closeActivity();
    });
    $('kidParentLink').addEventListener('click', () => {
      parent.open = true;
      parent.scrollIntoView({block:'start',behavior:'smooth'});
    });
    setHint(words().hello);
    return {
      onStatus,
      stopSpeech,
      stopAll() { stopSpeech(); closeActivity(); },
      onLiveReady() {
        if (openActivity) closeActivity();
        parent.open = false;
        window.scrollTo({top:0,behavior:'smooth'});
        setHint(words().ready);
      },
      syncLanguage() { if (!openActivity) setHint(words().hello); },
    };
  }
  window.MiniChildUI = Object.freeze({init});
})();
