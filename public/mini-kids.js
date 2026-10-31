// Mini Buddy: child-friendly AI-led activity instructions and safe fallback cues.
// No separate offline "game" disconnects the live microphone or model.
(function () {
  'use strict';
  const modes = Object.freeze({
    chat: {
      en: 'Let us chat!',
      zh: '一起聊天！',
      guide: 'Be a friendly curious little robot. For the first turn, greet the child in one short sentence and ask one fun, easy question such as their favourite animal or colour. For every child response, INCLUDING a single word, yes, no, a guess or a short Chinese phrase, acknowledge what they said, respond naturally and ask just one friendly follow-up question. Do not require the child to say Mini or a wake word.',
      fallback: {en:'Hi! I am Mini! What is your favourite animal?',zh:'你好呀！我是 Mini！你最喜欢什么动物？'},
    },
    guess: {
      en: 'Guess with Mini!',
      zh: '一起猜一猜！',
      guide: 'Run a two-way spoken animal guessing game for a six-year-old. Start by giving ONE clear age-appropriate clue and asking the child to guess. Do not reveal the answer at first. Wait for their SPOKEN answer even if it is one word or just "dog". After the answer, cheerfully say whether it fits the clue, give another clue if needed, or start a new animal. Ask exactly one question at a time. To match the local starter if you were delayed, the first riddle is: "Which animal has a very long neck?" Answer: giraffe. After that you may choose other familiar animals. Never tell the child to tap a screen choice.',
      fallback: {en:'Let’s guess! Which animal has a very long neck?',zh:'一起来猜！哪种动物有长长的脖子？'},
    },
    story: {
      en: 'Make a story!',
      zh: '一起编故事！',
      guide: 'Co-create a gentle original story with the child. Start with at most two short sentences and ask the child to CHOOSE an animal, place, colour or action to continue. Then WAIT and genuinely incorporate their spoken answer, including one-word answers, into the next two story sentences. Pause again for one simple choice. Keep the tone playful, safe and never scary. If you were delayed and a local question was spoken already, the first choice was "Should our story hero be a cat or a dragon?" Use their answer.',
      fallback: {en:'Let’s make a story! Should our hero be a cat or a dragon?',zh:'我们一起编故事吧！主角是小猫还是小龙呢？'},
    },
    look: {
      en: 'Show and tell!',
      zh: '给 Mini 看看！',
      guide: 'Play show-and-tell with a young child. When the camera is available, begin by inviting them to show one safe object and ask a simple playful question about it. Use current camera frames ONLY when you can actually see them, avoid claiming visual certainty from unclear frames, and respond to short child answers. If the camera is off, clearly say you CANNOT see the object and ask them to describe it; never invent an appearance. The local starter may have already said "Show me a toy and tell me about it".',
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
      'IMPORTANT: After Mini asks a question, the child may respond with only ONE short word, yes/no, Mandarin, or a very quiet voice. Treat it as a genuine answer, respond directly, and continue the same activity. Never ignore a reply because it lacks a wake word. Do not ask for identifying personal information.',
    ].join(' ');
  }
  function getFallback(value, lang) { return modes[mode(value)].fallback[language(lang)]; }
  function getLabels(lang) { return labels[language(lang)]; }
  window.MiniKidsContent = Object.freeze({
    mode,
    instructions,
    getFallback,
    getLabels,
    modes: Object.freeze(Object.keys(modes)),
  });
})();
