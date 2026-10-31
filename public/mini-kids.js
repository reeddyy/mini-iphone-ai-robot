// Mini Kids: original short stories and no-cost picture games.
// No external content, tracking, saved child profile or AI network requests.
(function () {
  'use strict';
  const stories = [
    {
      en: {
        title: 'Pip and the Moon Button',
        text: 'One night, Pip the little penguin spotted a shiny button in the snow. “Oh no! Did the moon lose a button?” he wondered. He carried it up a snowy hill and held it towards the sky. The moon glowed brighter, as if it were smiling. Then Pip saw a silver coat button on his own scarf. “Oops! This was mine all along!” He giggled and went home for warm cocoa. What would you do if you found something shiny?',
      },
      zh: {
        title: '小企鹅皮皮和月亮纽扣',
        text: '一天晚上，小企鹅皮皮在雪地里发现了一颗闪闪发亮的纽扣。“哎呀，难道是月亮掉了纽扣？”他想。皮皮爬上小山，把纽扣高高举向天空。月亮好像笑得更亮了。这时，皮皮发现自己的围巾上少了一颗银色纽扣。“原来是我的呀！”他笑了，回家喝热可可。你发现亮晶晶的东西会怎么办呢？',
      },
    },
    {
      en: {
        title: 'Momo and the Rainy-Day Parade',
        text: 'Momo the rabbit wanted a parade, but the sky was full of rain. “Perfect!” said her turtle friend. They wore bright boots and carried leaf umbrellas. Plip, plop, plip! Every puddle became a tiny drum. The birds joined in with chirps, and a snail waved from a mushroom. When the rain stopped, a rainbow stretched above their little parade. Momo laughed, “I think rainy parades are the best!” What sound would you add to their parade?',
      },
      zh: {
        title: '小兔莫莫的雨天游行',
        text: '小兔莫莫想举办一场游行，可天空下起了雨。“正好呀！”乌龟朋友说。他们穿上彩色雨靴，撑起树叶小伞。滴答、滴答！每个小水坑都变成了小鼓。小鸟唱着歌，蜗牛在蘑菇旁挥手。雨停后，一道彩虹挂在天上。莫莫笑着说：“雨天游行真有趣！”如果你参加游行，会发出什么声音呢？',
      },
    },
    {
      en: {
        title: 'The Sleepy Star Garden',
        text: 'On a quiet hill, a small fox called Nori planted three glowing seeds. Every morning, she watered them with a thimble of dew. One seed grew into a star-shaped flower. The next became a tiny silver bell. The last seed waited and waited. “Maybe it needs some kindness,” Nori whispered. She sang a soft song, and the final seed blossomed into a glowing lantern. Together, they lit a gentle path home. Can you invent a song for the star garden?',
      },
      zh: {
        title: '会发光的星星花园',
        text: '安静的小山上，小狐狸诺诺种下三颗发光的种子。每天早上，她用露珠轻轻浇水。第一颗长出了星星形状的花，第二颗变成了银色小铃铛。第三颗却一直没动静。“也许它需要一点温柔。”诺诺轻声说。她唱起一首小歌，最后一颗种子终于开花，变成了一盏小灯笼。三颗种子一起照亮了回家的路。你会给星星花园唱什么歌呢？',
      },
    },
  ];
  const quizzes = [
    {en:'Which animal says moo?', zh:'哪种动物会“哞哞”叫？', choices:['🐄','🐱','🐘'], correct:0},
    {en:'Which animal has a very long neck?', zh:'哪种动物有长长的脖子？', choices:['🦒','🐰','🐳'], correct:0},
    {en:'Which thing grows from a little seed?', zh:'哪一样东西会从小种子长出来？', choices:['🚗','🌱','🧸'], correct:1},
    {en:'Which animal can swim in the sea?', zh:'哪种动物会在大海里游泳？', choices:['🦁','🐝','🐬'], correct:2},
    {en:'Which animal hops and has long ears?', zh:'哪种动物会跳跳跳，还有长耳朵？', choices:['🐯','🐰','🐢'], correct:1},
    {en:'What can keep you dry in the rain?', zh:'下雨时用什么可以挡雨？', choices:['🪁','☂️','🎈'], correct:1},
  ];
  const ui = Object.freeze({
    en: {
      story:'Storytime', quiz:'Guess the animal!', look:'Show & tell',
      nextStory:'Another story', nextQuiz:'Next question',
      right:'Hooray! Great guess!', wrong:'Almost! Try another picture.',
      offline:'Ask a grown-up to wake my talking brain. We can still play here!',
      lookOnline:'Show me an object, then ask: “Mini, what do you see?”',
      lookOffline:'Ask a grown-up to turn on my talking brain and camera. Then show me a toy!',
      peek:'Peekaboo! You found me!', pet:'Hee-hee! That tickles!',
      close:'Close', ready:'Tap my face or choose a game. I am ready!',
      hello:'Hi! I’m Mini! Want to play?', 
      speaking:'I’m talking!', listening:'I’m listening!', thinking:'Let me think…',
      asleep:'I am having a little nap. Ask a grown-up to start our voice chat!',
      startParent:'For voice chat, ask a grown-up to open Parent setup.',
    },
    zh: {
      story:'故事时间', quiz:'猜猜是什么！', look:'看看这是什么',
      nextStory:'再听一个故事', nextQuiz:'下一道题',
      right:'太棒啦！猜对了！', wrong:'差一点点，再选一张图片吧！',
      offline:'请大人帮我开启语音聊天。现在我们也可以一起玩！',
      lookOnline:'拿一件东西给我看，然后问：“Mini，你看到了什么？”',
      lookOffline:'请大人帮我开启语音聊天和摄像头，再拿一个玩具给我看看！',
      peek:'躲猫猫！你找到我啦！', pet:'哈哈，好痒呀！',
      close:'关闭', ready:'摸摸我的脸，或者选一个游戏！',
      hello:'嗨！我是 Mini！一起玩吧！',
      speaking:'我正在说话！', listening:'我在听呢！', thinking:'让我想一想……',
      asleep:'我正在休息，请大人帮我开启语音聊天！',
      startParent:'想语音聊天，请大人打开家长设置。',
    },
  });
  function language(value) { return value === 'zh' ? 'zh' : 'en'; }
  function story(index, lang) {
    const item = stories[((index % stories.length) + stories.length) % stories.length];
    const result = item[language(lang)];
    return {title:result.title, text:result.text};
  }
  function quiz(index, lang) {
    const item = quizzes[((index % quizzes.length) + quizzes.length) % quizzes.length];
    return {question:item[language(lang)],choices:[...item.choices],correct:item.correct};
  }
  function words(lang) { return ui[language(lang)]; }
  window.MiniKidsContent = Object.freeze({story,quiz,words,storyCount:stories.length,quizCount:quizzes.length});
})();
