// Mini V6: one browser WebRTC session, continuous microphone, optional low-fps video.
// No Alibaba API key is ever sent to this JavaScript. SDP exchange goes through /api/realtime/sdp.
const extras = window.MiniExtras;
const kids = window.MiniKidsContent;
const $ = id => document.getElementById(id);
const els = {
  face: $('robotFace'), status: $('status'), mode: $('modeTag'), info: $('modeInfo'),
  code: $('accessCode'), start: $('startBtn'), stop: $('stopBtn'), extend: $('extendBtn'),
  pace: $('responsePace'), remaining: $('remainingTime'), delay: $('replyDelay'),
  personality: $('personality'), language: $('language'), sensitivity: $('listenSensitivity'),
  note: $('familyNote'), remember: $('rememberPrefs'), clearMemory: $('clearMemoryBtn'), memoryInfo: $('memoryInfo'),
  postTest: $('postTestBtn'), postResult: $('postTestResult'),
  videoToggle: $('sendVideo'), facing: $('facing'), videoMode: $('videoMode'), fps: $('fps'), limit: $('sessionLimit'),
  preview: $('preview'), placeholder: $('cameraPlaceholder'),
  mute: $('muteBtn'), pauseVideo: $('pauseVideoBtn'), clock: $('sessionClock'),
  micBadge: $('micBadge'), videoBadge: $('videoBadge'),
  userText: $('userTranscript'), miniText: $('assistantTranscript'),
  remoteAudio: $('remoteAudio'), playAudio: $('playAudioBtn'),
};
let mode = 'checking';
let current = null;
let loading = false;
let childUI = null;

function setStatus(message, state = 'idle') {
  els.status.className = `status ${state === 'error' ? 'error' : state === 'idle' ? '' : 'connected'}`;
  els.status.textContent = '';
  const dot = document.createElement('span');
  dot.className = 'status-light';
  els.status.append(dot, document.createTextNode(message));
  els.face.className = `face ${state}`;
  childUI?.onStatus({state, online:Boolean(current?.ready && current.mode === 'realtime' && !current.stopped), running:Boolean(current && !current.stopped)});
}
function render() {
  const s = current;
  const running = !!s && !s.stopped;
  const canExtend = running && s.mode === 'realtime' && s.endsAt < s.startedAt + extras.MAX_SESSION_MINUTES * 60000;
  els.extend.classList.toggle('hidden', !canExtend);
  els.extend.disabled = loading || !s?.ready || !canExtend;
  els.start.classList.toggle('hidden', running);
  els.stop.classList.toggle('hidden', !running);
  els.start.disabled = loading || mode === 'checking';
  els.start.textContent = mode === 'preview' ? '● Parent: Test camera & mic' : '● Parent: Start live voice';
  for (const control of [els.code, els.videoToggle, els.facing, els.videoMode, els.fps, els.limit, els.pace, els.sensitivity, els.personality, els.language, els.note, els.remember]) control.disabled = running || loading;
  els.clearMemory.disabled = running || loading;
  els.mute.disabled = !running;
  els.mute.textContent = s?.muted ? 'Unmute microphone' : 'Mute microphone';
  els.pauseVideo.disabled = !running || !s?.wantVideo || s?.mode === 'preview' || !s?.ready;
  els.pauseVideo.textContent = s?.videoPaused ? 'Resume visual sharing' : 'Pause visual sharing';
  els.micBadge.textContent = running ? (s.muted ? 'Microphone muted' : s.mode === 'preview' ? 'Microphone local only' : s.ready ? 'Mic LIVE' : 'Mic preparing') : 'Microphone off';
  els.micBadge.classList.toggle('active', running && s.mode !== 'preview' && !s.muted && s.ready);
  els.videoBadge.textContent = running && s.wantVideo ? (s.mode === 'preview' ? 'Camera local only' : s.videoPaused ? 'Visuals paused' : s.ready ? `Video LIVE · ${s.fps}fps` : 'Camera local') : 'Camera off';
  els.videoBadge.classList.toggle('active', running && s.mode !== 'preview' && s.wantVideo && !s.videoPaused && s.ready);
  els.placeholder.classList.toggle('hidden', !!(running && s.wantVideo && els.preview.srcObject));
}
function maybeUnmuteAudio() {
  els.remoteAudio.muted = false;
  els.remoteAudio.volume = 1;
  current?.audioMeter?.resume();
  els.remoteAudio.play().catch(() => {
    els.playAudio.textContent = '▶ Tap to hear Mini';
  });
}
async function loadConfig() {
  try {
    const response = await fetch('/api/config', {cache:'no-store'});
    if (!response.ok) throw new Error('Cannot connect to your computer server');
    const data = await response.json();
    mode = data.mode;
    els.mode.textContent = mode === 'realtime' ? 'QWEN REALTIME' : 'LOCAL PREVIEW ONLY';
    els.mode.classList.toggle('is-demo', mode !== 'realtime');
    els.info.textContent = mode === 'realtime'
      ? `Ready: ${data.model}. A grown-up starts live voice; camera sharing is optional. Model Studio usage incurs charges.`
      : 'No pay-as-you-go key configured. You can test the iPhone camera and mic locally for free; there will be no AI replies.';
  } catch (e) {
    mode = 'checking';
    els.mode.textContent = 'SERVER OFFLINE';
    els.info.textContent = e.message;
  }
  render();
}


