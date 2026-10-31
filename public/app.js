// Mini V3: one browser WebRTC session, continuous microphone, optional low-fps video.
// No Alibaba API key is ever sent to this JavaScript. SDP exchange goes through /api/realtime/sdp.
const $ = id => document.getElementById(id);
const els = {
  face: $('robotFace'), status: $('status'), mode: $('modeTag'), info: $('modeInfo'),
  code: $('accessCode'), start: $('startBtn'), stop: $('stopBtn'),
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

function setStatus(message, state = 'idle') {
  els.status.className = `status ${state === 'error' ? 'error' : state === 'idle' ? '' : 'connected'}`;
  els.status.textContent = '';
  const dot = document.createElement('span');
  dot.className = 'status-light';
  els.status.append(dot, document.createTextNode(message));
  els.face.className = `face ${state}`;
}
function render() {
  const s = current;
  const running = !!s && !s.stopped;
  els.start.classList.toggle('hidden', running);
  els.stop.classList.toggle('hidden', !running);
  els.start.disabled = loading || mode === 'checking';
  els.start.textContent = mode === 'preview' ? '● Test local camera and mic' : '● Start live Mini';
  for (const control of [els.code, els.videoToggle, els.facing, els.videoMode, els.fps, els.limit]) control.disabled = running || loading;
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
      ? `Ready: ${data.model}. Mic and video will be sent to Model Studio when you press Start. Usage incurs API charges.`
      : 'No pay-as-you-go key configured. You can test the iPhone camera and mic locally for free; there will be no AI replies.';
  } catch (e) {
    mode = 'checking';
    els.mode.textContent = 'SERVER OFFLINE';
    els.info.textContent = e.message;
  }
  render();
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
function tryInitialize(s) {
  if (s.stopped || s.updateSent || !s.sessionCreated ||
      s.pc?.connectionState !== 'connected' ||
      s.eventChannel?.readyState !== 'open') return;
  s.updateSent = true;
  const session = {
    modalities: ['text','audio'],
    instructions: [
      'You are Mini, a friendly, playful iPhone-powered family robot.',
      'Use a natural spoken voice, with short sentences appropriate for conversation.',
      'Reply in English or Mandarin to match the person speaking.',
      'Use the live camera only to describe things you can actually see; acknowledge uncertainty.',
      'Speak only when someone clearly addresses you or asks a question; ignore unrelated television and background chatter as much as possible.',
      'You are a stationary robot without arms. Never say you moved or touched something.',
      'Avoid asking children for names, addresses, school or other private information.',
      'Do not read violent or inappropriate content to children.',
    ].join(' '),
    input_audio_format: 'pcm',
    output_audio_format: 'pcm',
    input_audio_transcription: {model:'qwen3-asr-flash-realtime'},
    audio: {output:{voice:'Tina'}},
    turn_detection: {type:'semantic_vad', threshold:0.5, silence_duration_ms:800, prefix_padding_ms:500},
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
      }
      break;
    case 'input_audio_buffer.speech_started':
      els.userText.textContent = 'Listening…';
      setStatus('You are speaking · listening', 'listening');
      break;
    case 'input_audio_buffer.speech_stopped':
      setStatus('Mini is thinking…', 'thinking');
      break;
    case 'conversation.item.input_audio_transcription.delta':
      els.userText.textContent = `${ev.text || ''}${ev.stash || ''}` || 'Listening…';
      break;
    case 'conversation.item.input_audio_transcription.completed':
      els.userText.textContent = ev.transcript || '—';
      break;
    case 'response.created':
      els.miniText.textContent = '';
      setStatus('Mini is responding…', 'speaking');
      break;
    case 'response.audio_transcript.delta':
      els.miniText.textContent += ev.delta || '';
      break;
    case 'response.audio_transcript.done':
      els.miniText.textContent = ev.transcript || els.miniText.textContent || '—';
      break;
    case 'response.done':
      setStatus('Live · ask Mini another question', 'listening');
      break;
    case 'error':
      console.error('Realtime model error code:', ev.error?.code || 'unknown');
      stopMini('Model error. Check the Model Studio console and retry.');
      break;
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
  setStatus('Mini is live · speak or show an object', 'listening');
  render();
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
    function pump() {
      if (s.stopped) return;
      if (els.preview.videoWidth > 0 && els.preview.videoHeight > 0) {
        try { ctx.drawImage(els.preview, 0, 0, canvas.width, canvas.height); } catch {}
      }
      s.drawRaf = requestAnimationFrame(pump);
    }
    pump();
  } catch (error) {
    console.warn('Canvas video unavailable; using a low-fps camera track:', error.message);
    // Fallback for older Safari implementations. Local preview may become choppy.
    cameraTrack.applyConstraints?.({frameRate:{ideal:s.fps,max:s.fps}}).catch(() => {});
    s.videoOutTrack = cameraTrack;
  }
}

async function startMini() {
  if (current || loading || mode === 'checking') return;
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
    limit:Number(els.limit.value) || 5,
    muted:false, videoPaused:false, channels:new Set(),
    ready:false, updateSent:false, sessionCreated:false, mediaStarted:false,
    startedAt:Date.now(),
  };
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
    s.timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - s.startedAt) / 1000);
      els.clock.textContent = `${String(Math.floor(elapsed/60)).padStart(2,'0')}:${String(elapsed%60).padStart(2,'0')}`;
    }, 500);
    s.deadline = setTimeout(() => { if (!s.stopped) stopMini('Session automatically stopped to limit costs.'); }, s.limit*60_000);

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
      if (s.pc.connectionState === 'connected') tryInitialize(s);
      else if (['failed','closed','disconnected'].includes(s.pc.connectionState)) stopMini('WebRTC connection ended.');
    };
    s.pc.ontrack = ({track, streams}) => {
      if (s.stopped || track.kind !== 'audio') return;
      if (streams?.[0]) els.remoteAudio.srcObject = streams[0];
      else {
        s.remoteStream ||= new MediaStream();
        s.remoteStream.addTrack(track);
        els.remoteAudio.srcObject = s.remoteStream;
      }
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
      const msg = await response.json().catch(() => ({error:`SDP connection failed: HTTP ${response.status}`}));
      throw new Error(msg.error || 'Model Studio session failed');
    }
    const raw = await response.text();
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
  s.stopped = true;
  s.abort.abort();
  clearInterval(s.timer);
  clearTimeout(s.deadline);
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

els.start.addEventListener('click', startMini);
els.stop.addEventListener('click', () => stopMini());
els.mute.addEventListener('click', toggleMute);
els.pauseVideo.addEventListener('click', toggleVideo);
els.playAudio.addEventListener('click', maybeUnmuteAudio);
window.addEventListener('pagehide', () => stopMini('Page closed · stopped'));
document.addEventListener('visibilitychange', () => {
  // Avoid unintentional audio/video billing when the iPhone changes apps or locks.
  if (document.hidden && current) stopMini('Safari hidden · live session stopped for privacy');
});
loadConfig();
render();
