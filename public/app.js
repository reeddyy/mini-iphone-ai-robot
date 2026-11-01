// Mini V6: one browser WebRTC session, continuous microphone, optional low-fps video.
// No Alibaba API key is ever sent to this JavaScript. SDP exchange goes through /api/realtime/sdp.
const extras = window.MiniExtras;
const kids = window.MiniKidsContent;
const activities = window.MiniActivities;
const $ = id => document.getElementById(id);
const els = {
  face: $('robotFace'), status: $('status'), mode: $('modeTag'), info: $('modeInfo'),
  code: $('accessCode'), start: $('startBtn'), stop: $('stopBtn'), extend: $('extendBtn'),
  pace: $('responsePace'), remaining: $('remainingTime'), delay: $('replyDelay'), keepTalk: $('keepConversationGoing'),
  personality: $('personality'), language: $('language'), sensitivity: $('listenSensitivity'),
  note: $('familyNote'), remember: $('rememberPrefs'), clearMemory: $('clearMemoryBtn'), memoryInfo: $('memoryInfo'),
  postTest: $('postTestBtn'), postResult: $('postTestResult'),
  videoToggle: $('sendVideo'), facing: $('facing'), videoMode: $('videoMode'), fps: $('fps'), limit: $('sessionLimit'),
  preview: $('preview'), placeholder: $('cameraPlaceholder'),
  mute: $('muteBtn'), pauseVideo: $('pauseVideoBtn'), clock: $('sessionClock'),
  micBadge: $('micBadge'), videoBadge: $('videoBadge'),
  userText: $('userTranscript'), miniText: $('assistantTranscript'),
  remoteAudio: $('remoteAudio'), playAudio: $('playAudioBtn'), diagnostic: $('modelDiagnostic'),
  kidAudio: $('kidAudioBtn'),
  sharing: $('sharingNotice'), progress: $('activityProgress'),
  favoriteTopic: $('favoriteTopic'), reactionSounds: $('reactionSounds'), rememberSettings: $('rememberSettings'),
  visualToggle:$('visualResponses'),pictures:$('generatedPictures'),visualStatus:$('visualRequestStatus'),visualInfo:$('visualCapabilityInfo'),
  picturesInfo:$('generatedPicturesInfo'),
  awarenessToggle:$('visualAwareness'),spokenGreetings:$('spokenGreetings'),awarenessStatus:$('awarenessStatus'),awarenessPause:$('pauseAwarenessBtn'),
  forgetSettings: $('forgetSettingsBtn'), settingsInfo: $('settingsInfo'),
  extendDialog: $('extendDialog'), extendForm: $('extendForm'), extensionCode: $('extensionCode'),
  extensionMessage: $('extensionMessage'), extensionApprove: $('extensionApprove'), extensionCancel: $('extensionCancel'),
};
let mode = 'checking';
let current = null;
let loading = false;
let childUI = null;
let visualActivity = null;
let generatedVisuals = null;
let visualCapabilities={available:false,imagesAvailable:false};
let awarenessAvailable=false;
let extensionRequest = null;
let openingRound = Math.floor(Math.random() * 1000);