function clockText(seconds) {
  const amount = Math.max(0, Math.floor(seconds));
  return String(Math.floor(amount / 60)).padStart(2, '0') + ':' + String(amount % 60).padStart(2, '0');
}
function updateSessionClock(s) {
  if (s.stopped || current !== s) return;
  els.clock.textContent = clockText((Date.now() - s.startedAt) / 1000);
  const remaining = Math.max(0, Math.ceil((s.endsAt - Date.now()) / 1000));
  els.remaining.textContent = 'Remaining: ' + clockText(remaining);
  els.remaining.classList.toggle('warning', remaining <= 60);
  if (remaining === 0) stopMini('Session automatically stopped to limit costs.');
}
function scheduleSessionStop(s) {
  clearTimeout(s.deadline);
  s.deadline = setTimeout(() => {
    if (!s.stopped && current === s) stopMini('Session automatically stopped to limit costs.');
  }, Math.max(0, s.endsAt - Date.now()));
}
function extendSession() {
  const s = current;
  if (!s || s.stopped || s.mode !== 'realtime' || !s.ready) return;
  const maximum = s.startedAt + extras.MAX_SESSION_MINUTES * 60000;
  if (s.endsAt >= maximum) return;
  if (!window.confirm('Add 5 minutes to this paid Qwen session? Microphone and any enabled camera sharing will continue.')) return;
  s.endsAt = Math.min(maximum, s.endsAt + 5 * 60000);
  scheduleSessionStop(s);
  updateSessionClock(s);
  render();
}
function recordFirstReply(s) {
  if (s.stopped || s.replyMeasured || !Number.isFinite(s.speechEndedAt)) return;
  const elapsed = (performance.now() - s.speechEndedAt) / 1000;
  if (elapsed < 0 || elapsed > 60) return;
  s.replyMeasured = true;
  els.delay.textContent = 'First AI reply: ~' + elapsed.toFixed(1) + 's';
}
function updateMemoryLabel(message) {
  els.memoryInfo.textContent = message;
}
function initPreferences() {
  const previous = extras.loadSavedNote();
  if (previous !== null) {
    els.note.value = previous;
    els.remember.checked = true;
    updateMemoryLabel('A preference note is saved locally in this Safari browser. No transcripts or camera footage are saved.');
  }
  els.note.addEventListener('input', () => {
    if (els.remember.checked) {
      const ok = extras.saveNote(els.note.value);
      updateMemoryLabel(ok ? 'Preference note saved locally on this browser.' : 'Browser storage unavailable; note is only used for the current session.');
    }
  });
  els.remember.addEventListener('change', () => {
    if (els.remember.checked) {
      const ok = extras.saveNote(els.note.value);
      updateMemoryLabel(ok ? 'Remembering this note only in this Safari browser. Clear it at any time.' : 'Browser storage unavailable; note will not be remembered.');
    } else {
      extras.clearNote();
      updateMemoryLabel('Saved preference note removed. Current text remains for this session only.');
    }
  });
  els.clearMemory.addEventListener('click', () => {
    extras.clearNote();
    els.note.value = '';
    els.remember.checked = false;
    updateMemoryLabel('Preference note cleared. No conversation history is stored.');
  });
}

