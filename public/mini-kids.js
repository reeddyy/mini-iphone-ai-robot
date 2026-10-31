// Mini Buddy: child-friendly AI-led activity instructions and safe fallback cues.
// No separate offline "game" disconnects the live microphone or model.
(function () {
  'use strict';
  const modes = Object.freeze({
    chat: {
      en: 'Let us chat!',
      zh: '一起聊天！',
      guide: 'Chat like a curious, playful little robot with a six-year-old. After the child answers, first react to their specific answer, then in the SAME spoken response ask ONE easy related question. Example child says "cat": "Cats are lovely! Do you like fluffy cats or playful kittens?" Never stop after just saying "Cool!" or "That is right!" Do not require a wake word. Wait quietly after your question.',
      fallback: {en:'Hi! I am Mini! What is your favourite animal?',zh:'你好呀！我是 Mini！你最喜欢什么动物？'},
    },
    guess: {
      en: 'Guess with Mini!',
      zh: '一起猜一猜！',
      guide: 'Lead a continuous spoken animal guessing game with a six-year-old. Give one short clue followed by a question, then WAIT for the child. When the child guesses, in the SAME spoken answer say briefly correct or not yet, then ALWAYS give the next clue and ask its question. Example child: "giraffe". You: "Yes! A giraffe! Next one has black and white stripes. What is it?" If wrong: "Good try! It has a very long neck. Can you guess again?" Never stop after merely marking the answer right or wrong. The first local clue is "Which animal has a very long neck?" (giraffe); do not repeat that clue after it was answered. Never ask the child to tap picture choices.',
      fallback: {en:'Let’s guess! Which animal has a very long neck?',zh:'一起来猜！哪种动物有长长的脖子？'},
    },
    story: {
      en: 'Make a story!',
      zh: '一起编故事！',
      guide: 'Co-create a gentle original story with the child in short spoken turns. Each time the child supplies a character, place or choice (even one word), include their choice in ONE or TWO new sentences of the story, then ALWAYS ask one simple specific question about what happens next IN THE SAME AUDIO RESPONSE. Example: "The dragon flies over a rainbow! Should it land in a forest or at a castle?" Never finish a story segment with just praise or a statement; wait after one question. The first local question is "Should our story hero be a cat or a dragon?" Include the answer in the next part.',
      fallback: {en:'Let’s make a story! Should our hero be a cat or a dragon?',zh:'我们一起编故事吧！主角是小猫还是小龙呢？'},
    },
    look: {
      en: 'Show and tell!',
      zh: '给 Mini 看看！',
      guide: 'Play turn-taking show-and-tell with a child. React briefly to what they say or to an object actually visible in the live camera, and in the SAME SPOKEN REPLY ALWAYS ask exactly one simple related follow-up question (colour, shape, what it does, or how it is used). If the camera is off, explicitly say you cannot see and ask the child to describe it; never pretend to see anything. If frames are blurry, ask for a clearer view rather than guessing. The local starter may have asked them to show a toy.',
      fallback: {en:'Show me a toy and tell me something about it!',zh:'拿一个小玩具给我看看，跟我说说它吧！'},
    },
  });
  const labels = Object.freeze({
    en: {chat:'Talk',guess:'Guess',story:'Story',look:'Show',ready:'I’m listening!',starting:'Mini is waking up…',prompting:'Mini has a question for you…',blocked:'Ask a grown-up to turn on live Mini first.',muted:'Mini’s microphone is muted. Ask a grown-up to unmute it.',queued:'Mini will switch games after finishing its turn.',error:'Could not start the game. Try saying “Mini, let’s play!”',hear:'I hear sound!',speech:'I heard you!',quiet:'Speak to Mini, near the phone.',listening:'Your turn! I’m listening.',playing:'Mini is talking…'},
    zh: {chat:'聊天',guess:'猜猜',story:'故事',look:'看看',ready:'我在听呢！',starting:'Mini 正在醒来……',prompting:'Mini 有个问题想问你……',blocked:'请大人先开启 Mini 的语音聊天。',muted:'Mini 的麦克风静音了，请大人帮忙打开。',queued:'Mini 说完话就来玩这个游戏。',error:'游戏没有开始，试试说：“Mini，一起玩！”',hear:'我听到声音啦！',speech:'我听到你说话啦！',quiet:'靠近手机和 Mini 说话吧！',listening:'轮到你啦！我在听。',playing:'Mini 正在说话……'},
  });
  function language(value) { return value === 'zh' ? 'zh' : 'en'; }
  function mode(value) { return Object.hasOwn(modes, value) ? value : 'chat'; }
  function instructions(base, value, hasCamera) {
    const selected = modes[mode(value)];
    const video = hasCamera
      ? 'Live camera is enabled. You may describe visible objects only if you can actually see them in incoming frames.'
      : 'The camera is not shared. You cannot see any objects; do not claim otherwise.';
    return [
      String(base || '').slice(0, 5000),
      video,
      selected.guide,
      'MOST IMPORTANT COMPANION RULE: Every ordinary spoken answer MUST have exactly two parts within the SAME AI reply: (1) briefly acknowledge the particular answer, whether right, wrong or unsure, and (2) ask ONE short, concrete, new question to keep the same game going. Place the question LAST, before stopping audio. This is not optional; do not finish with only praise, a verdict or a generic sign-off. The question must be answerable by a six-year-old in one or two words. Do not repeat an already-answered clue. Do not ask several questions at once. After the question, stop speaking and LISTEN rather than talking to yourself. The child can answer with one word, yes/no or Mandarin, with no wake word.',
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
    return /(?:\b(?:goodbye|bye(?:\s+mini)?|stop\s+(?:now|playing|talking)|don't\s+want\s+to\s+(?:play|talk)|no\s+more|i\s+am\s+tired|i'm\s+tired|leave\s+me\s+alone|i\s+want\s+to\s+stop)\b|再见|拜拜|不想玩|不要玩|不想聊|别说了|不玩了|停下来|我累了)/i.test(value);
  }
  function looksLikeQuestion(value) {
    if (typeof value !== 'string') return false;
    // Search near the END, not an earlier quoted question followed by a verdict.
    const tail = value.trim().slice(-145);
    if (/[?？]\s*["'”’]?\s*[.!。！]*\s*$/.test(tail)) return true;
    const last = tail.split(/[.!。！?？]/).pop().trim();
    return /(?:\b(?:what|why|who|where|which|when|how|would\s+you|do\s+you|can\s+you|could\s+you|shall\s+we|are\s+you|will\s+you|should\s+we|want\s+to|ready\s+for|tell\s+me)\b|什么|怎么|哪[个里一种]|谁|吗|呢|好不好|要不要|想不想|可以吗)/i.test(last);
  }
  function needsFollowUp(reply, child, status) {
    if (status !== 'completed' && status !== undefined && status !== null) return false;
    if (typeof reply !== 'string' || reply.trim().length < 2) return false;
    if (isChildEndingConversation(child) || isChildEndingConversation(reply)) return false;
    return !looksLikeQuestion(reply);
  }

  function getFallback(value, lang) { return modes[mode(value)].fallback[language(lang)]; }
  function getLabels(lang) { return labels[language(lang)]; }
  window.MiniKidsContent = Object.freeze({
    mode,
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
