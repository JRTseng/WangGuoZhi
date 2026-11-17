import type { StoryData } from './stories';

/**
 * 喵國的劇情（T031，Jimmy 2026-11-17：「劇情可以做設計不一樣的，比較有趣味跟耐玩性」）。
 * 解鎖的時機和汪國那一套一樣（序章＋每章），故事完全不同：
 * 汪國是新城主一路平定汪州；喵國是一群貓為了傳說中的「萬罐庫」，去把碎成十顆的「九命鈴」找回來。
 * 一路上的對手是各地的野貓幫與牠們的大貓頭目。全部原創。
 */
export const CAT_STORIES: readonly StoryData[] = [
  {
    id: 'cat-prologue',
    title: '序章　屋頂上的會議',
    unlockAfter: null,
    art: 'city',
    lines: [
      {
        speaker: null,
        text: '喵國沒有城牆，只有一片連著一片的屋頂。今晚的屋頂會議，多了一位新來的當家。',
      },
      { speaker: 'juzuo', text: '當家你好，我是橘座。先說重點：倉庫裡的罐頭，只夠吃到月底。' },
      {
        speaker: 'xiaoman',
        text: '傳說汪都底下有一座「萬罐庫」，要用九命鈴才打得開。可是鈴早就碎成十顆了。',
      },
      { speaker: 'huwen', text: '十顆就十顆！一顆一顆拍回來不就好了？' },
      {
        speaker: 'moling',
        text: '第一顆據說在西邊的落葉坡。請各位出門前把毛理好，不要丟喵國的臉。',
      },
    ],
  },
  {
    id: 'cat-ch1-first',
    title: '第一章　第一次出門',
    unlockAfter: 'luoyepo-1',
    art: 'slope',
    lines: [
      { speaker: null, text: '第一趟出門很順利，除了雪糰追著一片紅葉跑了半座山。' },
      { speaker: 'xuetuan', text: '那片葉子一直在動！我以為是鈴鐺嘛……' },
      { speaker: 'xiaoman', text: '鈴在坡頂。落葉幫的頭目是一隻石虎，白天睡覺，晚上才出來。' },
      { speaker: 'huwen', text: '那我們白天去！趁牠睡覺拍下來！' },
      { speaker: 'moling', text: '……趁貓睡覺動手，不合規矩。等牠醒。' },
    ],
  },
  {
    id: 'cat-ch1-boss',
    title: '第一章　葉影的鈴',
    unlockAfter: 'luoyepo-5',
    art: 'slope',
    lines: [
      { speaker: null, text: '石虎葉影打了個大哈欠，把掛在脖子上的小鈴拿下來，叮的一聲丟給當家。' },
      { speaker: 'juzuo', text: '牠說這顆鈴吵得牠睡不好，早就想送人了。' },
      { speaker: 'xuetuan', text: '第一顆！搖起來有魚的味道耶。' },
      { speaker: 'xiaoman', text: '那是因為第二顆在竹林渡，渡口幫天天拿它當魚鈴用。' },
    ],
  },
  {
    id: 'cat-ch2-boss',
    title: '第二章　渡口的魚鈴',
    unlockAfter: 'zhulindu-5',
    art: 'bamboo',
    lines: [
      { speaker: null, text: '漁貓江爪從水裡撈起最後一條魚，連魚帶鈴一起放在岸上。' },
      { speaker: 'huwen', text: '牠居然會游泳！貓怎麼可以會游泳！' },
      { speaker: 'juzuo', text: '江爪說魚可以分我們一半，條件是以後喵國的魚都跟牠買。成交。' },
      { speaker: 'moling', text: '第三顆在北邊的雪嶺關。請各位把肉墊的毛留長一點。' },
    ],
  },
  {
    id: 'cat-ch3-boss',
    title: '第三章　全世界最厚的毛',
    unlockAfter: 'xuelingguan-5',
    art: 'snow',
    lines: [
      {
        speaker: null,
        text: '兔猻厚毛王坐在雪地裡一動也不動。大家找了半天，原來鈴就埋在牠的毛裡。',
      },
      { speaker: 'xuetuan', text: '我把整隻手伸進去都還摸不到底……' },
      { speaker: 'xiaoman', text: '牠不是不還，是自己也找不到。' },
      {
        speaker: 'juzuo',
        text: '三顆了。厚毛王說過了關往南是桃花谷，那裡的花貓黨最愛漂亮的東西。',
      },
    ],
  },
  {
    id: 'cat-ch4-boss',
    title: '第四章　桃花樹上的長腿',
    unlockAfter: 'taohuagu-5',
    art: 'peach',
    lines: [
      { speaker: null, text: '藪貓長腿桃把鈴掛在最高的那根樹枝上，然後一跳就摘了下來。' },
      { speaker: 'huwen', text: '我跳了十次都搆不到，牠一次就……不公平，牠腿那麼長！' },
      { speaker: 'moling', text: '牠願意把鈴交出來，但要我們每年春天來陪牠看花。我替各位答應了。' },
    ],
  },
  {
    id: 'cat-ch5-boss',
    title: '第五章　沙子裡的大耳朵',
    unlockAfter: 'huangshadao-5',
    art: 'desert',
    lines: [
      { speaker: null, text: '沙丘貓沙耳把耳朵貼在沙上聽了一會兒，往下挖了三下，鈴就出來了。' },
      { speaker: 'xiaoman', text: '牠聽得到沙子底下的聲音。難怪我們怎麼偷襲都被發現。' },
      { speaker: 'xuetuan', text: '我的腳掌好燙……下一顆可以在涼一點的地方嗎？' },
      { speaker: 'juzuo', text: '可以。下一顆在霧沼澤，又涼又濕。' },
      { speaker: 'xuetuan', text: '……我收回剛剛那句話。' },
    ],
  },
  {
    id: 'cat-ch6-boss',
    title: '第六章　霧裡的鬍鬚',
    unlockAfter: 'wuzhaoze-5',
    art: 'marsh',
    lines: [
      { speaker: null, text: '山貓霧鬚從霧裡走出來，耳朵尖上的毛沾滿了水珠。' },
      { speaker: 'moling', text: '牠說這片沼澤沒有貓走得出去，我們是第一批。所以鈴歸我們。' },
      { speaker: 'huwen', text: '其實是小滿躲在箱子裡，一路叫我們左轉右轉的。' },
      { speaker: 'xiaoman', text: '……箱子很重要。' },
    ],
  },
  {
    id: 'cat-ch7-boss',
    title: '第七章　爐邊最好的位置',
    unlockAfter: 'chiyanling-5',
    art: 'volcano',
    lines: [
      { speaker: null, text: '獰貓赤耳佔著火爐邊最暖的那塊石頭，第七顆鈴被牠拿來當門鈴。' },
      { speaker: 'juzuo', text: '談好了：鈴給我們，那塊石頭還是牠的。牠只在乎石頭。' },
      { speaker: 'xuetuan', text: '我可以再烤一下肚子再走嗎？一下下就好。' },
    ],
  },
  {
    id: 'cat-ch8-boss',
    title: '第八章　魚市收攤',
    unlockAfter: 'bihaiwan-5',
    art: 'coast',
    lines: [
      { speaker: null, text: '雲豹浪紋甩了甩尾巴上的海水，把秤魚用的那顆鈴從秤桿上解下來。' },
      { speaker: 'huwen', text: '牠的尾巴比我整隻還長！被掃到一下我飛了三艘船遠！' },
      { speaker: 'xiaoman', text: '八顆了。剩下兩顆，一顆在雲頂棧，一顆在汪都。' },
      { speaker: 'moling', text: '越靠近萬罐庫，守鈴的越認真。請各位今晚早點睡。' },
    ],
  },
  {
    id: 'cat-ch9-boss',
    title: '第九章　雲上的腳印',
    unlockAfter: 'yundingzhan-5',
    art: 'cloud',
    lines: [
      {
        speaker: null,
        text: '雪豹凌雲站在吊橋的另一頭，咬著自己的大尾巴看了我們很久，才把路讓開。',
      },
      { speaker: 'juzuo', text: '牠說牠守的不是鈴，是看看有沒有貓真的願意一路走到這裡。' },
      { speaker: 'xuetuan', text: '九顆搖起來好好聽……可是還少一個音。' },
    ],
  },
  {
    id: 'cat-ch10-boss',
    title: '第十章　萬罐庫的門',
    unlockAfter: 'wangdu-5',
    art: 'palace',
    lines: [
      {
        speaker: null,
        text: '白虎九命王把最後一顆鈴放進當家手裡。十顆鈴一起響，地底的大門慢慢打開。',
      },
      {
        speaker: null,
        text: '裡面沒有堆成山的罐頭，只有一口鍋、一張很長很長的桌子，和夠坐下所有貓的位子。',
      },
      {
        speaker: 'xiaoman',
        text: '原來萬罐庫裝的不是罐頭，是位子。以前的貓留下來的，是一起吃飯的地方。',
      },
      { speaker: 'juzuo', text: '那就開飯吧。一路上遇到的，通通叫來。' },
      { speaker: 'huwen', text: '我去叫！石虎、漁貓、那個毛很厚的——全部叫來！' },
      { speaker: 'moling', text: '當家，聽說對面汪國的城主也到汪都了。要不要多擺幾副碗筷？' },
    ],
  },
];