function waitForIce(s) {
  const pc = s.pc;
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => finish(new Error('WebRTC ICE gathering timed out')), 20000);
    function finish(error) {
      clearTimeout(timer);
      pc.removeEventListener('icegatheringstatechange', onState);
      s.abort.signal.removeEventListener('abort', onAbort);
      error ? reject(error) : resolve();
    }
    function onState() { if (pc.iceGatheringState === 'complete') finish(); }
    function onAbort() { finish(new Error('Session stopped')); }
    pc.addEventListener('icegatheringstatechange', onState);
    s.abort.signal.addEventListener('abort', onAbort, {once:true});
    if (s.stopped) onAbort(); else onState();
  });
}

function sendModelEvent(s, event) {
  if (!s.eventChannel || s.eventChannel.readyState !== 'open') throw new Error('AI event channel is not ready');
  s.eventChannel.send(JSON.stringify(event));
}

// One live Qwen session drives every activity. Updating instructions selects a
// game; a single response.create invites the child. Later spoken answers are
// handled by normal WebRTC audio and VAD, not by any fake offline button.
function startActivity(s, value) {
  if (!s || s.stopped || !s.mediaReady || s.mode !== 'realtime') return;
  s.activity = kids.mode(value);
  s.userSpokeDuringMode = false;
  s.activityUpdatePending = true;
  s.activityUpdateEventId = 'event_' + crypto.randomUUID();
  clearTimeout(s.proactiveTimer);
  s.awaitingProactiveResponse = false;
  childUI?.onActivityStart(s.activity);
  try {
    sendModelEvent(s, {
      type:'session.update',
      event_id:s.activityUpdateEventId,
      session:{instructions:kids.instructions(s.baseInstructions,s.activity,s.wantVideo && !s.videoPaused)},
    });
  } catch (error) {
    s.activityUpdatePending = false;
    console.warn('Mini could not set activity:', error.message);
    childUI?.sayFallback(s.activity);
  }
}
function requestActivity(value) {
  const s = current;
  if (!s || s.stopped || s.mode !== 'realtime' || !s.mediaReady ||
      s.eventChannel?.readyState !== 'open') return false;
  const activity = kids.mode(value);
  if (s.responseActive || s.childSpeaking || s.activityUpdatePending || s.awaitingProactiveResponse) {
    s.queuedActivity = activity;
    childUI?.onActivityStart(activity,true);
    return true;
  }
  startActivity(s,activity);
  return true;
}
function promptActivity(s) {
  if (!s || s.stopped || !s.mediaReady || s.activityUpdatePending ||
      s.childSpeaking || s.responseActive || s.userSpokeDuringMode) return;
  s.awaitingProactiveResponse = true;
  s.proactiveEventId = 'event_' + crypto.randomUUID();
  try {
    sendModelEvent(s,{type:'response.create',event_id:s.proactiveEventId});
  } catch (error) {
    s.awaitingProactiveResponse = false;
    childUI?.sayFallback(s.activity);
    return;
  }
  // Some provider versions do not start speaking without a user turn.
  // Fall back to ONE local prompt, while the live mic remains active for the
  // child's answer. Cancel the fallback if a model reply arrives.
  clearTimeout(s.proactiveTimer);
  s.proactiveTimer = setTimeout(()=>{
    if (s.stopped || !s.awaitingProactiveResponse || s.responseActive ||
        s.childSpeaking || s.userSpokeDuringMode) return;
    s.awaitingProactiveResponse = false;
    childUI?.sayFallback(s.activity);
  },6000);
}
function afterResponse(s) {
  s.responseActive = false;
  s.awaitingProactiveResponse = false;
  clearTimeout(s.proactiveTimer);
  if (s.queuedActivity) {
    const activity = s.queuedActivity;
    s.queuedActivity = null;
    startActivity(s,activity);
  } else {
    childUI?.onResponseFinished();
  }
}