function setStatus(message, state = 'idle') {
  els.status.className = `status ${state === 'error' ? 'error' : state === 'idle' ? '' : 'connected'}`;
  els.status.textContent = '';
  const dot = document.createElement('span');
  dot.className = 'status-light';
  els.status.append(dot, document.createTextNode(message));
  els.face.className = `face ${state}${current?.playbackActive && !current?.playbackSuppressed ? ' audible' : ''}`;
  childUI?.onStatus({state, online:Boolean(current?.ready && current.mode === 'realtime' && !current.stopped), running:Boolean(current && !current.stopped)});
}
function render() {
  const s = current;
  const running = !!s && !s.stopped;
  document.querySelector('.shell').dataset.voiceRunning=running && s.mode==='realtime'?'true':'false';
  const canExtend = running && s.mode === 'realtime' && s.endsAt < s.startedAt + extras.MAX_SESSION_MINUTES * 60000;
  els.extend.classList.toggle('hidden', !canExtend);
  els.extend.disabled = loading || !s?.ready || !canExtend;
  els.start.classList.toggle('hidden', running);
  els.stop.classList.toggle('hidden', !running);
  els.start.disabled = loading || mode === 'checking';
  els.start.textContent = mode === 'preview' ? '● Parent: Test camera & mic' : '● Parent: Start live voice';
  for (const control of [els.code, els.videoToggle, els.facing, els.videoMode, els.fps, els.limit, els.pace, els.sensitivity, els.keepTalk, els.personality, els.language, els.note, els.remember]) control.disabled = running || loading;
  els.clearMemory.disabled = running || loading;
  for(const control of [els.favoriteTopic,els.reactionSounds,els.rememberSettings,els.forgetSettings])control.disabled=running || loading;
  els.visualToggle.disabled=running || loading || !visualCapabilities.available;
  els.pictures.disabled=running || loading || mode!=='realtime' || !visualCapabilities.imagesAvailable || !els.visualToggle.checked;
  const pictureReason=running || loading
    ? 'Stop Mini before changing picture permission, then choose it before starting a new session.'
    : mode==='checking'
    ? 'Waiting for server configuration. Check that the Windows Mini server is running, then refresh this page.'
    : mode!=='realtime'
    ? 'Generated pictures need live AI. Configure the Alibaba key and Singapore workspace on your Windows server first.'
    : !visualCapabilities.imagesAvailable
    ? 'Picture generation is not configured on the Windows server. Set ALIBABA_IMAGE_MODEL in its private .env, restart Mini and refresh this page. See picture setup below.'
    : !els.visualToggle.checked
    ? 'Turn on “Let Qwen create visual scenes” above to enable generated pictures.'
    : 'Picture generation is configured. You can tick this before starting a session; pictures add separate charges. Model access still depends on your Alibaba account.';
  els.picturesInfo.textContent=pictureReason;els.pictures.title=pictureReason;
  els.awarenessToggle.disabled=running || loading || !awarenessAvailable || !els.videoToggle.checked;
  els.spokenGreetings.disabled=running || loading || !els.awarenessToggle.checked || !els.videoToggle.checked || !awarenessAvailable;
  els.awarenessPause.classList.toggle('hidden',!s?.awareness);
  els.awarenessPause.textContent=s?.awareness?.isPaused()?'Resume visual awareness':'Pause visual awareness';
  els.mute.disabled = !running;
  els.mute.textContent = s?.muted ? 'Unmute microphone' : 'Mute microphone';
  els.pauseVideo.disabled = !running || !s?.wantVideo || s?.mode === 'preview' || !s?.ready;
  els.pauseVideo.textContent = s?.videoPaused ? 'Resume visual sharing' : 'Pause visual sharing';
  els.micBadge.textContent = running ? (s.muted ? 'Microphone muted' : s.mode === 'preview' ? 'Microphone local only' : s.ready ? 'Mic LIVE' : 'Mic preparing') : 'Microphone off';
  els.micBadge.classList.toggle('active', running && s.mode !== 'preview' && !s.muted && s.ready);
  els.videoBadge.textContent = running && s.wantVideo ? (s.mode === 'preview' ? 'Camera local only' : s.videoPaused ? 'Visuals paused' : s.ready ? `Video LIVE · ${s.fps}fps` : 'Camera local') : 'Camera off';
  els.videoBadge.classList.toggle('active', running && s.mode !== 'preview' && s.wantVideo && !s.videoPaused && s.ready);
  els.placeholder.classList.toggle('hidden', !!(running && s.wantVideo && els.preview.srcObject));
  $('boardPlayBtn').classList.toggle('hidden',running || Boolean(visualActivity?.isActive()));
  els.sharing.classList.toggle('hidden',!running);
  if(running) {
    const zh=s.language==='zh';
    const mic=s.audioInputTrack?.enabled && !s.muted;
    const camera=s.wantVideo && !s.videoPaused;
    els.sharing.textContent=s.mode==='preview'
      ? (zh?'仅本地预览 · ':'Local preview · ')+(mic?(zh?'麦克风开启':'Mic on'):(zh?'麦克风静音':'Mic muted'))+' · '+(camera?(zh?'摄像头仅本地':'Camera local only'):(zh?'摄像头关闭':'Camera off'))
      : (mic && s.mediaReady?(zh?'麦克风实时传送':'Mic live'):(zh?'麦克风未传送':'Mic not sending'))+' · '+(camera && s.mediaReady?(zh?'摄像头实时传送':'Camera live'):(zh?'摄像头未传送':'Camera not sending'));
  }
}
async function maybeUnmuteAudio() {
  const s = current;
  if (!s || s.stopped) return;
  els.remoteAudio.muted = Boolean(s.playbackSuppressed);
  els.remoteAudio.volume = 1;
  current?.audioMeter?.resume();
  current?.micMeter?.resume();
  try {
    await els.remoteAudio.play();
    if (current === s && !s.stopped) els.kidAudio.classList.add('hidden');
  } catch {
    if (current !== s || s.stopped) return;
    const label = s.language === 'zh' ? '▶ 点这里听 Mini 说话' : '▶ Tap to hear Mini';
    els.playAudio.textContent = label;
    els.kidAudio.textContent = label;
    els.kidAudio.classList.remove('hidden');
  }
}
async function loadConfig() {
  try {
    const response = await fetch('/api/config', {cache:'no-store'});
    if (!response.ok) throw new Error('Cannot connect to your computer server');
    const data = await response.json();
    visualCapabilities=data.visuals || {available:data.mode==='realtime',imagesAvailable:false};
    awarenessAvailable=Boolean(data.awareness?.available);
    els.visualInfo.textContent=visualCapabilities.imagesAvailable
      ? 'Visual scenes use extra paid Qwen requests. Pictures are separate paid calls. Limits: 60 plans and 4 pictures per session.'
      : 'Visual scenes use extra paid Qwen requests. Newly generated artwork is not configured; Mini can still compose drawings with shapes, text and emoji.';
    mode = data.mode;
    els.mode.textContent = mode === 'realtime' ? 'QWEN REALTIME' : 'LOCAL PREVIEW ONLY';
    els.mode.classList.toggle('is-demo', mode !== 'realtime');
    els.info.textContent = mode === 'realtime'
      ? 'Voice chat is ready. Paid usage begins after parent confirmation. Camera sharing is optional.'
      : 'Live AI is not configured yet. You can test the microphone and camera locally for free.';
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
  childUI?.onTimeRemaining?.(remaining);
  if (remaining === 0) stopMini('Session automatically stopped to limit costs.', {gentle:true});
}
function scheduleSessionStop(s) {
  clearTimeout(s.deadline);
  s.deadline = setTimeout(() => {
    if (!s.stopped && current === s) stopMini('Session automatically stopped to limit costs.', {gentle:true});
  }, Math.max(0, s.endsAt - Date.now()));
}
function extendSession() {
  const s = current;
  if (!s || s.stopped || s.mode !== 'realtime' || !s.ready) return;
  const maximum = s.startedAt + extras.MAX_SESSION_MINUTES * 60000;
  if (s.endsAt >= maximum) return;
  cancelExtension();
  extensionRequest = {session:s, abort:new AbortController()};
  els.extensionMessage.textContent = '';
  els.extensionApprove.disabled = false;
  els.extendDialog.showModal();
}
function cancelExtension() {
  extensionRequest?.abort.abort();
  extensionRequest = null;
  els.extensionCode.value = '';
  if (els.extendDialog.open) els.extendDialog.close();
}
async function authorizeExtension(event) {
  event.preventDefault();
  const request = extensionRequest;
  if (!request || els.extensionApprove.disabled) return;
  const s = request.session;
  const code = els.extensionCode.value.trim();
  els.extensionCode.value = '';
  if (code.length < 10) {
    els.extensionMessage.textContent = 'Enter the private parent code (at least 10 characters).';
    return;
  }
  els.extensionApprove.disabled = true;
  els.extensionMessage.textContent = 'Checking parent code…';
  try {
    const response = await fetch('/api/parent/authorize', {
      method:'POST', headers:{'X-Robot-Access-Code':code},
      signal:request.abort.signal, cache:'no-store',
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || result?.ok !== true) throw new Error(result?.error || 'Could not verify the parent code. Try again.');
    if (extensionRequest !== request || current !== s || s.stopped) return;
    if (s.endsAt <= Date.now()) {
      cancelExtension();
      updateSessionClock(s);
      return;
    }
    s.endsAt = Math.min(s.startedAt + extras.MAX_SESSION_MINUTES * 60000, s.endsAt + 5 * 60000);
    cancelExtension();
    scheduleSessionStop(s);
    updateSessionClock(s);
    render();
  } catch (error) {
    if (extensionRequest === request) els.extensionMessage.textContent = error.message || 'Parent authorization failed.';
  } finally {
    if (extensionRequest === request) els.extensionApprove.disabled = false;
  }
}
function recordFirstReply(s) {
  if (s.stopped || s.replyMeasured || !Number.isFinite(s.speechEndedAt)) return;
  const elapsed = (performance.now() - s.speechEndedAt) / 1000;
  if (elapsed < 0 || elapsed > 60) return;
  s.replyMeasured = true;
  els.delay.textContent = 'First audible reply: ~' + elapsed.toFixed(1) + 's';
}
function onRemoteAudio(s,audible) {
  if(s.stopped || current!==s || s.playbackSuppressed || s.childSpeaking)return;
  s.playbackActive=audible;
  if(audible) {
    interruptAwareness(s);
    s.hadAudibleReply=true;
    els.kidAudio.classList.add('hidden');
    recordFirstReply(s);
    setStatus('Mini is speaking…','speaking');
    if(s.pendingReaction && !s.reactionPlayed){childUI?.reactToMiniSpeech?.(s.pendingReaction);s.reactionPlayed=true;}
  } else if(s.responseGenerationDone)finishPlayback(s);
}
function finishPlayback(s) {
  clearTimeout(s.playbackTimer);
  if(s.stopped || current!==s || s.childSpeaking || !s.responseGenerationDone)return;
  if(s.playbackActive || s.audioMeter?.isAudible?.()) {
    s.playbackTimer=setTimeout(()=>finishPlayback(s),120);
    return;
  }
  if(!s.hadAudibleReply) {
    setStatus('Reply ready · tap below if you could not hear Mini','idle');
    els.kidAudio.textContent=s.language==='zh'?'▶ 点这里听 Mini 说话':'▶ Tap to hear Mini';
    els.kidAudio.classList.remove('hidden');
    return;
  }
  setStatus(s.muted?'Microphone muted · Mini cannot hear you':'Your turn · Mini is listening',s.muted?'idle':'listening');
  s.awarenessLastActivity=Date.now();
  childUI?.onResponseFinished();
}
function renderActivity(s) {
  const text=activities.summary(s.activityState,s.language);
  els.progress.textContent=text;
  els.progress.classList.toggle('hidden',!text || Boolean(visualActivity?.isActive()) || Boolean(generatedVisuals?.isActive()));
}
function interruptAwareness(s) {
  if(!s)return;
  s.awarenessLastActivity=Date.now();s.awareness?.interrupt();
}
function awarenessCanRun(s) {
  return current===s && !s.stopped && s.mode==='realtime' && s.ready && s.mediaReady && s.awarenessEnabled && s.visualGrant &&
    s.wantVideo && !s.videoPaused && s.videoOutTrack?.readyState==='live' && !['failed','closed','disconnected'].includes(s.pc?.connectionState) && !s.muted && s.audioInputTrack?.enabled && !document.hidden &&
    !s.childSpeaking && !s.turnPending && !s.responseActive && !s.playbackActive && !s.audioMeter?.isAudible?.() &&
    !s.contextUpdatePending && !s.activityUpdatePending && !childUI?.isNarrating?.() &&
    !visualActivity?.isActive() && !generatedVisuals?.isActive() && !s.visualPlanning;
}
function startAwareness(s) {
  if(!s.awarenessEnabled || !s.visualGrant || s.awareness || !window.MiniAwareness)return;
  try {
    s.awarenessLastActivity=Date.now();
    s.awareness=window.MiniAwareness.start({video:els.preview,spoken:s.spokenGreetings,
      allowed:()=>awarenessCanRun(s) && Date.now()-Math.max(s.awarenessLastActivity || s.startedAt,s.awarenessLastNoise || 0)>=6000 && s.endsAt-Date.now()>60000,
      // Leave Authorization to the browser's tunnel login; Mini has its own grant header.
      observe:async(frames,signal)=>{
        const response=await fetch('/api/visual/observe',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-Mini-Visual-Session':s.visualGrant},body:JSON.stringify({frames}),signal});
        if(!response.ok)throw new Error('Visual check unavailable');
        return (await response.json()).observation;
      },
      onCue:reaction=>{if(awarenessCanRun(s)){childUI?.reactToVisualCue?.(reaction);s.awarenessLastActivity=Date.now();}},
      onStatus:state=>{if(current!==s || s.stopped)return;els.awarenessStatus.textContent=state.message+' Checks: '+state.checks+'/40.';render();},
    });
  } catch {els.awarenessStatus.textContent='Visual awareness unavailable on this browser. Voice chat can continue.';}
}
function cancelGeneratedRequest(s) {
  if(s){s.visualRequestVersion=(s.visualRequestVersion || 0)+1;s.visualAbort?.abort();s.visualPlanning=false;}
  generatedVisuals?.cancelPending();generatedVisuals?.setBusy(false);
  els.visualStatus.classList.add('hidden');
}
async function requestGeneratedVisual(s,request,fromChoice=false) {
  if(s.stopped || current!==s || s.mode!=='realtime' || !s.visualsEnabled || !s.visualGrant)return;
  cancelGeneratedRequest(s);
  interruptAwareness(s);
  const version=s.visualRequestVersion;
  const controller=new AbortController();s.visualAbort=controller;
  s.visualPlanning=true;
  generatedVisuals?.setBusy(true);
  els.visualStatus.textContent=s.language==='zh'?'Mini 正在想怎么画……':'Mini is imagining what to show…';els.visualStatus.classList.remove('hidden');
  try {
    const response=await fetch('/api/visual/plan',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-Mini-Visual-Session':s.visualGrant},
      body:JSON.stringify({request:request.slice(0,500),scene:generatedVisuals?.current() || (visualActivity?.isActive()?{version:1,action:'activity',title:'Tic-tac-toe',activity:{type:'tictactoe'}}:null),language:s.language}),signal:controller.signal});
    const data=await response.json();
    if(!response.ok)throw new Error(data.error || 'Visual response unavailable. Voice chat can continue.');
    const plan=window.MiniVisualSchema.validate(data.plan);
    if(s.stopped || current!==s || version!==s.visualRequestVersion || controller.signal.aborted)return;
    await generatedVisuals.apply(plan,{imageTicket:data.imageTicket,allowChoiceContinuation:!fromChoice});
  } catch(error) {
    if(!s.stopped && current===s && version===s.visualRequestVersion && !controller.signal.aborted) {
      els.visualStatus.textContent=error.message || 'Mini could not show that yet. Voice chat can continue.';
      return;
    }
  } finally {
    if(current===s && version===s.visualRequestVersion){s.visualPlanning=false;generatedVisuals?.setBusy(false);if(!controller.signal.aborted && els.visualStatus.textContent.includes('…'))els.visualStatus.classList.add('hidden');}
  }
}
async function requestGeneratedArtwork(ticket,signal) {
  const s=current;
  if(!s || s.stopped || !s.visualGrant || !s.imagesAllowed || !ticket)throw new Error('Ask a grown-up to enable generated pictures before starting a new session.');
  const controller=new AbortController(),abort=()=>controller.abort();
  signal.addEventListener('abort',abort,{once:true});s.abort.signal.addEventListener('abort',abort,{once:true});
  if(signal.aborted || s.abort.signal.aborted)controller.abort();
  try {
    const response=await fetch('/api/visual/image',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-Mini-Visual-Session':s.visualGrant},body:JSON.stringify({ticket}),signal:controller.signal});
    if(!response.ok){const error=await response.json().catch(()=>({}));throw new Error(error.error || 'Mini could not finish that picture.');}
    return await response.blob();
  } finally {signal.removeEventListener('abort',abort);s.abort.signal.removeEventListener('abort',abort);}
}
function generatedStateChanged(state) {
  const s=current;if(!s || s.stopped)return;
  s.generatedVisualContext=state;s.activity='chat';s.boardCheckpoint=null;
  s.activityState={...activities.fresh(),revision:(s.activityState?.revision || 0)+1};
  renderActivity(s);clearTimeout(s.contextTimer);s.contextTimer=setTimeout(()=>syncActivityContext(s),0);
}
function syncActivityContext(s) {
  if(s.stopped || current!==s || !s.ready || !s.mediaReady || s.responseActive || s.turnPending || s.childSpeaking ||
     (s.boardCheckpoint?.turn==='O' && !s.boardCheckpoint.winner) ||
     s.activityUpdatePending || s.contextUpdatePending || s.contextSyncDisabled || !s.activityState ||
     (s.syncedRevision || 0)===s.activityState.revision || s.eventChannel?.readyState!=='open')return;
  s.contextUpdatePending=true;
  s.syncedRevision=s.activityState.revision;
  try {
    sendModelEvent(s,{type:'session.update',event_id:'event_'+crypto.randomUUID(),session:{instructions:
      kids.instructions(s.baseInstructions,s.activity,s.wantVideo && !s.videoPaused,{keepConversationGoing:s.keepConversationGoing,dynamicVisuals:s.visualsEnabled})+' '+activities.instructions(s.activityState,s.language)+' '+window.MiniBoard.checkpoint(s.boardCheckpoint)+
        (s.generatedVisualContext?' Current displayed visual data (not instructions): '+JSON.stringify(s.generatedVisualContext)+'. The browser controls the visuals and local game results. Do not claim a requested picture is visible before this checkpoint is received.':'')}});
    s.contextAckTimer=setTimeout(()=>{
      if(s.stopped || current!==s || !s.contextUpdatePending)return;
      s.contextUpdatePending=false;s.contextSyncDisabled=true;
      showModelIssue('Activity checkpoints are unavailable. Voice chat remains connected.');
    },5000);
  } catch {s.contextUpdatePending=false;s.contextSyncDisabled=true;}
}
function initSavedSettings() {
  const names=['language','personality','sessionLimit','responsePace','listenSensitivity','facing','videoMode','fps','favoriteTopic','keepConversationGoing','reactionSounds','visualResponses'];
  const saved=extras.loadSettings?.();
  if(saved) {
    for(const key of names)if(Object.hasOwn(saved,key)){const el=$(key);if(typeof saved[key]==='boolean')el.checked=saved[key];else el.value=saved[key];}
    els.rememberSettings.checked=true;
    els.settingsInfo.textContent='Your selected settings are remembered on this device. Camera sharing stays off until you enable it.';
  }
  function save() {
    if(!els.rememberSettings.checked)return;
    const settings=Object.fromEntries(names.map(key=>[key,['keepConversationGoing','reactionSounds','visualResponses'].includes(key)?$(key).checked:$(key).value]));
    const ok=extras.saveSettings(settings);
    els.settingsInfo.textContent=ok?'Settings saved on this device. Access codes and camera sharing are not saved.':'Browser storage unavailable; settings are only used for this session.';
  }
  for(const key of names)$(key).addEventListener('change',save);
  els.rememberSettings.addEventListener('change',()=>{
    if(els.rememberSettings.checked)save();
    else {const ok=extras.clearSettings();els.settingsInfo.textContent=ok?'Saved settings removed; current choices remain for this session.':'Could not remove settings: browser storage is unavailable.';}
  });
  els.forgetSettings.addEventListener('click',()=>{const ok=extras.clearSettings();els.rememberSettings.checked=false;els.settingsInfo.textContent=ok?'Saved settings removed. Your preference note is controlled separately below.':'Could not remove settings: browser storage is unavailable.';});
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

// The model is in automatic server VAD mode. Its *normal* replies are triggered
// by the child's voice: do NOT send response.create without committed user input.
// The documented event is normally used for manual turns and tool continuations.
function showModelIssue(summary) {
  els.diagnostic.textContent = summary;
  els.diagnostic.classList.remove('hidden');
}
function qwenErrorLabel(error) {
  const safe = extras.modelErrorDetails(error);
  return 'code=' + safe.code + ', type=' + safe.type +
    (safe.param ? ', param=' + safe.param : '');
}

// Qwen normally supplies the next question in the SAME spoken answer. If a
// successful, transcribed answer ended without a question, Safari can ask ONE
// small question. This is NOT another Qwen response.create or paid model turn.
// Never loop on silence, restart paid sessions, or persist child transcripts.
function cancelCompanionFollowUp(s) {
  clearTimeout(s.followupTimer);
  s.followupTimer = null;
}
function scheduleCompanionFollowUp(s, reply, child, status) {
  cancelCompanionFollowUp(s);
  if(generatedVisuals?.isActive())return;
  if (!s.keepConversationGoing || !kids.needsFollowUp(reply, child, status, s.activity)) return;
  if(!s.hadAudibleReply || !s.audioMeter?.isAudible)return;
  if (!s.mediaReady || s.mode !== 'realtime' || s.muted) return;
  const selectedMode = s.activity;
  const language = s.language === 'zh' ||
    (s.language === 'auto' && /[\u3400-\u9fff]/.test(reply || child || '')) ? 'zh' : 'en';
  if(s.activityState?.story?.stage==='complete' || s.activityState?.game?.round>=3)return;
  const question = activities.prompt(s.activityState,language) || kids.getFollowUp(selectedMode, language, s.followUpCount || 0);
  const initiatedAt = Date.now();
  const attempt = () => {
    if (s.stopped || current !== s || s.activity !== selectedMode ||
        !s.mediaReady || s.muted || !s.audioInputTrack?.enabled ||
        s.childSpeaking || s.turnPending || s.responseActive || s.activityUpdatePending ||
        s.queuedActivity || s.eventChannel?.readyState !== 'open') return;
    // WebRTC may still be playing Qwen audio when response.done arrives.
    // Wait for silence, but never play the question on top of active audio.
    if (s.audioMeter?.isAudible?.()) {
      if (Date.now() - initiatedAt < 7000) {
        s.followupTimer = setTimeout(attempt, 450);
      }
      return;
    }
    s.followUpCount = (s.followUpCount || 0) + 1;
    s.followupTimer = null;
    childUI?.sayFollowUp(selectedMode, question, language);
  };
  s.followupTimer = setTimeout(attempt, 2400);
}

function startActivity(s, value) {
  if (!s || s.stopped || !s.mediaReady || s.mode !== 'realtime') return;
  cancelCompanionFollowUp(s);
  childUI?.stopSpeech();
  s.previousActivity = s.activeActivity || 'chat';
  s.activity = kids.mode(value);
  s.userSpokeDuringMode = false;
  s.activityUpdatePending = true;
  childUI?.onActivityStart(s.activity);
  try {
    sendModelEvent(s, {
      type:'session.update',
      event_id:'event_' + crypto.randomUUID(),
      session:{instructions:kids.instructions(s.baseInstructions,s.activity,s.wantVideo && !s.videoPaused,{keepConversationGoing:s.keepConversationGoing,dynamicVisuals:s.visualsEnabled})},
    });
  } catch (error) {
    s.activityUpdatePending = false;
    s.activity = s.previousActivity;
    showModelIssue('Mini could not switch games (local channel closed). Live chat may still work.');
    console.warn('Mini could not set activity:', error.message);
  }
}
function requestActivity(value) {
  const s = current;
  if (!s || s.stopped || s.mode !== 'realtime' || !s.mediaReady ||
      s.eventChannel?.readyState !== 'open') return false;
  const activity = kids.mode(value);
  cancelCompanionFollowUp(s);
  s.micMeter?.resume();
  if (s.responseActive || s.childSpeaking || s.turnPending || s.activityUpdatePending || s.contextUpdatePending) {
    s.queuedActivity = activity;
    childUI?.onActivityStart(activity, true);
    return true;
  }
  startActivity(s, activity);
  return true;
}
function afterResponse(s) {
  s.responseActive = false;
  s.turnPending = false;
  clearTimeout(s.thinkingWatchdog);
  if (s.queuedActivity) {
    const activity = s.queuedActivity;
    s.queuedActivity = null;
    startActivity(s, activity);
  } else {
    clearTimeout(s.contextTimer);
    s.contextTimer=setTimeout(()=>syncActivityContext(s),0);
  }
}

function tryInitialize(s) {
  if (s.stopped || s.updateSent || !s.sessionCreated ||
      s.pc?.connectionState !== 'connected' ||
      s.eventChannel?.readyState !== 'open') return;
  s.updateSent = true;
  s.baseInstructions = extras.buildInstructions({personality:s.personality, language:s.language, note:s.note,favoriteTopic:s.favoriteTopic});
  const session = {
    modalities: ['text','audio'],
    instructions: kids.instructions(s.baseInstructions,'chat',s.wantVideo,{keepConversationGoing:s.keepConversationGoing,opening:s.opening,dynamicVisuals:s.visualsEnabled})+' '+activities.instructions(s.activityState,s.language),
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
  if(ev.type?.startsWith('response.') && ev.type!=='response.created') {
    const id=ev.response_id || ev.response?.id;
    if(id && s.activeResponseId && id!==s.activeResponseId)return;
    if(s.responseTurn!==undefined && s.responseTurn!==(s.turnNumber || 0)) {
      if(ev.type==='response.done')s.responseActive=false;
      return;
    }
  }
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
      } else if(s.contextUpdatePending) {
        clearTimeout(s.contextAckTimer);
        s.contextUpdatePending=false;
        if(s.queuedActivity && !s.responseActive && !s.turnPending){const next=s.queuedActivity;s.queuedActivity=null;startActivity(s,next);}
        else syncActivityContext(s);
      } else if (s.activityUpdatePending && s.mediaReady) {
        s.activityUpdatePending = false;
        s.activeActivity = s.activity;
        if (s.queuedActivity && s.queuedActivity !== s.activity) {
          const next = s.queuedActivity;
          s.queuedActivity = null;
          startActivity(s, next);
        } else {
          s.queuedActivity = null;
          // Say one starter locally. Subsequent AI replies come from user audio.
          if (!s.responseActive && !s.childSpeaking && !s.userSpokeDuringMode) {
            childUI?.sayFallback(s.activity);
          }
        }
      }
      break;
    case 'input_audio_buffer.speech_started':
      interruptAwareness(s);
      cancelGeneratedRequest(s);
      s.boardVoiceRound=visualActivity?.isActive()?visualActivity.roundId():null;
      cancelCompanionFollowUp(s);
      childUI?.stopSpeech();
      s.lastChildTranscript = '';
      s.turnNumber=(s.turnNumber || 0)+1;
      s.playbackSuppressed=true;
      s.playbackActive=false;
      els.remoteAudio.muted=true;
      clearTimeout(s.playbackTimer);
      s.childSpeaking = true;
      s.userSpokeDuringMode = true;
      childUI?.onVoiceDetected(true);
      els.delay.textContent = 'First audible reply: waiting…';
      els.userText.textContent = 'Listening…';
      setStatus('You are speaking · listening', 'listening');
      break;
    case 'input_audio_buffer.speech_stopped':
      s.childSpeaking = false;
      s.turnPending = true;
      clearTimeout(s.thinkingWatchdog);
      // Never trigger a second paid response. This only helps diagnose silence.
      s.thinkingWatchdog = setTimeout(() => {
        if (!s.stopped && s.turnPending && !s.responseActive) {
          showModelIssue('Mini detected the answer, but Qwen has not started replying after 15 seconds. Stop and restart the session if it stays silent.');
        }
      }, 15000);
      childUI?.onVoiceDetected(false);
      s.speechEndedAt = performance.now();
      s.replyMeasured = false;
      setStatus('Mini is thinking…', 'thinking');
      break;
    case 'conversation.item.input_audio_transcription.delta':
      els.userText.textContent = `${ev.text || ''}${ev.stash || ''}` || 'Listening…';
      break;
    case 'conversation.item.input_audio_transcription.completed':
      if(ev.item_id && s.lastTranscriptItem===ev.item_id)return;
      s.lastTranscriptItem=ev.item_id || null;
      if (kids.isStopCommand(ev.transcript)) {
        stopMini('Voice stop · camera and microphone off', {gentle:true});
        return;
      }
      els.userText.textContent = ev.transcript || '—';
      if (typeof ev.transcript === 'string') {
        s.lastChildTranscript = ev.transcript.slice(0,240);
        const dynamic=Boolean(s.visualsEnabled && s.visualGrant);
        const handled=(visualActivity?.isActive() || !dynamic)?visualActivity?.handleTranscript(ev.transcript,s.boardVoiceRound ?? null):false;
        if(!handled) {
          const next=kids.detectRequestedActivity?.(ev.transcript, s.activity) || s.activity;
          if(visualActivity?.isActive() && next!=='tictactoe'){visualActivity.close(false);s.boardCheckpoint=null;}
          s.activity=next;
          if(!dynamic)s.activityState=activities.advance(s.activityState,ev.transcript);
        }
        renderActivity(s);
        clearTimeout(s.contextTimer);
        s.contextTimer=setTimeout(()=>syncActivityContext(s),0);
        if(!handled)requestGeneratedVisual(s,ev.transcript);
      }
      childUI?.onTranscription(ev.transcript);
      break;
    case 'response.created':
      interruptAwareness(s);
      cancelCompanionFollowUp(s);
      clearTimeout(s.thinkingWatchdog);
      s.replyTranscript = '';
      s.replyTextBackup = '';
      s.responseActive = true;
      s.activeResponseId=ev.response?.id || null;
      s.responseTurn=s.turnNumber || 0;
      s.responseGenerationDone=false;
      s.hadAudibleReply=false;
      s.pendingReaction='';s.reactionPlayed=false;
      if(!s.childSpeaking){s.playbackSuppressed=false;els.remoteAudio.muted=false;}
      childUI?.onResponseStarted();
      els.miniText.textContent = '';
      setStatus('Mini is preparing a reply…', 'thinking');
      break;
    case 'response.audio_transcript.delta':
      if (typeof ev.delta === 'string') s.replyTranscript = ((s.replyTranscript || '') + ev.delta).slice(-1800);
      els.miniText.textContent += ev.delta || '';
      if(!s.reactionPlayed && /[.!?。！？]/.test(s.replyTranscript || '')) {
        s.pendingReaction=s.replyTranscript;
        if(s.playbackActive){childUI?.reactToMiniSpeech?.(s.pendingReaction);s.reactionPlayed=true;}
      }
      break;
    case 'response.audio_transcript.done':
      if (typeof ev.transcript === 'string' && ev.transcript.trim()) s.replyTranscript = ev.transcript.slice(-1800);
      els.miniText.textContent = ev.transcript || els.miniText.textContent || '—';
      // Only paint a playful expression; this never changes model requests.
      s.pendingReaction=ev.transcript;
      if(s.playbackActive && !s.reactionPlayed){childUI?.reactToMiniSpeech?.(ev.transcript);s.reactionPlayed=true;}
      break;
    case 'response.text.delta':
      if (typeof ev.delta === 'string') s.replyTextBackup = ((s.replyTextBackup || '') + ev.delta).slice(-1800);
      break;
    case 'response.text.done':
      if (typeof ev.text === 'string' && ev.text.trim()) s.replyTextBackup = ev.text.slice(-1800);
      break;
    case 'response.done': {
      const status = ev.response?.status;
      if (status === 'failed' || status === 'incomplete') {
        const detail = qwenErrorLabel(ev.response?.status_details?.error);
        showModelIssue('Qwen reply ' + status + ' (' + detail +
          '). The session is still connected; try speaking again.');
      }
      const wasChildAnswer = Boolean(s.turnPending);
      const changedGame = Boolean(s.queuedActivity);
      const spokenAnswer = s.replyTranscript || s.replyTextBackup || '';
      s.responseGenerationDone=true;
      if(status==='completed')s.activityState=activities.finishReply(s.activityState);
      renderActivity(s);
      afterResponse(s);
      s.playbackTimer=setTimeout(()=>finishPlayback(s),900);
      if (wasChildAnswer && !changedGame) {
        scheduleCompanionFollowUp(s, spokenAnswer, s.lastChildTranscript || '', status);
      }
      break;
    }
    case 'error': {
      // Alibaba's top-level event_id identifies the SERVER error event, not
      // necessarily the client request; never match it to our request ID.
      const detail = qwenErrorLabel(ev.error);
      const safe = extras.modelErrorDetails(ev.error);
      console.warn('Mini Qwen error (structured fields only):', detail);
      if(s.contextUpdatePending && (safe.type==='invalid_request_error' || safe.param.startsWith('session.'))) {
        clearTimeout(s.contextAckTimer);
        s.contextUpdatePending=false;s.contextSyncDisabled=true;
        showModelIssue('Mini could not refresh the activity checkpoint. Voice chat remains connected.');
        break;
      }
      if (s.activityUpdatePending &&
          (safe.type === 'invalid_request_error' || safe.param.startsWith('session.'))) {
        s.activityUpdatePending = false;
        s.activity = s.previousActivity || 'chat';
        showModelIssue('Qwen declined a game change (' + detail +
          '). The live connection is still available. Try Talk or speak normally.');
        childUI?.onActivityStart(s.activity);
        break;
      }
      showModelIssue('Qwen stopped this session (' + detail +
        '). No API key or private speech is shown here. Tell a grown-up this code.');
      stopMini('Qwen error (' + detail + '). Session stopped; copy the code shown below.');
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
  mic.enabled = !s.muted;
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
    s.micMeter = extras.createMicInputMeter(s.localStream,level=>{childUI?.onMicLevel(level);if(level>=8)s.awarenessLastNoise=Date.now();});
    childUI?.onLiveReady();
    startAwareness(s);
  }
  setStatus(s.muted ? 'Microphone muted · Mini cannot hear you' : 'Mini is live · speak naturally, even one word', s.muted ? 'idle' : 'listening');
  render();
  // The first question uses Safari speech. This is not a paid Qwen turn.
  // No unsupported response.create is sent in automatic VAD mode.
  if (s.mode === 'realtime' && !s.muted) childUI?.sayFallback('chat',s.opening);
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
    keepConversationGoing:els.keepTalk.checked,
    vadThreshold:extras.speechThreshold(els.sensitivity.value),
    personality:els.personality.value, language:els.language.value,
    favoriteTopic:els.favoriteTopic.value,
    visualsEnabled:els.visualToggle.checked && visualCapabilities.available,
    imagesAllowed:els.pictures.checked && visualCapabilities.imagesAvailable && els.visualToggle.checked,
    awarenessEnabled:els.awarenessToggle.checked && els.videoToggle.checked && awarenessAvailable,
    spokenGreetings:els.spokenGreetings.checked && els.awarenessToggle.checked && els.videoToggle.checked,
    opening:kids.getOpening(els.language.value,openingRound++),
    note:extras.boundedNote(els.note.value),
    muted:false, videoPaused:false, channels:new Set(),
    ready:false, updateSent:false, sessionCreated:false, mediaStarted:false, mediaReady:false,
    activity:'chat', activeActivity:'chat', activityUpdatePending:false,
    userSpokeDuringMode:false, responseActive:false, childSpeaking:false,
    turnPending:false, followUpCount:0, lastChildTranscript:'', replyTranscript:'', replyTextBackup:'',
    startedAt:Date.now(),
  };
  s.activityState=s.visualsEnabled?activities.fresh():activities.fromOpening(s.opening);
  s.syncedRevision=s.activityState.revision;
  if (s.mode === 'realtime' && !window.confirm('Grown-up check: Start a paid Qwen voice session for up to ' + s.limit + ' minutes? The microphone and any camera you enable will stream while connected.'+
    (s.visualsEnabled?' Visual scenes add paid planning requests per turn.':'')+(s.imagesAllowed?' Newly generated pictures add separate image charges.':'')+
    (s.awarenessEnabled?' Visual awareness sends temporary snapshots for up to 40 extra paid visual checks.':'')+(s.awarenessEnabled && s.spokenGreetings?' Mini may occasionally say hello when nobody is speaking.':''))) return;
  cancelGeneratedRequest(current);generatedVisuals?.clear();
  visualActivity?.close(false);
  els.diagnostic.textContent = '';
  els.diagnostic.classList.add('hidden');
  s.endsAt = s.startedAt + s.limit * 60000;
  if (s.mode === 'realtime') s.audioMeter = extras.createVoiceMeter(els.face,{onAudibleChange:audible=>onRemoteAudio(s,audible),canHear:()=>!s.playbackSuppressed && !els.remoteAudio.muted && !els.remoteAudio.paused});
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
    if (s.audioInputTrack) s.audioInputTrack.enabled = !s.muted;
    if (s.wantVideo) {
      els.preview.srcObject = s.localStream;
      els.preview.classList.toggle('rear', s.facing === 'environment');
      await els.preview.play().catch(() => {});
    }
    if (s.stopped) return;
    s.timer = setInterval(() => updateSessionClock(s), 500);
    scheduleSessionStop(s);
    updateSessionClock(s);
    if (s.stopped) return;

    if (s.mode === 'preview') {
      s.ready = true;
      s.micMeter = extras.createMicInputMeter(s.localStream,level=>childUI?.onMicLevel(level));
      setStatus(s.muted ? 'Local preview · microphone muted · NO AI connection' : 'Local preview: camera and microphone ready · NO AI connection', 'idle');
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
      headers:{'Content-Type':'application/sdp','X-Robot-Access-Code':els.code.value.trim(),'X-Mini-Visuals':String(s.visualsEnabled),'X-Mini-Images':String(s.imagesAllowed),'X-Mini-Awareness':String(s.awarenessEnabled),'X-Mini-Camera':String(s.wantVideo)},
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
    s.visualGrant=response.headers?.get('X-Mini-Visual-Session') || null;
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

function stopMini(reason = 'Mini stopped · camera and microphone off', {gentle=false} = {}) {
  const s = current;
  if (!s) return;
  s.awareness?.stop();s.awareness=null;els.awarenessStatus.textContent='Visual awareness off.';
  cancelGeneratedRequest(s);generatedVisuals?.clear();
  if(s.visualGrant){const token=s.visualGrant;s.visualGrant=null;fetch('/api/visual/session',{method:'DELETE',credentials:'same-origin',headers:{'X-Mini-Visual-Session':token},keepalive:true}).catch(()=>{});}
  visualActivity?.close(false);
  cancelExtension();
  childUI?.stopSpeech();
  s.stopped = true;
  s.abort.abort();
  clearInterval(s.timer);
  clearTimeout(s.deadline);
  clearTimeout(s.disconnectedTimer);
  clearTimeout(s.thinkingWatchdog);
  clearTimeout(s.playbackTimer);
  clearTimeout(s.contextTimer);
  clearTimeout(s.contextAckTimer);
  cancelCompanionFollowUp(s);
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
  els.miniText.textContent = '—';
  els.kidAudio.classList.add('hidden');
  els.progress.classList.add('hidden');
  els.progress.textContent='';
  s.activityState=null;
  s.boardCheckpoint=null;
  s.generatedVisualContext=null;
  s.lastChildTranscript='';s.replyTranscript='';s.replyTextBackup='';s.pendingReaction='';
  els.videoToggle.checked=false;
  els.pictures.checked=false;
  els.awarenessToggle.checked=false;els.spokenGreetings.checked=false;
  current = null;
  els.remaining.textContent = 'Remaining: --:--';
  els.remaining.classList.remove('warning');
  setStatus(reason, reason.includes('failed') || reason.includes('error') || reason.includes('Cannot') ? 'error' : 'idle');
  render();
  if (gentle) childUI?.onSessionEnded?.(s.language);
}

function toggleMute() {
  const s = current;
  if (!s) return;
  s.muted = !s.muted;
  interruptAwareness(s);
  if (s.muted) {
    cancelCompanionFollowUp(s);
    childUI?.stopSpeech();
  }
  if (s.audioInputTrack) s.audioInputTrack.enabled = !s.muted;
  setStatus(s.muted ? 'Microphone muted · Mini cannot hear you' : 'Microphone live · listening', s.muted ? 'idle' : 'listening');
  render();
}
async function toggleVideo() {
  const s = current;
  if (!s || !s.wantVideo || (s.mode !== 'preview' && !s.ready)) return;
  s.videoPaused = !s.videoPaused;
  interruptAwareness(s);
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
els.extendForm.addEventListener('submit', authorizeExtension);
els.extensionCancel.addEventListener('click', cancelExtension);
els.extendDialog.addEventListener('cancel', cancelExtension);
els.extendDialog.addEventListener('close', cancelExtension);
els.stop.addEventListener('click', () => stopMini('Mini stopped · camera and microphone off', {gentle:true}));
els.mute.addEventListener('click', toggleMute);
els.pauseVideo.addEventListener('click', toggleVideo);
els.playAudio.addEventListener('click', maybeUnmuteAudio);
els.kidAudio.addEventListener('click', maybeUnmuteAudio);
window.addEventListener('pagehide', () => {
  if(visualActivity?.isActive())visualActivity.close();
  childUI?.stopLocalPlay?.();
  childUI?.stopSpeech();
  stopMini('Page closed · stopped');
});
document.addEventListener('visibilitychange', () => {
  // Stop *both* paid AI and local story narration when Safari is hidden.
  if (document.hidden) {
    if(visualActivity?.isActive())visualActivity.close();
    childUI?.stopLocalPlay?.();
    childUI?.stopSpeech();
    if (current) stopMini('Safari hidden · live session stopped for privacy');
  }
});
initPreferences();
initSavedSettings();
childUI = window.MiniChildUI?.init({
  getSession: () => current,
  getLanguage: () => els.language.value,
  getReactionSounds: () => els.reactionSounds.checked,
  stopSession: (reason, options) => stopMini(reason, options),
  requestActivity,
});
visualActivity=window.MiniBoard.init({
  getLanguage:()=>current?.language || els.language.value,
  getSession:()=>current,
  onStart:()=>{
    cancelGeneratedRequest(current);generatedVisuals?.clear();
    if(current)current.generatedVisualContext=null;
    childUI?.stopLocalPlay?.();childUI?.stopSpeech();
    $('parentSetup').open=false;
    if(!current)setStatus('Local board game · mic and camera off','idle');
  },
  onChange:game=>{
    const s=current;
    if(s && !s.stopped) {
      s.activity='tictactoe';s.boardCheckpoint=game;
      s.activityState={...activities.fresh(),kind:'tictactoe',revision:(s.activityState?.revision || 0)+1};
      clearTimeout(s.contextTimer);s.contextTimer=setTimeout(()=>syncActivityContext(s),0);
      renderActivity(s);
    }
    render();
  },
  onExit:()=>{
    const s=current;
    if(s && !s.stopped){s.boardCheckpoint=null;s.activity='chat';s.activityState={...activities.fresh(),revision:(s.activityState?.revision || 0)+1};clearTimeout(s.contextTimer);s.contextTimer=setTimeout(()=>syncActivityContext(s),0);renderActivity(s);}
    const live=s?.ready && s.mode==='realtime';
    setStatus(s?.muted?'Microphone muted · Mini cannot hear you':live?'Mini is listening':s?'Local preview · no AI connection':'Mini is resting',live && !s.muted?'listening':'idle');render();
  },
  onResult:winner=>childUI?.reactToMiniSpeech?.(winner==='X'?'Great job!':winner==='draw'?'Wow, we filled the board!':'Let’s try another round.'),
});
generatedVisuals=window.MiniVisuals.init({
  getLanguage:()=>current?.language || els.language.value,
  openBoard:()=>visualActivity.open(),
  requestArtwork:requestGeneratedArtwork,
  onStart:()=>{
    visualActivity?.close(false);childUI?.stopLocalPlay?.();childUI?.stopSpeech();$('parentSetup').open=false;
    if(current){current.boardCheckpoint=null;current.generatedVisualContext=generatedVisuals.describe();}
  },
  onInteraction:choice=>{const s=current;if(s)requestGeneratedVisual(s,'Button interaction: '+JSON.stringify({id:choice.id,label:choice.label}),true);},
  onStateChange:generatedStateChanged,
  onExit:()=>{
    cancelGeneratedRequest(current);
    if(current)generatedStateChanged(null);
    const live=current?.ready && current.mode==='realtime';
    setStatus(current?.muted?'Microphone muted · Mini cannot hear you':live?'Mini is listening':current?'Local preview · no AI connection':'Mini is resting',live && !current.muted?'listening':'idle');render();
  },
});
els.visualToggle.addEventListener('change',render);
els.videoToggle.addEventListener('change',render);
els.awarenessToggle.addEventListener('change',render);
els.awarenessPause.addEventListener('click',()=>current?.awareness?.toggle());
document.addEventListener('pointerdown',()=>interruptAwareness(current));
els.language.addEventListener('change', () => childUI?.syncLanguage());
loadConfig();
render();
childUI?.onStatus({state:'idle',online:false,running:false});
