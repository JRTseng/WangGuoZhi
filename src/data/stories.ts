import type { RegionScene } from './regions';

/**
 * 劇情：過特定關卡後解鎖，第一次會自動播放，之後可在「劇情」重看。
 * 每段 = 一張情境圖（佔位圖用程式畫）+ 幾句對話。全部原創。
 */
export interface StoryLine {
  /** 說話的狗狗 id（對應 DOGS），旁白用 null */
  speaker: string | null;
  text: string;
}

export interface StoryData {
  id: string;
  title: string;
  /** 打過這一關後解鎖；null 代表一開始就能看 */
  unlockAfter: string | null;
  /** 情境圖的場景 */
  art: RegionScene | 'city';
  lines: readonly StoryLine[];
}

export const STORIES: readonly StoryData[] = [
  {
    id: 'prologue',
    title: '序章\u3000新城主上任',
    unlockAfter: null,
    art: 'city',
    lines: [
      { speaker: null, text: '汪州大亂，各地狗狗各據一方。邊境的小城，迎來了一位新城主。' },
      { speaker: 'daer', text: '城主您好！我是大耳，以後城裡的大小事就交給我們吧。' },
      { speaker: 'heixuan', text: '廢話少說！什麼時候出去打一場？我的爪子癢死了！' },
      { speaker: 'xiaosuan', text: '先從西邊的落葉坡練練兵，糧草夠了再說。' },
    ],
  },
  {
    id: 'ch1-first',
    title: '第一章\u3000初次出征',
    unlockAfter: 'luoyepo-1',
    art: 'slope',
    lines: [
      { speaker: null, text: '第一支隊伍從坡腳小徑平安歸來，背上還沾著紅葉。' },
      { speaker: 'abai', text: '路邊撿到好多糧草！今天可以多吃一碗嗎？' },
      { speaker: 'changxu', text: '別大意。坡頂有個哨站，聽說有隻很兇的高山犬在看守。' },
    ],
  },
  {
    id: 'ch1-boss',
    title: '第一章\u3000雷吼退兵',
    unlockAfter: 'luoyepo-5',
    art: 'slope',
    lines: [
      { speaker: null, text: '高山犬雷吼的吼聲震落了整片紅葉，最後還是讓開了山路。' },
      { speaker: 'daer', text: '雷吼說，往東的竹林渡有江上的船隊，糧草多得吃不完。' },
      { speaker: 'heixuan', text: '那還等什麼！出發！' },
    ],
  },
  {
    id: 'ch2-boss',
    title: '第二章\u3000竹林的巨影',
    unlockAfter: 'zhulindu-5',
    art: 'bamboo',
    lines: [
      { speaker: null, text: '霧散之後，大家才看清楚巨影的樣子：一隻溫柔的大丹犬。' },
      { speaker: 'xiaosuan', text: '他說北方雪嶺關的守關獒王，連他都不敢靠近。' },
      { speaker: 'changxu', text: '越難的關，越值得一闖。' },
    ],
  },
  {
    id: 'ch3-boss',
    title: '第三章\u3000鎮嶺王',
    unlockAfter: 'xuelingguan-5',
    art: 'snow',
    lines: [
      { speaker: null, text: '風雪停了。藏獒鎮嶺王低下頭，把關口的鑰匙交給了城主。' },
      { speaker: 'daer', text: '城主，汪州的北門打開了。我們的故事，才正要開始。' },
    ],
  },
  // ---- 第四章起（T018）：每章打倒 Boss 後一段 ----
  {
    id: 'ch4-boss',
    title: '第四章\u3000花嶽讓路',
    unlockAfter: 'taohuagu-5',
    art: 'peach',
    lines: [
      { speaker: null, text: '桃花落了一地。伯恩山犬花嶽甩甩身上的花瓣，慢慢坐了下來。' },
      { speaker: 'abai', text: '他說谷裡的桃子隨便我們摘！可以先吃一顆嗎？' },
      { speaker: 'xiaosuan', text: '往西是黃沙道，商隊的糧草都卡在那裡。帶夠水再走。' },
    ],
  },
  {
    id: 'ch5-boss',
    title: '第五章\u3000沙牙的商路',
    unlockAfter: 'huangshadao-5',
    art: 'desert',
    lines: [
      { speaker: null, text: '風沙停了，坎高犬沙牙把搶來的糧車一輛一輛推了回來。' },
      { speaker: 'changxu', text: '他原本是護送商隊的，只是太久沒有人付他工錢。' },
      { speaker: 'daer', text: '以後商路就交給他看著吧。我們往南，穿過霧沼澤。' },
    ],
  },
  {
    id: 'ch6-boss',
    title: '第六章\u3000霧裡的鼻子',
    unlockAfter: 'wuzhaoze-5',
    art: 'marsh',
    lines: [
      { speaker: null, text: '尋血獵犬玄霧聞了聞城主的手，尾巴終於搖了一下。' },
      { speaker: 'heixuan', text: '這傢伙在霧裡比我還會找路，不服不行。' },
      { speaker: 'xiaosuan', text: '他聞到東邊有煙味。赤焰嶺的鐵匠村出事了。' },
    ],
  },
  {
    id: 'ch7-boss',
    title: '第七章\u3000炎錘收工',
    unlockAfter: 'chiyanling-5',
    art: 'volcano',
    lines: [
      { speaker: null, text: '羅威那炎錘放下鐵鎚，爐火映得他滿臉通紅。' },
      { speaker: 'changxu', text: '他答應替我們打一批新的護具，只收糧草，不收骨頭幣。' },
      { speaker: 'abai', text: '南邊的海灣有好多船！船上會不會有魚乾？' },
    ],
  },
  {
    id: 'ch8-boss',
    title: '第八章\u3000退潮之後',
    unlockAfter: 'bihaiwan-5',
    art: 'coast',
    lines: [
      { speaker: null, text: '潮水退去，萊昂貝格犬潮王站在船頭，把舵交了出來。' },
      { speaker: 'daer', text: '他說汪都的城門只有一條路能到，就是雲頂上的棧道。' },
      { speaker: 'heixuan', text: '爬山？好啊，誰最後到誰請客！' },
    ],
  },
  {
    id: 'ch9-boss',
    title: '第九章\u3000雲海上的約定',
    unlockAfter: 'yundingzhan-5',
    art: 'cloud',
    lines: [
      { speaker: null, text: '愛爾蘭獵狼犬凌霄收起長槍，雲海另一頭就是汪都的城牆。' },
      { speaker: 'xiaosuan', text: '他守這條路守了十年，等的就是一位肯走到這裡的城主。' },
      { speaker: 'changxu', text: '最後一段路了。大家把爪子磨亮。' },
    ],
  },
  {
    id: 'ch10-boss',
    title: '第十章\u3000汪都的早晨',
    unlockAfter: 'wangdu-5',
    art: 'palace',
    lines: [
      { speaker: null, text: '英國獒犬天狼王摘下金色的項圈，放在城主面前。' },
      { speaker: null, text: '城門打開了，一路上遇到的狗狗們，都擠在大街兩旁搖尾巴。' },
      { speaker: 'daer', text: '城主，汪州安定下來了。不過聽說海的另一邊，還有別的州呢。' },
      { speaker: 'abai', text: '那今天可以先開慶功宴嗎？我要兩碗！' },
    ],
  },
];

export function findStory(id: string): StoryData | undefined {
  return STORIES.find((s) => s.id === id);
}