function tryInitialize(s) {
  if (s.stopped || s.updateSent || !s.sessionCreated ||
      s.pc?.connectionState !== 'connected' ||
      s.eventChannel?.readyState !== 'open') return;
  s.updateSent = true;
  s.baseInstructions = extras.buildInstructions({personality:s.personality, language:s.language, note:s.note});
  const session = {
    modalities: ['text','audio'],
    instructions: kids.instructions(s.baseInstructions,'chat',s.wantVideo),
    input_audio_format: 'pcm',
    output_audio_format: 'pcm',
    input_audio_transcription: {model:'qwen3-asr-flash-realtime'},
    audio: {output:{voice:'Tina'}},
    // Acoustic VAD is more suitable for short, one-word child responses.
    turn_detection: {type:'server_vad', threshold:s.vadThreshold, silence_duration_ms:s.silenceMs, prefix_padding_ms:500},
  };
  if (s.wantVideo) session.video = {input:{representation_compact:'normal'}};
  try {
    sendModelEvent(s, {event_id:`event_${crypto.randomUUID()}`, type:'session.update', session});
    setStatus('AI connected · finishing setup…', 'thinking');
  } catch (error) {
    stopMini('Could not configure the Qwen realtime session.');
  }
}

function receiveEvent(s, ev, channel) {
  if (s.stopped || !ev || typeof ev !== 'object') return;
  switch (ev.type) {
    case 'session.created':
      s.sessionCreated = true;
      s.eventChannel = channel; // The model may create its own 'txt' DataChannel.
      tryInitialize(s);
      break;
    case 'session.updated':
      if (s.updateSent && !s.ready) {
        s.ready = true;
        startSendingMedia(s).catch(error => {
          console.error(error);
          if (!s.stopped) stopMini('Could not start the live microphone or video.');
        });
      } else if (s.activityUpdatePending && s.mediaReady) {
        s.activityUpdatePending = false;
        if (s.queuedActivity && s.queuedActivity !== s.activity) {
          const next = s.queuedActivity;
          s.queuedActivity = null;
          startActivity(s,next);
        } else if (!s.responseActive && !s.childSpeaking) {
          promptActivity(s);
        }
      }
      break;
    case 'input_audio_buffer.speech_started':
      s.childSpeaking = true;
      s.userSpokeDuringMode = true;
      clearTimeout(s.proactiveTimer);
      s.awaitingProactiveResponse = false;
      childUI?.onVoiceDetected(true);
      els.delay.textContent = 'First AI reply: waiting…';
      els.userText.textContent = 'Listening…';
      setStatus('You are speaking · listening', 'listening');
      break;
    case 'input_audio_buffer.speech_stopped':
      s.childSpeaking = false;
      childUI?.onVoiceDetected(false);
      s.speechEndedAt = performance.now();
      s.replyMeasured = false;
      setStatus('Mini is thinking…', 'thinking');
      break;
    case 'conversation.item.input_audio_transcription.delta':
      els.userText.textContent = `${ev.text || ''}${ev.stash || ''}` || 'Listening…';
      break;
    case 'conversation.item.input_audio_transcription.completed':
      els.userText.textContent = ev.transcript || '—';
      childUI?.onTranscription(ev.transcript);
      break;
    case 'response.created':
      s.responseActive = true;
      s.awaitingProactiveResponse = false;
      clearTimeout(s.proactiveTimer);
      childUI?.onResponseStarted();
      els.miniText.textContent = '';
      setStatus('Mini is responding…', 'speaking');
      break;
    case 'response.audio_transcript.delta':
      recordFirstReply(s);
      els.miniText.textContent += ev.delta || '';
      if (ev.delta) setStatus('Mini is speaking…', 'speaking');
      break;
    case 'response.audio_transcript.done':
      recordFirstReply(s);
      els.miniText.textContent = ev.transcript || els.miniText.textContent || '—';
      break;
    case 'response.text.delta':
      recordFirstReply(s);
      break;
    case 'response.done':
      setStatus('Live · ask Mini another question', 'listening');
      afterResponse(s);
      break;
    case 'error': {
      console.error('Realtime model error code:', ev.error?.code || 'unknown');
      const failedId = ev.error?.event_id || ev.error?.eventId || null;
      if (failedId && failedId === s.proactiveEventId) {
        s.awaitingProactiveResponse = false;
        clearTimeout(s.proactiveTimer);
        childUI?.sayFallback(s.activity);
        break;
      }
      if (failedId && failedId === s.activityUpdateEventId) {
        s.activityUpdatePending = false;
        childUI?.sayFallback(s.activity);
        break;
      }
      stopMini('Model error. Check Model Studio settings and retry.');
      break;
    }
    default:
      break;
  }
}
function bindChannel(s, channel) {
  s.channels.add(channel);
  channel.onopen = () => { if (!s.stopped) tryInitialize(s); };
  channel.onmessage = ({data}) => {
    if (s.stopped) return;
    try { receiveEvent(s, JSON.parse(data), channel); }
    catch (err) { console.warn('Unrecognized realtime event:', err.message); }
  };
  channel.onclose = () => {
    s.channels.delete(channel);
    if (!s.stopped && channel === s.eventChannel) stopMini('AI connection closed.');
  };
}
async function startSendingMedia(s) {
  if (s.stopped || s.mediaStarted || !s.localStream) return;
  s.mediaStarted = true;
  const mic = s.localStream.getAudioTracks()[0];
  if (!mic) throw new Error('No microphone track');
  s.audioInputTrack = mic;
  await s.audioSender.replaceTrack(mic);
  if (s.stopped) return;
  // The model expects audio to begin before video frames.
  if (s.wantVideo && s.videoSender && s.videoOutTrack) {
    await new Promise(resolve => setTimeout(resolve, 250));
    if (!s.stopped && !s.videoPaused) await s.videoSender.replaceTrack(s.videoOutTrack);
  }
  if (s.stopped) return;
  s.mediaReady = true;
  if (s.mode === 'realtime') {
    s.micMeter = extras.createMicInputMeter(s.localStream,level=>childUI?.onMicLevel(level));
    childUI?.onLiveReady();
  }
  setStatus('Mini is live · speak naturally, even one word', 'listening');
  render();
  if (s.mode === 'realtime') requestActivity('chat');
}

