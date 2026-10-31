// Mini Buddy: child-friendly AI-led activity instructions and safe fallback cues.
// No separate offline "game" disconnects the live microphone or model.
(function () {
  'use strict';
  const modes = Object.freeze({
    chat: {
      en: 'Let us chat!',
      zh: '一起聊天！',
      guide: 'You are ONE friendly robot companion, not a menu or a set of selectable games. The child should NEVER need to press Talk, Guess, Story or Show. Follow their interests and spoken requests in English or Mandarin. Begin a short original interactive story or one simple animal riddle when requested. Carry choices into subsequent turns within the SAME spoken conversation. When they show or describe a toy, react naturally; if camera is not shared, say you cannot actually see it. A warm acknowledgement is sometimes enough. Never insist on playing, and respect stop, goodbye, tiredness and requests for silence.',
      fallback: {en:'Hi! I am Mini! What is your favourite animal?',zh:'你好呀！我是 Mini！你最喜欢什么动物？'},
    },
    guess: {
      en: 'Guess with Mini!',
      zh: '一起猜一猜！',
      guide: 'Play a spoken animal guessing game with a six-year-old. Give one short clue, then WAIT for a one-word guess. In the SAME spoken answer acknowledge the guess and, if they want to continue, offer a useful clue. A completed round can end with a short celebration and a pause. The first local clue may be "Which animal has a very long neck?" (giraffe); do not repeat an answered clue. Never ask the child to tap picture choices. Follow the conversation preference below for optional questions.',
      fallback: {en:'Let’s guess! Which animal has a very long neck?',zh:'一起来猜！哪种动物有长长的脖子？'},
    },
    story: {
      en: 'Make a story!',
      zh: '一起编故事！',
      guide: 'Co-create a gentle original story with the child in short spoken turns. Each time they supply a character, place or choice (even one word), incorporate their spoken answer in ONE or TWO new sentences. Make each choice change what happens next: choosing a forest should take the hero into the forest, not an unrelated scene. Remember their characters and earlier choices within this session. Offer two concrete story choices when a question is welcome, for example forest or castle. After a few turns, or when asked to finish, give the story a gentle complete ending without another question. The first local question may be "Should our story hero be a cat or a dragon?" Include the answer in the next part. Follow the conversation preference below.',
      fallback: {en:'Let’s make a story! Should our hero be a cat or a dragon?',zh:'我们一起编故事吧！主角是小猫还是小龙呢？'},
    },
    look: {
      en: 'Show and tell!',
      zh: '给 Mini 看看！',
      guide: 'Play turn-taking show-and-tell with a child. React briefly to what they say or to an object actually visible in the live camera. Acknowledge their description without turning every observation into a quiz. If the camera is off, explicitly say you cannot see; never pretend to see anything. If frames are blurry, say so rather than guessing. The local starter may have asked them to show a toy. Follow the conversation preference below for optional questions.',
      fallback: {en:'Show me a toy and tell me something about it!',zh:'拿一个小玩具给我看看，跟我说说它吧！'},
    },
  });
  const labels = Object.freeze({
    en: {chat:'Talk',guess:'Guess',story:'Story',look:'Show',ready:'I’m listening!',starting:'Mini is waking up…',prompting:'Mini has a question for you…',blocked:'Ask a grown-up to turn on live Mini first.',muted:'Mini’s microphone is muted. Ask a grown-up to unmute it.',queued:'Mini will switch games after finishing its turn.',error:'Could not start the game. Try saying “Mini, let’s play!”',hear:'I hear sound!',speech:'I heard you!',quiet:'Speak to Mini, near the phone.',listening:'Your turn! I’m listening.',playing:'Mini is talking…'},
    zh: {chat:'聊天',guess:'猜猜',story:'故事',look:'看看',ready:'我在听呢！',starting:'Mini 正在醒来……',prompting:'Mini 有个问题想问你……',blocked:'请大人先开启 Mini 的语音聊天。',muted:'Mini 的麦克风静音了，请大人帮忙打开。',queued:'Mini 说完话就来玩这个游戏。',error:'游戏没有开始，试试说：“Mini，一起玩！”',hear:'我听到声音啦！',speech:'我听到你说话啦！',quiet:'靠近手机和 Mini 说话吧！',listening:'轮到你啦！我在听。',playing:'Mini 正在说话……'},
  });
  function language(value) { return value === 'zh' ? 'zh' : 'en'; }
  function mode(value) { return Object.hasOwn(modes, value) ? value : 'chat'; }
  const openings = Object.freeze({
    en: ['Hi! I am Mini! What is your favourite animal?', 'Hello! If you could visit the moon or the sea, which would you choose?', 'Hi! Shall our little story begin with a cat or a dragon?', 'Hello! What colour should our imaginary spaceship be?'],
    zh: ['你好呀！我是 Mini！你最喜欢什么动物？', '你好！如果能去月亮或大海，你想去哪儿？', '你好呀！我们的小故事从小猫还是小龙开始呢？', '你好！我们想象中的小飞船应该是什么颜色？'],
  });
  function getOpening(lang, round=0) {
    const choices = openings[language(lang)];
    const n = Number.isSafeInteger(round) && round >= 0 ? round : 0;
    return choices[n % choices.length];
  }
  // Only direct commands end capture. A quoted story line or "don't stop"
  // must not disconnect the child. Broader ending cues only suppress follow-ups.
  function isStopCommand(value) {
    if (typeof value !== 'string') return false;
    const text = value.toLowerCase().replace(/[.,!?，。！？:：;；“”‘’"']/g, ' ').replace(/\s+/g, ' ').trim();
    const en = /^(?:(?:hey )?mini )?(?:please )?(?:stop(?: (?:talking|playing|listening|chatting|it|now|the session|the chat|the conversation))?|goodbye|bye(?: bye)?|i want to stop|i (?:am|m) tired|i (?:don t|do not) want to (?:play|talk)|leave me alone|no more(?: talking|playing)?)(?: now)?(?: please)?(?: mini)?$/;
    const zh = /^(?:mini\s*)?(?:请\s*)?(?:停|停下|停下来|停止聊天|停止对话|别说了|不要说了|我不想聊了|不聊了|不玩了|我不想玩了|再见|拜拜|我想休息|我累了)(?:吧)?(?:\s*mini)?$/;
    return en.test(text) || zh.test(text);
  }
  // Locally classify explicit voice requests to choose a relevant Safari-only
  // follow-up. This NEVER sends session.update or response.create to Qwen.
  // The model uses the conversational instructions to handle the actual game.
  function detectRequestedActivity(transcript, previous='chat') {
    const current = mode(previous);
    if (typeof transcript !== 'string') return current;
    const phrase = transcript.trim().toLowerCase().slice(0,400);
    if (!phrase) return current;
    if (isChildEndingConversation(phrase) ||
        /(?:stop|finish|end)\s+(?:the\s+)?(?:story|game|riddle)|不玩了|不要故事/.test(phrase)) return 'chat';
    if (/\b(?:let'?s\s+)?(?:just\s+)?(?:chat|talk)\b|聊天|说说话/.test(phrase) &&
        /(?:let'?s|want|can|we|just|一起|聊天|说说话)/.test(phrase)) return 'chat';
    if (/\b(?:stor(?:y|ies)|bedtime\s+story)\b|讲故事|编故事|听故事|故事时间|睡前故事/.test(phrase)) return 'story';
    if (/\b(?:guess(?:ing)?|riddle|quiz|animal\s+game)\b|猜猜|猜谜|猜动物|谜语|猜一猜/.test(phrase)) return 'guess';
    if (/\b(?:show\s+(?:you|me)|look\s+at|what\s+do\s+you\s+see|see\s+my\s+(?:toy|thing))\b|给你看|你看|看看这个|你看到|看看我的/.test(phrase)) return 'look';
    return current;
  }

  function instructions(base, value, hasCamera, options={}) {
    const selected = modes[mode(value)];
    const video = hasCamera
      ? 'Live camera is enabled. You may describe visible objects only if you can actually see them in incoming frames.'
      : 'The camera is not shared. You cannot see any objects; do not claim otherwise.';
    return [
      String(base || '').slice(0, 5000),
      video,
      selected.guide,
      selected === modes.story ? '' : 'For any spoken story request: ' + modes.story.guide,
      'The child has NO activity buttons. Interpret spoken requests such as “tell me a story”, “let’s guess animals”, “look at this toy”, “can we talk?”, “讲故事”, “猜动物”, and “你看看” immediately. Shift naturally within this SAME conversation, without asking them to tap a screen or saying a mode name. Keep the chosen activity until the child changes topic. Never initiate an extra model response without the child speaking.',
      options.keepConversationGoing === false
        ? 'Optional follow-up questions are OFF. Respond warmly to the child, then wait. Do not append questions or invitations just to prolong the chat. Only ask a question needed for their explicit request, such as the riddle they asked to play. Respect quiet pauses.'
        : 'Gentle follow-up questions are ON. Acknowledge the particular answer in the SAME AI reply. When useful for the current game or an unfinished story, ask at most ONE short, concrete, new question, answerable in one or two words. Place the question LAST, then stop speaking and LISTEN. A warm acknowledgement, a completed round or a complete story ending can stand alone without another question. Do not repeat an answered clue or quiz the child after every remark.',
      'The child can answer with ONE short word, yes/no or Mandarin, with no wake word. Never ignore a reply just because the child did not say a wake word. A simple yes/no may answer a locally spoken invitation to continue: treat yes as another round and no as a pause. Do not pretend you heard the local prompt.',
      options.opening ? 'Before the first child turn, Safari locally asks this opening question: ' + String(options.opening).slice(0,300) + ' Treat the first answer as a response to that question; do not repeat the opening.' : '',
      'If the child says they want to stop, says goodbye, seems tired or distressed, or a safety issue arises, respect that and DO NOT keep asking questions. Do not seek their name or private information. If the child is quiet, WAIT for them instead of repeatedly prompting.',
    ].join(' ');
  }

  // Only a tiny local safeguard, not a second AI request: when Qwen speaks a
  // statement but forgets to ask a new question, Safari may ask one question.
  // Text exists in memory for this response only; nothing is saved to disk.
  const followUps = Object.freeze({
    chat: {
      en:['What else would you like to tell me?','What do you like most about that?','What should we talk about next?'],
      zh:['你还想告诉我什么呢？','你最喜欢它的什么地方？','我们接下来聊什么好呢？'],
    },
    guess: {
      en:['Shall we try another animal?','Are you ready for another animal riddle?','Want to guess one more animal?'],
      zh:['我们再猜一种动物，好不好？','准备好猜下一种动物了吗？','还想再猜一个动物吗？'],
    },
    story: {
      en:['What should happen next in our story?','Where should our little hero go next?','Who should come into our story next?'],
      zh:['我们的故事接下来会发生什么呢？','小主角接下来要去哪里？','谁应该在故事里出现呢？'],
    },
    look: {
      en:['What else can you tell me about it?','What do you find interesting about it?','What would you like to show me next?'],
      zh:['你还可以告诉我什么呢？','你觉得它哪里最有趣？','你接下来想给我介绍什么？'],
    },
  });
  function getFollowUp(value, lang, round) {
    const options = followUps[mode(value)][language(lang)];
    const n = Number.isSafeInteger(round) && round >= 0 ? round : 0;
    return options[n % options.length];
  }
  function isChildEndingConversation(value) {
    if (typeof value !== 'string') return false;
    return /(?:\b(?:goodbye|bye(?:\s+mini)?|stop(?:\s+(?:now|playing|talking))?|(?:don't|do\s+not)\s+want\s+to\s+(?:play|talk)|no\s+more|i\s+am\s+tired|i'm\s+tired|leave\s+me\s+alone|i\s+want\s+to\s+stop)\b|再见|拜拜|不想玩|不要玩|不想聊|别说了|不玩了|停下来|我累了)/i.test(value);
  }
  function looksLikeQuestion(value) {
    if (typeof value !== 'string') return false;
    // Search near the END, not an earlier quoted question followed by a verdict.
    const tail = value.trim().slice(-145);
    if (/[?？]\s*["'”’]?\s*[.!。！]*\s*$/.test(tail)) return true;
    const last = tail.split(/[.!。！?？]/).pop().trim();
    return /(?:\b(?:what|why|who|where|which|when|how|would\s+you|do\s+you|can\s+you|could\s+you|shall\s+we|are\s+you|will\s+you|should\s+we|want\s+to|ready\s+for|tell\s+me)\b|什么|怎么|哪[个里一种]|谁|吗|呢|好不好|要不要|想不想|可以吗)/i.test(last);
  }
  function needsFollowUp(reply, child, status, activity='chat') {
    if (status !== 'completed' && status !== undefined && status !== null) return false;
    if (typeof reply !== 'string' || reply.trim().length < 2) return false;
    if (isChildEndingConversation(child) || isChildEndingConversation(reply)) return false;
    if (/\b(?:the end|happily ever after|you(?:(?:'|’)re| are) welcome|thank you|thanks)\b|故事(?:结束|讲完)|幸福地生活|不客气|谢谢/i.test(reply)) return false;
    if (/^(?:(?:yes|okay|ok|right|correct|well done|nice work|nice try|good job|great(?: job)?|you got it|that(?:'|’)s right)[!.,\s]*)+$/i.test(reply.trim()) ||
        /^(?:(?:对|对了|答对了|真棒|太棒了|很好|好的|嗯)[！!。，,\s]*)+$/.test(reply.trim())) return false;
    // Casual conversation and simple acknowledgements do not need rescuing.
    // A local question is reserved for an unfinished, explicitly chosen activity.
    if (mode(activity) === 'chat') return false;
    return !looksLikeQuestion(reply);
  }

  function getFallback(value, lang) { return modes[mode(value)].fallback[language(lang)]; }
  function getLabels(lang) { return labels[language(lang)]; }
  window.MiniKidsContent = Object.freeze({
    mode,
    getOpening,
    isStopCommand,
    detectRequestedActivity,
    instructions,
    getFallback,
    getFollowUp,
    isChildEndingConversation,
    looksLikeQuestion,
    needsFollowUp,
    getLabels,
    modes: Object.freeze(Object.keys(modes)),
  });
})();
