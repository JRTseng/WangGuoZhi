import type { ThemeId } from './regions';

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
  art: ThemeId | 'city';
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
];

export function findStory(id: string): StoryData | undefined {
  return STORIES.find((s) => s.id === id);
}