function makeVideoTrack(s) {
  if (!s.wantVideo) return;
  const cameraTrack = s.localStream.getVideoTracks()[0];
  if (!cameraTrack) throw new Error('Camera not available');
  if (s.videoMode === 'direct') {
    cameraTrack.applyConstraints?.({frameRate:{ideal:s.fps,max:s.fps}}).catch(() => {});
    s.videoOutTrack = cameraTrack;
    return;
  }
  const dimensions = cameraTrack.getSettings();
  const w = Math.max(160, Math.min(640, dimensions.width || 480));
  const h = Math.max(120, Math.min(480, dimensions.height || 360));
  try {
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d', {alpha:false});
    if (!ctx || typeof canvas.captureStream !== 'function') throw new Error('Canvas video unavailable');
    const stream = canvas.captureStream(s.fps);
    const track = stream.getVideoTracks()[0];
    if (!track) throw new Error('No canvas video track');
    s.canvasStream = stream;
    s.videoOutTrack = track;
    // Keep the <video> preview smooth, but do expensive canvas draws only
    // when a new 1-2 fps AI frame is due. Older iPhones benefit especially.
    let lastFrameAt = -Infinity;
    function pump(now) {
      if (s.stopped) return;
      if (now - lastFrameAt >= 1000 / s.fps &&
          els.preview.videoWidth > 0 && els.preview.videoHeight > 0) {
        try {
          ctx.drawImage(els.preview, 0, 0, canvas.width, canvas.height);
          lastFrameAt = now;
        } catch {}
      }
      s.drawRaf = requestAnimationFrame(pump);
    }
    s.drawRaf = requestAnimationFrame(pump);
  } catch (error) {
    console.warn('Canvas video unavailable; using a low-fps camera track:', error.message);
    // Fallback for older Safari implementations. Local preview may become choppy.
    cameraTrack.applyConstraints?.({frameRate:{ideal:s.fps,max:s.fps}}).catch(() => {});
    s.videoOutTrack = cameraTrack;
  }
}

