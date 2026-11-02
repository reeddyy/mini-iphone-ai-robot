// Mini V6: one browser WebRTC session, continuous microphone, optional low-fps video.
// No Alibaba API key is ever sent to this JavaScript. SDP exchange goes through /api/realtime/sdp.
const extras = window.MiniExtras;
const kids = window.MiniKidsContent;
const activities = window.MiniActivities;
const $ = id => document.getElementById(id);
const els = {
  face: $('robotFace'), status: $('status'), mode: $('modeTag'), info: $('modeInfo'),
  code: $('accessCode'), start: $('startBtn'), stop: $('stopBtn'), extend: $('extendBtn'),
  remaining: $('remainingTime'), delay: $('replyDelay'),
  language: $('language'), sensitivity: $('listenSensitivity'),
  postTest: $('postTestBtn'), postResult: $('postTestResult'),
  videoToggle: $('sendVideo'), facing: $('facing'), videoMode: $('videoMode'), visionQuality:$('visionQuality'), limit: $('sessionLimit'),
  preview: $('preview'),cameraMonitor:$('cameraMonitor'),cameraSurface:$('cameraSurface'),cameraSurfaceLabel:$('cameraSurfaceLabel'), placeholder: $('cameraPlaceholder'),
  mute: $('muteBtn'), pauseVideo: $('pauseVideoBtn'), clock: $('sessionClock'),
  micBadge: $('micBadge'), videoBadge: $('videoBadge'),
  userText: $('userTranscript'), miniText: $('assistantTranscript'),
  remoteAudio: $('remoteAudio'), playAudio: $('playAudioBtn'), diagnostic: $('modelDiagnostic'),
  kidAudio: $('kidAudioBtn'),
  sharing: $('sharingNotice'), progress: $('activityProgress'),
  pictures:$('generatedPictures'),visualStatus:$('visualRequestStatus'),visualInfo:$('visualCapabilityInfo'),
  picturesInfo:$('generatedPicturesInfo'),
  visualServiceStatus:$('visualServiceStatus'),visualPause:$('pauseVisualsBtn'),
  awarenessStatus:$('awarenessStatus'),awarenessPause:$('pauseAwarenessBtn'),
  resetSettings: $('resetSettingsBtn'), settingsInfo: $('settingsInfo'),
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
let lastVisualIssue='';
let extensionRequest = null;
let openingRound = Math.floor(Math.random() * 1000);

function sessionLanguage(s=current){return s?.conversationLanguage || window.MiniLanguage.resolve({preferred:s?.language || els.language.value,device:typeof navigator==='undefined'?[]:navigator.languages || [navigator.language]});}
function resumeCameraPreview(s=current){
  if(!s || current!==s || s.stopped || !s.wantVideo || !s.localStream?.getVideoTracks().some(track=>track.readyState==='live'))return;
  // Resume existing media elements only; never reacquire capture or re-enable sharing.
  if(els.preview.srcObject!==s.localStream)els.preview.srcObject=s.localStream;
  els.preview.play().catch(()=>{});
  if($('parentSetup').open){if(els.cameraMonitor.srcObject!==s.localStream)els.cameraMonitor.srcObject=s.localStream;els.cameraMonitor.play().catch(()=>{});}
}
function closeParentSetup(){const panel=$('parentSetup');if(panel.open){if(panel.close)panel.close();else panel.open=false;}resumeCameraPreview();}
function openParentSetup(){const panel=$('parentSetup');if(!panel.open){if(panel.showModal)panel.showModal();else panel.open=true;}resumeCameraPreview();}
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
  $('kidParentLink').classList.toggle('hidden',running);
  els.stop.classList.toggle('hidden', !running);
  els.start.disabled = loading || mode === 'checking';
  els.start.textContent = mode === 'preview' ? 'Test microphone' + (els.videoToggle.checked ? ' & camera' : '') : 'Start Mini';
  for (const control of [els.code, els.videoToggle, els.facing, els.videoMode, els.visionQuality, els.limit, els.sensitivity, els.language, els.resetSettings]) control.disabled = running || loading;
  $('liveSessionControls').classList.toggle('hidden', !running);
  els.pictures.disabled=running || loading || mode!=='realtime' || !visualCapabilities.available || !visualCapabilities.imagesAvailable;
  const pictureReason=running || loading
    ? 'Pictures are ' + (s?.imagesAllowed ? 'on' : 'off') + ' for this session. Stop Mini to change.'
    : mode==='checking'
    ? 'Checking picture setup…'
    : mode!=='realtime'
    ? 'Pictures need live AI. See Troubleshooting for setup.'
    : !visualCapabilities.available
    ? 'Picture setup needs attention. Voice chat can still work. See Troubleshooting.'
    : !visualCapabilities.imagesAvailable
    ? 'Pictures aren’t set up yet. Voice and games still work. See Troubleshooting.'
    : els.pictures.checked
    ? 'On request · up to 4 pictures per session.'
    : 'Pictures are off. Stories and games still work.';
  els.picturesInfo.textContent=pictureReason;els.pictures.title=pictureReason;
  els.visualPause.classList.toggle('hidden',!s?.visualsEnabled || !s?.visualGrant);
  els.visualPause.textContent=s?.visualsPaused?'Resume visual responses':'Pause visual responses';
  const visualModels='Planner: '+(visualCapabilities.model || 'not configured')+' · Artwork: '+(visualCapabilities.imageModel || 'not configured')+
    (visualCapabilities.imageEndpoint?' · Image API: '+(visualCapabilities.imageEndpoint==='singapore'?'Singapore native':'Workspace'):'')+'.';
  const visualIssue=s?.visualIssue || lastVisualIssue;
  els.visualServiceStatus.textContent=visualIssue?'Last visual issue: '+visualIssue:(s?.visualsPaused?'Visual responses paused. Voice chat can continue. '+visualModels:visualModels);
  els.awarenessPause.classList.toggle('hidden',!s?.awareness);
  els.awarenessPause.textContent=s?.awareness?.isUnavailable?.()?'Retry local reactions':s?.awareness?.isPaused()?'Resume local reactions':'Pause local reactions';
  els.mute.disabled = !running;
  els.mute.textContent = s?.muted ? 'Unmute microphone' : 'Mute microphone';
  els.pauseVideo.disabled = !running || !s?.wantVideo || !s?.ready;
  els.pauseVideo.textContent = s?.videoPaused ? 'Resume visual sharing' : 'Pause visual sharing';
  els.micBadge.textContent = running ? (s.muted ? 'Microphone muted' : s.mode === 'preview' ? 'Microphone local only' : s.ready ? 'Mic LIVE' : 'Mic preparing') : 'Microphone off';
  els.micBadge.classList.toggle('active', running && s.mode !== 'preview' && !s.muted && s.ready);
  els.videoBadge.textContent = running && s.wantVideo ? (s.mode === 'preview' ? 'Camera local only' : s.videoPaused ? 'Visuals paused' : s.ready ? s.videoPacketsConfirmed?`Video sending · ${s.fps}fps target`:'Camera sharing · awaiting video confirmation' : 'Camera local') : 'Camera off';
  els.videoBadge.classList.toggle('active', running && s.mode !== 'preview' && s.wantVideo && !s.videoPaused && s.ready);
  els.cameraSurface.classList.toggle('hidden',!running || !s?.wantVideo || !els.preview.srcObject);
  els.cameraSurfaceLabel.textContent=s?.videoPaused || s?.mode==='preview'?'Local':'Camera';
  $('cameraPerformance').textContent=running && s.wantVideo?'Local camera: smooth capture · AI target: '+(s.videoFrameSize?s.videoFrameSize.width+'×'+s.videoFrameSize.height+' · ':'')+s.fps+' fps'+(s.senderLimited===false?' · sender pacing unavailable on this browser':'')+(s.cameraStats?(s.cameraStats.bytes>0?' · Video sent: '+s.cameraStats.frames+' frames, '+s.cameraActualFps.toFixed(1)+' fps':' · No sent video packets confirmed yet'):'')+(s.trackingMetrics?' · Local reactions: '+s.trackingMetrics.fps+' fps, '+s.trackingMetrics.processingMs+' ms processing':''):'Camera off.';
  els.placeholder.classList.toggle('hidden', !!(running && s.wantVideo && els.preview.srcObject));
  $('boardPlayBtn').classList.toggle('hidden',running || Boolean(visualActivity?.isActive()));
  els.sharing.classList.toggle('hidden',!running);
  if(running) {
    const zh=sessionLanguage(s)==='zh';
    const mic=s.audioInputTrack?.enabled && !s.muted;
    const camera=s.wantVideo && !s.videoPaused;
    els.sharing.textContent=s.mode==='preview'
      ? (zh?'仅本地预览 · ':'Local preview · ')+(mic?(zh?'麦克风开启':'Mic on'):(zh?'麦克风静音':'Mic muted'))+' · '+(camera?(zh?'摄像头仅本地':'Camera local only'):(zh?'摄像头关闭':'Camera off'))
      : (mic && s.mediaReady?(zh?'麦克风实时传送':'Mic live'):(zh?'麦克风未传送':'Mic not sending'))+' · '+(camera && s.mediaReady?(zh?'摄像头分享已开启':'Camera sharing on'):(zh?'摄像头未传送':'Camera not sending'));
  }
}
async function maybeUnmuteAudio() {
  const s = current;
  if (!s || s.stopped) return;
  els.remoteAudio.muted = Boolean(s.playbackSuppressed || s.localVisualTurn);
  els.remoteAudio.volume = 1;
  current?.audioMeter?.resume();
  current?.micMeter?.resume();
  try {
    await els.remoteAudio.play();
    if (current === s && !s.stopped) els.kidAudio.classList.add('hidden');
  } catch {
    if (current !== s || s.stopped) return;
    const label = sessionLanguage(s) === 'zh' ? '▶ 点这里听 Mini 说话' : '▶ Tap to hear Mini';
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
    els.visualInfo.textContent=visualCapabilities.configurationError || (visualCapabilities.imagesAvailable
      ? 'Games and story coordination can use paid Qwen requests. Explicit pictures go directly to the image model. Limits: 60 plans and 4 pictures per session.'
      : visualCapabilities.imageError || 'Pictures are not configured. Set ALIBABA_IMAGE_MODEL in the server’s private .env, restart Mini and refresh. Voice and games remain available.');
    mode = data.mode;
    els.mode.textContent = mode === 'realtime' ? 'LIVE AI' : 'FREE PREVIEW';
    els.mode.classList.toggle('is-demo', mode !== 'realtime');
    els.info.textContent = mode === 'realtime'
      ? 'Ready · paid AI after Start confirmation.'
      : 'Free local preview. Live AI is not configured yet.';
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
  if(s.localVisualTurn) {
    if(childUI?.isSpeakingLocally?.()){s.playbackTimer=setTimeout(()=>finishPlayback(s),200);return;}
    if(!s.visualPlanning){setStatus(s.muted?'Microphone muted · Mini cannot hear you':'Your turn · Mini is listening',s.muted?'idle':'listening');childUI?.onResponseFinished();}
    return;
  }
  if(s.playbackActive || s.audioMeter?.isAudible?.()) {
    s.playbackTimer=setTimeout(()=>finishPlayback(s),120);
    return;
  }
  if(!s.hadAudibleReply) {
    setStatus('Reply ready · tap below if you could not hear Mini','idle');
    els.kidAudio.textContent=sessionLanguage(s)==='zh'?'▶ 点这里听 Mini 说话':'▶ Tap to hear Mini';
    els.kidAudio.classList.remove('hidden');
    return;
  }
  setStatus(s.muted?'Microphone muted · Mini cannot hear you':'Your turn · Mini is listening',s.muted?'idle':'listening');
  s.awarenessLastActivity=Date.now();
  schedulePlannedFollowUp(s);
  childUI?.onResponseFinished();
}
function renderActivity(s) {
  const text=activities.summary(s.activityState,s.language);
  els.progress.textContent=text;
  els.progress.classList.toggle('hidden',!text || Boolean(visualActivity?.isActive()) || Boolean(generatedVisuals?.isActive()));
}
function interruptAwareness(s) {
  if(!s)return;
  s.awarenessLastActivity=Date.now();
}
function startAwareness(s) {
  if(!s.awarenessEnabled || s.awareness || !window.MiniLocalAwareness)return;
  s.awareness=window.MiniLocalAwareness.start({video:els.preview,spoken:s.spokenGreetings,
    allowed:()=>current===s && !s.stopped && s.ready && s.wantVideo && !s.videoPaused && !document.hidden && Boolean(els.preview.srcObject),
    canSpeak:()=>(s.localGreetings || 0)<2 && s.mode==='realtime' && !s.muted && !s.childSpeaking && !s.responseActive && !s.turnPending && !s.playbackActive && !childUI?.isNarrating?.() && !hasLocalVisualGame() && Date.now()-(s.awarenessLastActivity || s.startedAt)>6000,
    onLook:cue=>{
      if(!cue){delete els.face.dataset.cameraTracking;delete els.face.dataset.cameraSmile;for(const key of ['--look-x','--look-y','--head-tilt'])els.face.style.removeProperty(key);return;}
      els.face.dataset.cameraTracking='true';els.face.dataset.cameraSmile=String(Boolean(cue.smiling));
      els.face.style.setProperty('--look-x',cue.lookX.toFixed(1)+'px');els.face.style.setProperty('--look-y',cue.lookY.toFixed(1)+'px');els.face.style.setProperty('--head-tilt',cue.tilt.toFixed(1)+'deg');
    },
    onMetrics:metrics=>{if(current===s && !s.stopped){s.trackingMetrics=metrics;render();}},
    onCue:reaction=>{if(childUI?.reactToVisualCue?.(reaction) && reaction.spoken)s.localGreetings=(s.localGreetings || 0)+1;},
    onStatus:state=>{if(current!==s || s.stopped)return;els.awarenessStatus.textContent=state.message;render();},
  });render();
}
function cancelGeneratedRequest(s) {
  if(s){s.visualRequestVersion=(s.visualRequestVersion || 0)+1;s.visualAbort?.abort();s.visualPlanning=false;}
  generatedVisuals?.cancelPending();generatedVisuals?.setBusy(false);
  els.visualStatus.classList.add('hidden');
}
function hasLocalVisualGame(){return Boolean(visualActivity?.isActive() || ['hand_game','count'].includes(generatedVisuals?.current()?.activity?.type));}
function narrateVisual(text) {
  const s=current;if(!s || s.stopped || s.mode!=='realtime' || !s.ready || s.muted || !text)return;
  if(s.childSpeaking){s.pendingLocalNarration=text;return;}
  s.localVisualTurn=true;s.localNarrationForTurn=true;s.playbackSuppressed=true;s.playbackActive=false;els.remoteAudio.muted=true;
  const language=window.MiniLanguage.resolve({text,previous:sessionLanguage(s)});
  els.miniText.textContent=text;childUI?.sayFallback('chat',text,language);
  clearTimeout(s.playbackTimer);s.playbackTimer=setTimeout(()=>finishPlayback(s),900);
}
function flushSpokenVisual(s) {
  const pending=s.pendingVisualTurn;
  if(!pending || s.stopped || current!==s || pending.turn!==(s.turnNumber || 0) || !s.visualReplyFinished || !s.visualSpokenReply)return;
  s.pendingVisualTurn=null;clearTimeout(s.visualSyncTimer);
  requestGeneratedVisual(s,pending.request,false,{spokenReply:s.visualSpokenReply});
}
function refreshVisualAvailability(s) {
  if(!s || s.stopped)return;
  s.activityState={...(s.activityState || activities.fresh()),revision:(s.activityState?.revision || 0)+1};
  clearTimeout(s.contextTimer);s.contextTimer=setTimeout(()=>syncActivityContext(s),0);render();
}
function reportVisualFailure(s,error,stage='planner') {
  const diagnostic=error.visualDiagnostic || {},parts=[diagnostic.code || 'VISUAL_CLIENT_ERROR',diagnostic.stage || stage,
    diagnostic.model || (stage==='planner'?visualCapabilities.model:visualCapabilities.imageModel),diagnostic.httpStatus?'HTTP '+diagnostic.httpStatus:null,diagnostic.providerCode,diagnostic.parameter,diagnostic.reason,diagnostic.field,diagnostic.endpoint?'endpoint='+diagnostic.endpoint:null].filter(Boolean);
  s.visualIssue=parts.join(' · ')+': '+(error.message || 'Visual response unavailable.');
  lastVisualIssue=s.visualIssue;
  if(stage==='planner') {
    s.invalidPlans=(s.invalidPlans || 0)+1;
    const recoverable=['VISUAL_PLAN_INVALID','VISUAL_RESPONSE_JSON'].includes(diagnostic.code) && s.invalidPlans<2;
    s.visualsPaused=!recoverable;
    els.visualStatus.textContent=sessionLanguage(s)==='zh'?'Mini 的画面休息一下，我们还可以聊天。':(s.visualsPaused?'Mini’s pictures are resting. We can still talk.':'That visual request didn’t work. You can ask me again.');
    els.visualStatus.classList.remove('hidden');
  }
  refreshVisualAvailability(s);
}
function toggleVisualResponses() {
  const s=current;if(!s || s.stopped || !s.visualsEnabled || !s.visualGrant)return;
  cancelGeneratedRequest(s);s.visualsPaused=!s.visualsPaused;s.visualIssue='';lastVisualIssue='';
  refreshVisualAvailability(s);
}
async function requestGeneratedVisual(s,request,fromChoice=false,{spokenReply='',narrate=false}={}) {
  if(s.stopped || current!==s || s.mode!=='realtime' || !s.visualsEnabled || !s.visualGrant || s.visualsPaused)return;
  cancelGeneratedRequest(s);
  interruptAwareness(s);
  if(narrate){s.localVisualTurn=true;s.playbackSuppressed=true;s.playbackActive=false;els.remoteAudio.muted=true;}
  const version=s.visualRequestVersion;
  const controller=new AbortController();s.visualAbort=controller;
  s.visualPlanning=true;
  generatedVisuals?.setBusy(true);
  els.visualStatus.textContent=sessionLanguage(s)==='zh'?'Mini 正在想怎么画……':'Mini is imagining what to show…';els.visualStatus.classList.remove('hidden');
  try {
    const response=await fetch('/api/visual/plan',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-Mini-Visual-Session':s.visualGrant},
      body:JSON.stringify({request:request.slice(0,500),spokenReply:spokenReply.slice(0,2000),scene:generatedVisuals?.current() || (visualActivity?.isActive()?{version:1,action:'activity',title:'Tic-tac-toe',activity:{type:'tictactoe'}}:null),language:sessionLanguage(s),followUpsAllowed:s.keepConversationGoing}),signal:controller.signal});
    const type=response.headers?.get('content-type');
    if(type && !type.toLowerCase().includes('application/json'))throw Object.assign(new Error('The tunnel returned a sign-in or error page. Check the tunnel login, then refresh Safari.'),{visualDiagnostic:{code:'VISUAL_GATEWAY',httpStatus:response.status}});
    const data=await response.json();
    if(!response.ok)throw Object.assign(new Error(data.error || 'Visual response unavailable. Voice chat can continue.'),{visualDiagnostic:data.diagnostic || {code:data.code || 'VISUAL_HTTP_ERROR',httpStatus:response.status}});
    const plan=window.MiniVisualSchema.validate(data.plan);
    if(s.stopped || current!==s || version!==s.visualRequestVersion || controller.signal.aborted)return;
    s.invalidPlans=0;
    if(plan.action==='keep' && plan.message){els.visualStatus.textContent=plan.message;els.visualStatus.classList.remove('hidden');}
    await generatedVisuals.apply(plan,{imageTicket:data.imageTicket,allowChoiceContinuation:!fromChoice});
    if(s.stopped || current!==s || version!==s.visualRequestVersion || controller.signal.aborted)return;
    if(plan.followUp && !narrate && (plan.action!=='artwork' || generatedVisuals?.describe()?.status==='visible')){s.contextualFollowUp={question:plan.followUp,reply:spokenReply,child:s.lastChildTranscript || request};if(s.hadAudibleReply)schedulePlannedFollowUp(s);}
    if(narrate && current===s && !s.stopped && !controller.signal.aborted && plan.action!=='clear' && (plan.action!=='interact' || !s.localNarrationForTurn))narrateVisual(visualActivity?.isActive()?visualActivity.speech():generatedVisuals.speech?.() || plan.message);
  } catch(error) {
    if(!s.stopped && current===s && version===s.visualRequestVersion && !controller.signal.aborted) {
      reportVisualFailure(s,error);
      return;
    }
  } finally {
    if(current===s && version===s.visualRequestVersion){s.visualPlanning=false;generatedVisuals?.setBusy(false);if(!controller.signal.aborted && els.visualStatus.textContent.includes('…'))els.visualStatus.classList.add('hidden');if(s.localVisualTurn)finishPlayback(s);}
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
    if(!response.ok){
      const data=await response.json().catch(()=>({})),error=Object.assign(new Error(data.error || 'Mini could not finish that picture.'),{visualDiagnostic:data.diagnostic || {code:'IMAGE_HTTP_ERROR',httpStatus:response.status}});
      if(current===s && !s.stopped && !controller.signal.aborted){if(['VISUAL_MODEL_UNAVAILABLE','VISUAL_ACCESS','VISUAL_AUTH','VISUAL_QUOTA'].includes(data.diagnostic?.code)){s.imagesAllowed=false;visualCapabilities.imagesAvailable=false;visualCapabilities.imageError='Artwork disabled until the Windows server restarts with working model access. '+error.message;}reportVisualFailure(s,error,'artwork');}
      throw new Error(sessionLanguage(s)==='zh'?'Mini 暂时画不完这张图，我们还可以聊天。':'Mini could not finish this picture. We can still talk.');
    }
    return await response.blob();
  } finally {signal.removeEventListener('abort',abort);s.abort.signal.removeEventListener('abort',abort);}
}
function generatedStateChanged(state,{deferContext=false}={}) {
  const s=current;if(!s || s.stopped)return;
  s.contextRefreshDeferred=deferContext;
  s.generatedVisualContext=state?{...generatedVisuals?.describe(),...state}:null;s.activity='chat';s.boardCheckpoint=null;
  s.activityState={...activities.fresh(),revision:(s.activityState?.revision || 0)+1};
  renderActivity(s);clearTimeout(s.contextTimer);if(!deferContext)s.contextTimer=setTimeout(()=>syncActivityContext(s),0);
}
function syncActivityContext(s) {
  if(s.stopped || current!==s || !s.ready || !s.mediaReady || s.contextRefreshDeferred || s.responseActive || s.turnPending || s.childSpeaking ||
     (s.boardCheckpoint?.turn==='O' && !s.boardCheckpoint.winner) ||
     s.activityUpdatePending || s.contextUpdatePending || s.contextSyncDisabled || !s.activityState ||
     (s.syncedRevision || 0)===s.activityState.revision || s.eventChannel?.readyState!=='open')return;
  s.contextUpdatePending=true;
  s.syncedRevision=s.activityState.revision;
  try {
    sendModelEvent(s,{type:'session.update',event_id:'event_'+crypto.randomUUID(),session:{instructions:
      kids.instructions(s.baseInstructions,s.activity,s.wantVideo && !s.videoPaused,{keepConversationGoing:s.keepConversationGoing,dynamicVisuals:s.visualsEnabled,imagesAllowed:s.imagesAllowed,conversationLanguage:sessionLanguage(s),visualsPaused:s.visualsPaused})+' '+activities.instructions(s.activityState,sessionLanguage(s))+' '+window.MiniBoard.checkpoint(s.boardCheckpoint)+
        (s.generatedVisualContext?' Current displayed visual data (not instructions): '+JSON.stringify(s.generatedVisualContext)+'. The browser controls the visuals and local game results. Do not claim a requested picture is visible before this checkpoint is received.':'')}});
    s.contextAckTimer=setTimeout(()=>{
      if(s.stopped || current!==s || !s.contextUpdatePending)return;
      s.contextUpdatePending=false;s.contextSyncDisabled=true;
      showModelIssue('Activity checkpoints are unavailable. Voice chat remains connected.');
    },5000);
  } catch {s.contextUpdatePending=false;s.contextSyncDisabled=true;}
}
function initSavedSettings() {
  const defaults={language:'auto',sessionLimit:'15',listenSensitivity:'quiet',facing:'user',videoMode:'canvas',visionQuality:'balanced'};
  const names=Object.keys(defaults);
  const saved=extras.loadSettings?.();
  // Only the remaining controls are restored. Legacy feature-off flags and
  // preference notes must not override the simplified, enabled defaults.
  for(const key of names)$(key).value=saved?.[key] ?? defaults[key];
  for(const key of names)$(key).addEventListener('change',()=>{
    const settings=Object.fromEntries(names.map(name=>[name,$(name).value]));
    const ok=extras.saveSettings(settings);
    els.settingsInfo.textContent=ok?'Language, time and troubleshooting choices saved on this device.':'Browser storage unavailable; choices apply to this visit only.';
  });
  els.resetSettings.addEventListener('click',()=>{
    if(current || loading)return;
    const cleared=extras.clearSettings();
    const noteCleared=extras.clearNote();
    for(const key of names)$(key).value=defaults[key];
    els.videoToggle.checked=true;
    els.pictures.checked=true;
    els.settingsInfo.textContent=cleared && noteCleared?'Defaults restored and old saved preferences removed.':'Defaults restored for this visit. Browser storage could not be cleared.';
    render();
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
function schedulePlannedFollowUp(s){
  const next=s.contextualFollowUp;if(!next)return;s.contextualFollowUp=null;
  scheduleCompanionFollowUp(s,next.reply,next.child,'completed',next.question);
}
function scheduleCompanionFollowUp(s, reply, child, status, contextual='') {
  cancelCompanionFollowUp(s);
  if(s.localVisualTurn)return;
  if(generatedVisuals?.isActive() && !contextual)return;
  if(!s.keepConversationGoing || (s.followUpCount || 0)>=6 || s.followUpTurn===(s.turnNumber || 0))return;
  if(contextual && (kids.looksLikeQuestion(reply) || kids.isChildEndingConversation(child) || kids.isChildEndingConversation(reply) || /the end|happily ever after|thank you|thanks|故事结束|谢谢/i.test(reply)))return;
  if (!contextual && !kids.needsFollowUp(reply, child, status, s.activity)) return;
  if(!s.hadAudibleReply || !s.audioMeter?.isAudible)return;
  if (!s.mediaReady || s.mode !== 'realtime' || s.muted) return;
  const selectedMode = s.activity;
  const language=window.MiniLanguage.resolve({text:reply || child,previous:sessionLanguage(s)});
  if(s.activityState?.story?.stage==='complete' || s.activityState?.game?.round>=3)return;
  const question = contextual || activities.prompt(s.activityState,language) || kids.getFollowUp(selectedMode, language, s.followUpCount || 0);
  const initiatedAt = Date.now();
  const attempt = () => {
    if (s.stopped || current !== s || s.activity !== selectedMode ||
        !s.mediaReady || s.muted || !s.audioInputTrack?.enabled ||
        s.childSpeaking || s.turnPending || s.responseActive || s.activityUpdatePending ||
        s.queuedActivity || s.eventChannel?.readyState !== 'open') return;
    // WebRTC may still be playing Qwen audio when response.done arrives.
    // Wait for silence, but never play the question on top of active audio.
    if (s.audioMeter?.isAudible?.()) {
      if (Date.now() - initiatedAt < 30000) {
        s.followupTimer = setTimeout(attempt, contextual?1500:450);
      }
      return;
    }
    if(childUI?.isNarrating?.() || s.visualPlanning || hasLocalVisualGame())return;
    s.followUpCount = (s.followUpCount || 0) + 1;s.followUpTurn=s.turnNumber || 0;
    s.followupTimer = null;
    childUI?.sayFollowUp(selectedMode, question, language);
  };
  s.followupTimer = setTimeout(attempt, contextual?6000:2400);
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
      session:{instructions:kids.instructions(s.baseInstructions,s.activity,s.wantVideo && !s.videoPaused,{keepConversationGoing:s.keepConversationGoing,dynamicVisuals:s.visualsEnabled,imagesAllowed:s.imagesAllowed,conversationLanguage:sessionLanguage(s),visualsPaused:s.visualsPaused})},
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
    instructions: kids.instructions(s.baseInstructions,'chat',s.wantVideo,{keepConversationGoing:s.keepConversationGoing,opening:s.opening,dynamicVisuals:s.visualsEnabled,imagesAllowed:s.imagesAllowed,conversationLanguage:sessionLanguage(s)})+' '+activities.instructions(s.activityState,sessionLanguage(s)),
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
      s.refreshVideoFrame?.();
      interruptAwareness(s);
      cancelGeneratedRequest(s);
      s.boardVoiceRound=visualActivity?.isActive()?visualActivity.roundId():null;
      cancelCompanionFollowUp(s);
      childUI?.stopSpeech();
      s.contextRefreshDeferred=false;
      s.lastChildTranscript = '';
      s.pendingVisualTurn=null;s.visualSpokenReply='';s.visualReplyFinished=false;s.contextualFollowUp=null;s.localMoveHandled=false;s.localNarrationForTurn=false;
      s.pendingLocalNarration=null;
      clearTimeout(s.visualSyncTimer);s.localVisualTurn=Boolean(visualActivity?.isActive() || (!s.visualsPaused && hasLocalVisualGame()));
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
      s.refreshVideoFrame?.();
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
      if(s.pendingLocalNarration){const narration=s.pendingLocalNarration;s.pendingLocalNarration=null;narrateVisual(narration);}
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
        s.contextRefreshDeferred=false;
        const switchTo=window.MiniLanguage.requested(ev.transcript);if(switchTo)s.languageOverride=switchTo;
        s.conversationLanguage=window.MiniLanguage.resolve({preferred:s.languageOverride || s.language,text:ev.transcript,previous:s.hasChildSpoken?sessionLanguage(s):undefined});s.hasChildSpoken=true;
        s.lastChildTranscript = ev.transcript.slice(0,240);
        const dynamic=Boolean(s.visualsEnabled && s.visualGrant);
        const openingBoard=!visualActivity?.isActive() && window.MiniBoard.wantsGame(ev.transcript) && !/\b(?:not|don['’]?t|do not)\b|不要|不想/i.test(ev.transcript);
        if(openingBoard){s.localVisualTurn=true;s.playbackSuppressed=true;els.remoteAudio.muted=true;}
        const handled=visualActivity?.handleTranscript(ev.transcript,s.boardVoiceRound ?? null);
        if(!handled) {
          const next=kids.detectRequestedActivity?.(ev.transcript, s.activity) || s.activity;
          if(visualActivity?.isActive() && next!=='tictactoe'){visualActivity.close(false);s.boardCheckpoint=null;}
          s.activity=next;
          if(!dynamic)s.activityState=activities.advance(s.activityState,ev.transcript);
        }
        renderActivity(s);
        clearTimeout(s.contextTimer);
        s.contextTimer=setTimeout(()=>syncActivityContext(s),0);
        if(handled){s.localMoveHandled=true;if(s.localVisualTurn && !hasLocalVisualGame())narrateVisual(sessionLanguage(s)==='zh'?'我们继续聊天吧。':'Let’s keep chatting.');}
        else if(dynamic) {
          if(s.localVisualTurn)requestGeneratedVisual(s,ev.transcript,false,{narrate:true});
          else{s.pendingVisualTurn={request:ev.transcript.slice(0,500),turn:s.turnNumber || 0};flushSpokenVisual(s);}
        }
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
      if(!s.childSpeaking){s.playbackSuppressed=Boolean(s.localVisualTurn);els.remoteAudio.muted=Boolean(s.localVisualTurn);}
      if(!s.localVisualTurn)childUI?.onResponseStarted();
      if(!s.localVisualTurn)els.miniText.textContent = '';
      if(!s.localVisualTurn)setStatus('Mini is preparing a reply…', 'thinking');
      break;
    case 'response.audio_transcript.delta':
      if (typeof ev.delta === 'string') s.replyTranscript = ((s.replyTranscript || '') + ev.delta).slice(-1800);
      if(!s.localVisualTurn)els.miniText.textContent += ev.delta || '';
      if(!s.localVisualTurn && !s.reactionPlayed && /[.!?。！？]/.test(s.replyTranscript || '')) {
        s.pendingReaction=s.replyTranscript;
        if(s.playbackActive){childUI?.reactToMiniSpeech?.(s.pendingReaction);s.reactionPlayed=true;}
      }
      break;
    case 'response.audio_transcript.done':
      if (typeof ev.transcript === 'string' && ev.transcript.trim()) s.replyTranscript = ev.transcript.slice(-1800);
      if(!s.localVisualTurn)els.miniText.textContent = ev.transcript || els.miniText.textContent || '—';
      s.visualSpokenReply=s.replyTranscript || s.replyTextBackup || '';flushSpokenVisual(s);
      // Only paint a playful expression; this never changes model requests.
      s.pendingReaction=ev.transcript;
      if(!s.localVisualTurn && s.playbackActive && !s.reactionPlayed){childUI?.reactToMiniSpeech?.(ev.transcript);s.reactionPlayed=true;}
      break;
    case 'response.text.delta':
      if (typeof ev.delta === 'string') s.replyTextBackup = ((s.replyTextBackup || '') + ev.delta).slice(-1800);
      break;
    case 'response.text.done':
      if (typeof ev.text === 'string' && ev.text.trim()) s.replyTextBackup = ev.text.slice(-1800);
      s.visualSpokenReply=s.replyTranscript || s.replyTextBackup || '';flushSpokenVisual(s);
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
      s.visualSpokenReply=spokenAnswer;s.visualReplyFinished=status==='completed';
      if(s.localVisualTurn) {
        if(!s.localMoveHandled && !s.visualsEnabled && spokenAnswer)narrateVisual(spokenAnswer);
      }else {
        flushSpokenVisual(s);
        if(s.pendingVisualTurn && status==='completed' && !spokenAnswer){
          const turn=s.turnNumber || 0;clearTimeout(s.visualSyncTimer);
          s.visualSyncTimer=setTimeout(()=>{if(current===s && !s.stopped && s.pendingVisualTurn?.turn===turn && !s.visualSpokenReply){s.pendingVisualTurn=null;reportVisualFailure(s,Object.assign(new Error('The voice model did not provide a completed reply transcript to illustrate.'),{visualDiagnostic:{code:'VISUAL_SPEECH_CONTEXT'}}));}},1500);
        }
      }
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
      if(s.contextUpdatePending) {
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
    if(!s.stopped)s.senderLimited=await window.MiniCamera?.configureSender(s.videoSender,{fps:s.fps,quality:s.visionQuality});
    if (!s.stopped && !s.videoPaused) await s.videoSender.replaceTrack(s.videoOutTrack);
  }
  if (s.stopped) return;
  s.mediaReady = true;
  if(s.wantVideo){s.cameraStatsTimer=setInterval(()=>updateCameraMetrics(s),1000);updateCameraMetrics(s);}
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

async function updateCameraMetrics(s){
  if(current!==s || s.stopped || !s.mediaReady || !s.wantVideo || s.cameraStatsBusy)return;
  s.cameraStatsBusy=true;
  try{
    const stats=await window.MiniCamera?.senderStats(s.videoSender,s.pc);
    if(!stats || current!==s || s.stopped)return;
    const previous=s.cameraStats,time=Date.now();
    s.cameraActualFps=previous?Math.max(0,(stats.frames-previous.frames)*1000/Math.max(1,time-previous.time)):0;
    s.cameraStats={...stats,time};
    if(stats.bytes>0)s.videoPacketsConfirmed=true;
    render();
  }catch{}finally{s.cameraStatsBusy=false;}
}
function makeVideoTrack(s) {
  if (!s.wantVideo) return;
  const cameraTrack = s.localStream.getVideoTracks()[0];
  if (!cameraTrack) throw new Error('Camera not available');
  if (s.videoMode === 'direct') {s.videoOutTrack=cameraTrack;return;}
  try {
    const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d',{alpha:false});
    if(!ctx || typeof canvas.captureStream!=='function')throw new Error('Canvas video unavailable');
    const initial=cameraTrack.getSettings();
    let size=window.MiniCamera.frameSize(els.preview.videoWidth || initial.width,els.preview.videoHeight || initial.height,s.visionQuality);
    canvas.width=size.width;canvas.height=size.height;s.videoFrameSize=size;
    const stream=canvas.captureStream(s.fps),track=stream.getVideoTracks()[0];
    if(!track)throw new Error('No canvas video track');
    s.canvasStream=stream;s.videoOutTrack=track;
    function pump(){
      if(s.stopped)return;
      if(!s.videoPaused && els.preview.readyState>=2 && els.preview.videoWidth>0){
        size=window.MiniCamera.frameSize(els.preview.videoWidth,els.preview.videoHeight,s.visionQuality);
        if(canvas.width!==size.width || canvas.height!==size.height){canvas.width=size.width;canvas.height=size.height;s.videoFrameSize=size;}
        try{ctx.drawImage(els.preview,0,0,canvas.width,canvas.height);}catch{}
      }
      s.drawTimer=setTimeout(pump,1000/s.fps);
    }
    s.refreshVideoFrame=()=>{if(!s.stopped && !s.videoPaused && els.preview.readyState>=2){try{ctx.drawImage(els.preview,0,0,canvas.width,canvas.height);}catch{}}};
    pump();
  }catch{
    // Retain smooth capture if canvas streaming is unsupported. Pace the sender, never the camera source.
    s.videoOutTrack=cameraTrack;
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
    fps:2, videoMode:els.videoMode.value,visionQuality:els.visionQuality.value==='detail'?'detail':'balanced',
    limit:extras.durationMinutes(els.limit.value),
    silenceMs:extras.silenceDuration('balanced'),
    keepConversationGoing:true,
    vadThreshold:extras.speechThreshold(els.sensitivity.value),
    personality:'playful', language:els.language.value,
    visualsEnabled:visualCapabilities.available,
    imagesAllowed:els.pictures.checked && visualCapabilities.imagesAvailable && visualCapabilities.available,
    awarenessEnabled:els.videoToggle.checked && Boolean(window.MiniLocalAwareness),
    spokenGreetings:els.videoToggle.checked && Boolean(window.MiniLocalAwareness),
    conversationLanguage:window.MiniLanguage.resolve({preferred:els.language.value,device:navigator.languages || [navigator.language]}),
    opening:kids.getOpening(window.MiniLanguage.resolve({preferred:els.language.value,device:navigator.languages || [navigator.language]}),openingRound++),
    muted:false, videoPaused:false, channels:new Set(),
    ready:false, updateSent:false, sessionCreated:false, mediaStarted:false, mediaReady:false,
    activity:'chat', activeActivity:'chat', activityUpdatePending:false,
    userSpokeDuringMode:false, responseActive:false, childSpeaking:false,
    turnPending:false, followUpCount:0, lastChildTranscript:'', replyTranscript:'', replyTextBackup:'',
    startedAt:Date.now(),
  };
  s.activityState=s.visualsEnabled?activities.fresh():activities.fromOpening(s.opening);
  s.syncedRevision=s.activityState.revision;
  const confirmation=s.mode==='realtime'
    ? 'Start Mini for up to '+s.limit+' minutes?\n\nMicrophone: shared with Qwen.\nCamera: '+(s.wantVideo?'shared with Qwen.':'off.')+
      '\nPaid AI voice'+(s.visualsEnabled?', story and game planning':'')+' will be used.'+
      '\nPictures: '+(s.imagesAllowed?'on request, with extra image charges (up to 4).':'off.')+
      (s.awarenessEnabled?'\nCamera reactions and occasional quiet-time hellos are on.':'')+'\n\nStop ends microphone and camera capture.'
    : 'Test the microphone'+(s.wantVideo?' and camera':'')+' locally for up to '+s.limit+' minutes? No AI connection or charges. Stop ends capture.';
  if(!window.confirm(confirmation))return;
  cancelGeneratedRequest(current);generatedVisuals?.clear();
  lastVisualIssue='';
  visualActivity?.close(false);
  els.diagnostic.textContent = '';
  els.diagnostic.classList.add('hidden');
  s.endsAt = s.startedAt + s.limit * 60000;
  if (s.mode === 'realtime') s.audioMeter = extras.createVoiceMeter(els.face,{onAudibleChange:audible=>onRemoteAudio(s,audible),canHear:()=>!s.playbackSuppressed && !els.remoteAudio.muted && !els.remoteAudio.paused});
  current = s;
  loading = true;
  $('sessionEndStatus').textContent='';$('sessionEndStatus').classList.add('hidden');
  render();
  setStatus('Requesting microphone and camera permission…', 'thinking');
  try {
    s.localStream = await navigator.mediaDevices.getUserMedia({
      audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},
      video:s.wantVideo ? {facingMode:{ideal:s.facing},width:{ideal:1280},height:{ideal:720},frameRate:{ideal:30,max:30}} : false,
    });
    if (s.stopped) {s.localStream.getTracks().forEach(t => t.stop()); return;}
    s.audioInputTrack = s.localStream.getAudioTracks()[0];
    if (s.audioInputTrack) s.audioInputTrack.enabled = !s.muted;
    if (s.wantVideo) {
      els.preview.srcObject = s.localStream;
      els.preview.classList.toggle('rear', s.facing === 'environment');
      els.cameraMonitor.srcObject=s.localStream;els.cameraMonitor.classList.toggle('rear',s.facing==='environment');
      render();resumeCameraPreview(s);startAwareness(s);
    }
    if (s.stopped) return;
    s.timer = setInterval(() => updateSessionClock(s), 500);
    scheduleSessionStop(s);
    updateSessionClock(s);
    if (s.stopped) return;

    if (s.mode === 'preview') {
      s.ready = true;
      closeParentSetup();
      startAwareness(s);
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
      headers:{'Content-Type':'application/sdp','X-Robot-Access-Code':els.code.value.trim(),'X-Mini-Visuals':String(s.visualsEnabled),'X-Mini-Images':String(s.imagesAllowed),'X-Mini-Awareness':'false','X-Mini-Camera':String(s.wantVideo)},
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
  $('sessionEndStatus').textContent='Last session ended: '+reason;$('sessionEndStatus').classList.remove('hidden');
  s.awareness?.stop();s.awareness=null;els.awarenessStatus.textContent='Local camera reactions off.';
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
  clearTimeout(s.visualSyncTimer);s.pendingVisualTurn=null;s.visualSpokenReply='';s.pendingLocalNarration=null;
  cancelCompanionFollowUp(s);
  s.audioMeter?.stop();
  s.micMeter?.stop();
  clearInterval(s.cameraStatsTimer);
  clearTimeout(s.drawTimer);
  if (s.drawRaf) cancelAnimationFrame(s.drawRaf);
  for (const channel of s.channels) { try {channel.close();} catch {} }
  try {s.pc?.close();} catch {}
  s.canvasStream?.getTracks().forEach(track => track.stop());
  s.localStream?.getTracks().forEach(track => track.stop());
  s.remoteStream?.getTracks().forEach(track => track.stop());
  els.preview.pause();
  els.preview.srcObject = null;
  els.cameraMonitor.pause();els.cameraMonitor.srcObject=null;
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
  s.visualIssue='';s.visualsPaused=false;
  s.lastChildTranscript='';s.replyTranscript='';s.replyTextBackup='';s.pendingReaction='';
  // Keep this visit's choices; another session still requires parent approval.
  current = null;
  els.remaining.textContent = 'Remaining: --:--';
  els.remaining.classList.remove('warning');
  setStatus(reason, reason.includes('failed') || reason.includes('error') || reason.includes('Cannot') ? 'error' : 'idle');
  render();
  if (gentle) childUI?.onSessionEnded?.(sessionLanguage(s));
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
  s.videoPaused = !s.videoPaused;s.awareness?.interrupt?.();
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
initSavedSettings();
childUI = window.MiniChildUI?.init({
  getSession: () => current,
  getLanguage: () => sessionLanguage(),
  getReactionSounds: () => true,
  stopSession: (reason, options) => stopMini(reason, options),
  requestActivity,openParentSetup,closeParentSetup,
});
function returnToMini(){
  cancelGeneratedRequest(current);childUI?.stopSpeech();
  const s=current;if(s){cancelCompanionFollowUp(s);s.contextualFollowUp=null;}
  if(s && !s.stopped){s.pendingLocalNarration=null;generatedStateChanged(null,{deferContext:true});}
  resumeCameraPreview(s);
  const live=s?.ready && s.mode==='realtime';
  setStatus(s?.muted?'Microphone muted · Mini cannot hear you':live?'Mini is listening':s?'Local preview · no AI connection':'Mini is resting',live && !s.muted?'listening':'idle');render();
}
visualActivity=window.MiniBoard.init({
  getLanguage:()=>sessionLanguage(),
  getSession:()=>current,
  onStart:()=>{
    cancelGeneratedRequest(current);generatedVisuals?.clear();
    if(current)current.generatedVisualContext=null;
    childUI?.stopLocalPlay?.();childUI?.stopSpeech();
    closeParentSetup();
    if(!current)setStatus('Local board game · mic and camera off','idle');
  },
  onChange:game=>{
    const s=current;
    if(s && !s.stopped) {
      s.contextRefreshDeferred=false;s.activity='tictactoe';s.boardCheckpoint=game;
      s.activityState={...activities.fresh(),kind:'tictactoe',revision:(s.activityState?.revision || 0)+1};
      clearTimeout(s.contextTimer);s.contextTimer=setTimeout(()=>syncActivityContext(s),0);
      renderActivity(s);
      if(game.winner || game.lastMove?.mark==='O' || (s.localVisualTurn && !game.lastMove))narrateVisual(visualActivity.speech());
    }
    render();
  },
  onExit:returnToMini,
  onResult:winner=>childUI?.reactToMiniSpeech?.(winner==='X'?'Great job!':winner==='draw'?'Wow, we filled the board!':'Let’s try another round.'),
  onNarrate:narrateVisual,
});
generatedVisuals=window.MiniVisuals.init({
  getLanguage:()=>sessionLanguage(),
  openBoard:()=>visualActivity.open(),
  requestArtwork:requestGeneratedArtwork,
  onStart:()=>{
    visualActivity?.close(false);childUI?.stopLocalPlay?.();childUI?.stopSpeech();closeParentSetup();
    if(current){current.boardCheckpoint=null;current.generatedVisualContext=generatedVisuals.describe();}
  },
  onInteraction:choice=>{const s=current;if(s)requestGeneratedVisual(s,'Button interaction: '+JSON.stringify({id:choice.id,label:choice.label}),true,{narrate:true});},
  onStateChange:generatedStateChanged,
  onNarrate:narrateVisual,
  onExit:returnToMini,
});
els.pictures.addEventListener('change',render);
els.visualPause.addEventListener('click',toggleVisualResponses);
els.videoToggle.addEventListener('change',render);
els.awarenessPause.addEventListener('click',()=>{const s=current;if(!s)return;if(s.awareness?.isUnavailable?.()){s.awareness.stop();s.awareness=null;startAwareness(s);}else s.awareness?.toggle();});
document.addEventListener('pointerdown',()=>{interruptAwareness(current);if(current)cancelCompanionFollowUp(current);});
els.language.addEventListener('change', () => childUI?.syncLanguage());
loadConfig();
render();
childUI?.onStatus({state:'idle',online:false,running:false});

$('parentSettingsBtn').addEventListener('click',openParentSetup);
$('closeParentBtn').addEventListener('click',closeParentSetup);
$('parentSetup').addEventListener('close',()=>{els.code.value='';resumeCameraPreview();$('parentSettingsBtn').focus?.();});
els.cameraSurface.addEventListener('click',()=>resumeCameraPreview());
$('checkImageModelsBtn').addEventListener('click',async()=>{
  const button=$('checkImageModelsBtn'),label=$('imageModelCheckStatus'),code=els.code.value.trim();els.code.value='';
  if(code.length<10){label.textContent='Enter the parent access code above first (10+ characters).';return;}
  button.disabled=true;label.textContent='Reading model metadata; no image is being generated…';
  try{
    const response=await fetch('/api/parent/models',{method:'POST',credentials:'same-origin',headers:{'X-Robot-Access-Code':code},cache:'no-store'});
    const data=await response.json();
    if(!response.ok || !data.ok)throw new Error(data.error || 'Could not read model metadata.');
    label.textContent=(data.imageModels.length?'Image model IDs: '+data.imageModels.join(', ')+'. ':'No compatible image IDs were returned. ')+
      (data.configuredModel?'Configured: '+data.configuredModel+(data.configuredListed?' (listed). ':' (not in returned metadata). '):'')+data.note+
      (!data.complete?' Only part of the catalog was checked.':'');
  }catch(error){label.textContent=error.message || 'Model metadata could not be read. No image request was made.';}
  finally{button.disabled=false;}
});
