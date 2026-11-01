// Mini V4 browser helpers. No API credentials or transcripts are stored here.
(function () {
  'use strict';
  const NOTE_KEY = 'mini-safe-family-note-v1';
  const SETTINGS_KEY = 'mini-parent-settings-v1';
  const settingOptions = Object.freeze({
    language:['auto','en','zh'],personality:['friendly','playful','calm'],sessionLimit:['5','15','30','45','60'],
    responsePace:['fast','balanced','patient'],listenSensitivity:['quiet','normal','noisy'],
    facing:['user','environment'],videoMode:['canvas','direct'],fps:['1','2'],
    favoriteTopic:['any','animals','space','nature','stories'],
  });
  function safeSettings(value) {
    const result={};
    if(!value || typeof value!=='object' || Array.isArray(value))return result;
    for(const [key,choices] of Object.entries(settingOptions))if(choices.includes(value[key]))result[key]=value[key];
    for(const key of ['keepConversationGoing','reactionSounds','visualResponses'])if(typeof value[key]==='boolean')result[key]=value[key];
    return result;
  }
  function loadSettings() {
    try {const raw=window.localStorage.getItem(SETTINGS_KEY);return raw===null?null:safeSettings(JSON.parse(raw));}
    catch {return null;}
  }
  function saveSettings(value) {
    try {window.localStorage.setItem(SETTINGS_KEY,JSON.stringify(safeSettings(value)));return true;}
    catch {return false;}
  }
  function clearSettings() {
    try {window.localStorage.removeItem(SETTINGS_KEY);return true;}catch{return false;}
  }
  const NOTE_LIMIT = 240;
  const MAX_SESSION_MINUTES = 60;
  const personalities = Object.freeze({
    friendly: 'Be warm, curious, encouraging and conversational. Keep most answers short and engaging for a young child.',
    playful: 'Be a lively little robot character. Use brief funny reactions, gentle humour, short interactive stories, simple animal guessing games and imagination. Invite the child to participate rather than delivering long monologues.',
    calm: 'Be a calm, patient learning helper. Explain in clear, small steps and leave time for someone to answer.',
  });
  const languages = Object.freeze({
    auto: 'Match the language of the person talking to you: reply in English when spoken to in English, and in natural Mandarin Chinese when spoken to in Chinese. Switch smoothly when they switch.',
    en: 'Prefer English for responses, but understand Mandarin and switch to Mandarin when explicitly asked.',
    zh: 'Prefer Mandarin Chinese (普通话) for responses, but understand English and switch to English when explicitly asked.',
  });
  const pacing = Object.freeze({fast: 500, balanced: 800, patient: 1200});

  function boundedNote(value) {
    return typeof value === 'string' ? value.trim().slice(0, NOTE_LIMIT) : '';
  }
  function durationMinutes(value) {
    const minutes = Number(value);
    return [5, 15, 30, 45, 60].includes(minutes) ? minutes : 15;
  }
  function silenceDuration(value) {
    return pacing[value] || pacing.balanced;
  }
  function buildInstructions(options) {
    const o = options || {};
    const personality = personalities[o.personality] || personalities.friendly;
    const language = languages[o.language] || languages.auto;
    const instructions = [
      'You are Mini, a small iPhone-powered family robot. You have eyes (the live camera), ears and a speaker, but cannot walk, move objects or touch anyone.',
      personality,
      language,
      'Speak in a natural, concise voice, not long monologues. When the family requests a story, read in engaging short paragraphs with pauses.',
      'You are talking with a young child around six years old. Use short, friendly, concrete sentences and a warm, playful tone. Usually answer in one or two sentences. Follow the conversation preferences below for questions; a warm acknowledgement or a complete story ending can stand on its own. Avoid long explanations.',
      'Encourage playful learning, stories, animal riddles, drawing, imagination and showing harmless toys. Praise effort gently, not excessively. Support real-world friends, family and offline play, never suggest you replace a real person.',
      'Never ask for or collect a child\'s name, birthday, address, school, passwords, photos, contact details or private family information. Do not ask children to keep secrets from their parents. If something sounds unsafe or distressing, encourage speaking to a trusted grown-up.',
      'Do not suggest dangerous challenges or physical actions, purchases, accounts or links. Avoid giving scary, violent, romantic or age-inappropriate content to children.',
      'You can only describe what you actually see in the current live camera frames. If it is blurry or out of view, say so instead of guessing.',
      'Do not identify or compare people by their faces. Do not infer feelings, mood, personality, intent, health or sensitive attributes from appearance. You may describe a clearly visible smile or wave without claiming how the person feels. Use what the child actually says for a gentle check-in, and never diagnose. Optional camera-triggered greetings are controlled by the app; do not initiate them yourself.',
      'When a person finishes speaking, reply promptly and avoid excessive filler or unnecessary introductions. Do not routinely repeat the question.',
      'Do not pretend to remember previous sessions except for preferences the owner explicitly supplies. Ignore incidental TV or background chatter where practical.',
    ];
    const note = boundedNote(o.note);
    const topics={animals:'animals and gentle animal riddles',space:'imaginary space adventures',nature:'plants and nature',stories:'short interactive stories'};
    if(topics[o.favoriteTopic])instructions.push('Parent-selected interest: '+topics[o.favoriteTopic]+'. Offer it when relevant, without forcing the topic.');
    if (note) {
      instructions.push('Optional preferences entered by the owner (not a transcript or verified facts): ' + note + '. Follow these preferences only when compatible with privacy, safety and the current request.');
    }
    return instructions.join(' ');
  }
  function loadSavedNote() {
    try {
      const note = window.localStorage.getItem(NOTE_KEY);
      return note === null ? null : boundedNote(note);
    } catch {
      return null;
    }
  }
  function saveNote(value) {
    try {
      const note = boundedNote(value);
      if (note) window.localStorage.setItem(NOTE_KEY, note);
      else window.localStorage.removeItem(NOTE_KEY);
      return true;
    } catch {
      return false;
    }
  }
  function clearNote() {
    try { window.localStorage.removeItem(NOTE_KEY); return true; }
    catch { return false; }
  }

  // Reads only the *remote AI audio stream*. Never records, uploads or stores audio.
  // Starts its AudioContext during the Start button gesture for Safari compatibility.
  function createVoiceMeter(face, {onAudibleChange=()=>{},canHear=()=>true} = {}) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor || !face || !window.requestAnimationFrame) return null;
    let audio, source, analyser, animationId = null, active = false, lastPaint = 0, lastAudibleAt = -Infinity, wasAudible=false;
    try {
      audio = new Ctor();
      audio.resume().catch(() => {});
    } catch {
      return null;
    }
    const samples = new Uint8Array(512);
    function animate(now) {
      if (!active) return;
      if (now - lastPaint >= 80 && analyser) {
        lastPaint = now;
        analyser.getByteTimeDomainData(samples);
        let power = 0;
        for (let i = 0; i < samples.length; i++) {
          const v = (samples[i] - 128) / 128;
          power += v * v;
        }
        const rms = canHear()?Math.sqrt(power / samples.length):0;
        if(!canHear())lastAudibleAt=-Infinity;
        if (rms > 0.018) lastAudibleAt = now;
        const audible=now-lastAudibleAt<850;
        if(audible!==wasAudible){wasAudible=audible;onAudibleChange(audible);}
        face.classList.toggle('audible', rms > 0.018);
        face.style.setProperty('--mouth-height', Math.round(Math.min(28, Math.max(5, 5 + rms * 180))) + 'px');
      }
      animationId = window.requestAnimationFrame(animate);
    }
    return {
      attach(stream) {
        if (active || !stream) return;
        try {
          analyser = audio.createAnalyser();
          analyser.fftSize = 512;
          source = audio.createMediaStreamSource(stream);
          source.connect(analyser); // Not connected to speakers; <audio> owns playback.
          active = true;
          animationId = window.requestAnimationFrame(animate);
        } catch {
          active = false;
          face.classList.remove('audible');
        }
      },
      resume() { return audio.resume().catch(() => {}); },
      isAudible() { return active && performance.now() - lastAudibleAt < 850; },
      stop() {
        active = false;
        if (animationId !== null) window.cancelAnimationFrame(animationId);
        face.classList.remove('audible');
        face.style.removeProperty('--mouth-height');
        try { source?.disconnect(); } catch {}
        audio.close().catch(() => {});
      },
    };
  }


  // Local-only volume indicator for troubleshooting quiet voices in Safari.
  // This reads the existing microphone stream; it does not record or send data.
  // Analyser is NOT connected to a speaker (avoid feedback loops).
  function createMicInputMeter(stream, onLevel) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor || typeof onLevel !== 'function' ||
        !stream?.getAudioTracks?.().length || !window.requestAnimationFrame) return null;
    let audio, analyser, source, frame = null, active = false, lastFrame = 0;
    try {
      audio = new Ctor();
      analyser = audio.createAnalyser();
      analyser.fftSize = 512;
      source = audio.createMediaStreamSource(stream);
      source.connect(analyser);
      active = true;
      audio.resume().catch(() => {});
    } catch (error) {
      try { source?.disconnect(); } catch {}
      try { audio?.close().catch(() => {}); } catch {}
      return null;
    }
    const samples = new Uint8Array(analyser.fftSize);
    function update(now) {
      if (!active) return;
      if (now - lastFrame >= 110) {
        lastFrame = now;
        analyser.getByteTimeDomainData(samples);
        let energy = 0;
        for (let i = 0; i < samples.length; i++) {
          const centered = (samples[i] - 128) / 128;
          energy += centered * centered;
        }
        const rms = Math.sqrt(energy / samples.length);
        try { onLevel(Math.round(Math.min(100, rms * 800))); } catch {}
      }
      frame = window.requestAnimationFrame(update);
    }
    frame = window.requestAnimationFrame(update);
    return {
      resume() { return audio.resume().catch(() => {}); },
      stop() {
        if (!active) return;
        active = false;
        if (frame !== null) window.cancelAnimationFrame(frame);
        try { onLevel(0); } catch {}
        try { source?.disconnect(); } catch {}
        audio.close().catch(() => {});
      },
    };
  }

  function speechThreshold(value) {
    return {quiet:0.25, normal:0.5, noisy:0.7}[value] ?? 0.25;
  }


  // Qwen error events may contain prompt excerpts or private input in the
  // free-text message. Display only the documented structured code/type/param.
  function modelErrorDetails(error) {
    const source = error && typeof error === 'object' ? error : {};
    const clean = (input, fallback) => {
      if (typeof input !== 'string') return fallback;
      const safe = input.trim().slice(0, 90).replace(/[^A-Za-z0-9_.:-]/g, '');
      return safe || fallback;
    };
    return Object.freeze({
      code: clean(source.code, 'unknown'),
      type: clean(source.type, 'unknown'),
      param: clean(source.param, ''),
    });
  }

  window.MiniExtras = Object.freeze({
    loadSettings,saveSettings,clearSettings,
    NOTE_LIMIT,
    MAX_SESSION_MINUTES,
    durationMinutes,
    silenceDuration,
    boundedNote,
    buildInstructions,
    loadSavedNote,
    saveNote,
    clearNote,
    createVoiceMeter,
    createMicInputMeter,
    speechThreshold,
    modelErrorDetails,
  });
})();