async function startMini() {
  if (current || loading || mode === 'checking') return;
  childUI?.stopSpeech();
  if (els.code.value.trim().length < 10) {
    setStatus('Enter your private access code (at least 10 characters).', 'error');
    return;
  }
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    setStatus('Open via HTTPS in iPhone Safari to use microphone and camera.', 'error');
    return;
  }
  const s = {
    stopped:false, mode, abort:new AbortController(),
    wantVideo:els.videoToggle.checked, facing:els.facing.value,
    fps:Number(els.fps.value) === 2 ? 2 : 1, videoMode:els.videoMode.value,
    limit:extras.durationMinutes(els.limit.value),
    silenceMs:extras.silenceDuration(els.pace.value),
    vadThreshold:extras.speechThreshold(els.sensitivity.value),
    personality:els.personality.value, language:els.language.value,
    note:extras.boundedNote(els.note.value),
    muted:false, videoPaused:false, channels:new Set(),
    ready:false, updateSent:false, sessionCreated:false, mediaStarted:false, mediaReady:false,
    activity:'chat', activityUpdatePending:false, userSpokeDuringMode:false,
    responseActive:false, childSpeaking:false, awaitingProactiveResponse:false,
    startedAt:Date.now(),
  };
  if (s.mode === 'realtime' && !window.confirm('Grown-up check: Start a paid Qwen voice session for up to ' + s.limit + ' minutes? The microphone and any camera you enable will stream while connected.')) return;
  s.endsAt = s.startedAt + s.limit * 60000;
  if (s.mode === 'realtime') s.audioMeter = extras.createVoiceMeter(els.face);
  current = s;
  loading = true;
  render();
  setStatus('Requesting microphone and camera permission…', 'thinking');
  try {
    s.localStream = await navigator.mediaDevices.getUserMedia({
      audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},
      video:s.wantVideo ? {facingMode:{ideal:s.facing},width:{ideal:640},height:{ideal:480},frameRate:{ideal:24,max:30}} : false,
    });
    if (s.stopped) {s.localStream.getTracks().forEach(t => t.stop()); return;}
    s.audioInputTrack = s.localStream.getAudioTracks()[0];
    if (s.wantVideo) {
      els.preview.srcObject = s.localStream;
      els.preview.classList.toggle('rear', s.facing === 'environment');
      await els.preview.play().catch(() => {});
    }
    if (s.stopped) return;
    s.timer = setInterval(() => updateSessionClock(s), 500);
    scheduleSessionStop(s);
    updateSessionClock(s);

    if (s.mode === 'preview') {
      s.ready = true;
      setStatus('Local preview: camera and microphone ready · NO AI connection', 'idle');
      els.miniText.textContent = 'Add a Model Studio pay-as-you-go key and Workspace ID to enable continuous AI conversations.';
      return;
    }
    makeVideoTrack(s);
    s.pc = new RTCPeerConnection({iceServers:[]});
    s.pc.onconnectionstatechange = () => {
      if (s.stopped) return;
      if (s.pc.connectionState === 'connected') {
        clearTimeout(s.disconnectedTimer);
        if (s.ready) setStatus('Mini is live again · listening', 'listening');
        tryInitialize(s);
      } else if (s.pc.connectionState === 'disconnected') {
        setStatus('Network interruption · trying to recover…', 'thinking');
        clearTimeout(s.disconnectedTimer);
        s.disconnectedTimer = setTimeout(() => {
          if (!s.stopped && s.pc.connectionState === 'disconnected') stopMini('WebRTC disconnected for more than 10 seconds. Tap Start to reconnect manually.');
        }, 10000);
      } else if (['failed','closed'].includes(s.pc.connectionState)) {
        stopMini('WebRTC connection ended.');
      }
    };
    s.pc.ontrack = ({track, streams}) => {
      if (s.stopped || track.kind !== 'audio') return;
      if (streams?.[0]) els.remoteAudio.srcObject = streams[0];
      else {
        s.remoteStream ||= new MediaStream();
        s.remoteStream.addTrack(track);
        els.remoteAudio.srcObject = s.remoteStream;
      }
      s.audioMeter?.attach(els.remoteAudio.srcObject);
      maybeUnmuteAudio();
    };
    s.pc.ondatachannel = ({channel}) => bindChannel(s, channel);
    // Negotiate directions, but do not attach media until Qwen confirms session.updated.
    s.audioSender = s.pc.addTransceiver('audio',{direction:'sendrecv'}).sender;
    if (s.wantVideo) s.videoSender = s.pc.addTransceiver('video',{direction:'sendonly'}).sender;
    bindChannel(s, s.pc.createDataChannel('oai-events'));
    setStatus('Connecting to Qwen Omni Realtime…', 'thinking');
    await s.pc.setLocalDescription(await s.pc.createOffer());
    await waitForIce(s);
    if (s.stopped) return;
    const response = await fetch('/api/realtime/sdp', {
      method:'POST',
      headers:{'Content-Type':'application/sdp','X-Robot-Access-Code':els.code.value.trim()},
      body:s.pc.localDescription.sdp,
      signal:s.abort.signal,
      cache:'no-store',
    });
    if (!response.ok) {
      // Our own backend returns JSON errors. A non-JSON 401 generally means an
      // authentication gateway (e.g. a protected Cloudflare Tunnel) rejected the
      // request before it reached the Mini server.
      const msg = await response.json().catch(() => null);
      const serverMessage = typeof msg?.error === 'string' ? msg.error : null;
      const fallback = response.status === 401
        ? 'Authentication failed (HTTP 401) before Mini received a readable server response. Check your HTTPS tunnel login (ngrok password or Cloudflare email PIN), refresh Safari and retry. Test localhost on Windows to isolate the gateway.'
        : `SDP connection failed: HTTP ${response.status}`;
      throw new Error(serverMessage || fallback);
    }
    const raw = await response.text();
    // Do not leave the private robot code in the page once authorization succeeds.
    els.code.value = '';
    const answer = raw.trim().replace(/\r?\n/g,'\r\n') + '\r\n';
    if (s.stopped) return;
    await s.pc.setRemoteDescription({type:'answer',sdp:answer});
    setStatus('Waiting for the AI session to initialize…', 'thinking');
  } catch (error) {
    if (!s.stopped) stopMini(error.message || 'Cannot start the session.');
  } finally {
    loading = false;
    render();
  }
}

function stopMini(reason = 'Mini stopped · camera and microphone off') {
  const s = current;
  if (!s) return;
  childUI?.stopSpeech();
  s.stopped = true;
  s.abort.abort();
  clearInterval(s.timer);
  clearTimeout(s.deadline);
  clearTimeout(s.disconnectedTimer);
  clearTimeout(s.proactiveTimer);
  s.audioMeter?.stop();
  s.micMeter?.stop();
  if (s.drawRaf) cancelAnimationFrame(s.drawRaf);
  for (const channel of s.channels) { try {channel.close();} catch {} }
  try {s.pc?.close();} catch {}
  s.canvasStream?.getTracks().forEach(track => track.stop());
  s.localStream?.getTracks().forEach(track => track.stop());
  s.remoteStream?.getTracks().forEach(track => track.stop());
  els.preview.pause();
  els.preview.srcObject = null;
  els.remoteAudio.pause();
  els.remoteAudio.srcObject = null;
  els.userText.textContent = '—';
  current = null;
  els.remaining.textContent = 'Remaining: --:--';
  els.remaining.classList.remove('warning');
  setStatus(reason, reason.includes('failed') || reason.includes('error') || reason.includes('Cannot') ? 'error' : 'idle');
  render();
}

function toggleMute() {
  const s = current;
  if (!s) return;
  s.muted = !s.muted;
  if (s.audioInputTrack) s.audioInputTrack.enabled = !s.muted;
  setStatus(s.muted ? 'Microphone muted · Mini cannot hear you' : 'Microphone live · listening', s.muted ? 'idle' : 'listening');
  render();
}
async function toggleVideo() {
  const s = current;
  if (!s || !s.wantVideo || (s.mode !== 'preview' && !s.ready)) return;
  s.videoPaused = !s.videoPaused;
  if (s.mode !== 'preview') {
    try { await s.videoSender.replaceTrack(s.videoPaused ? null : s.videoOutTrack); }
    catch (err) {stopMini('Could not change video sharing.');return;}
  }
  setStatus(s.videoPaused ? 'Visual sharing paused · camera preview remains local' : 'Visual sharing resumed', 'listening');
  render();
}

// This diagnostic never contacts Alibaba. It uses the same POST method and
// application/sdp content type as the live session, so a gateway-level 401 is
// easier to distinguish from Mini's own access-code validation.
async function testPostConnection() {
  els.postTest.disabled = true;
  els.postResult.textContent = 'Testing HTTPS POST to Mini...';
  try {
    const response = await fetch('/api/diagnostics/post', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {'Content-Type': 'application/sdp'},
      body: 'v=0\r\n',
      cache: 'no-store',
    });
    if (response.status === 401) {
      els.postResult.textContent = 'POST blocked: HTTP 401. No Mini code or AI is involved: your HTTPS gateway rejected the test. Check your ngrok password session or other tunnel authentication.';
      return;
    }
    const contentType = response.headers.get('content-type') || '';
    if (response.ok && contentType.includes('application/json')) {
      const data = await response.json();
      if (data.ok === true && data.origin === 'mini') {
        els.postResult.textContent = 'POST reached Mini successfully. Repeat after 10 seconds to confirm that your HTTPS gateway remains authenticated.';
        return;
      }
    }
    els.postResult.textContent = `Unexpected HTTP ${response.status} response. An authentication page or proxy may be intercepting this request.`;
  } catch (error) {
    els.postResult.textContent = `POST test failed: ${error.message || 'Network error'}`;
  } finally {
    els.postTest.disabled = false;
  }
}

els.postTest.addEventListener('click', testPostConnection);
els.start.addEventListener('click', startMini);
els.extend.addEventListener('click', extendSession);
els.stop.addEventListener('click', () => stopMini());
els.mute.addEventListener('click', toggleMute);
els.pauseVideo.addEventListener('click', toggleVideo);
els.playAudio.addEventListener('click', maybeUnmuteAudio);
window.addEventListener('pagehide', () => {
  childUI?.stopSpeech();
  stopMini('Page closed · stopped');
});
document.addEventListener('visibilitychange', () => {
  // Stop *both* paid AI and local story narration when Safari is hidden.
  if (document.hidden) {
    childUI?.stopSpeech();
    if (current) stopMini('Safari hidden · live session stopped for privacy');
  }
});
initPreferences();
childUI = window.MiniChildUI?.init({
  getSession: () => current,
  getLanguage: () => els.language.value,
  stopSession: reason => stopMini(reason),
  requestActivity,
});
els.language.addEventListener('change', () => childUI?.syncLanguage());
loadConfig();
render();
childUI?.onStatus({state:'idle',online:false,running:false});
