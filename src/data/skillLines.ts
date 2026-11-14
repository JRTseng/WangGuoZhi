/**
 * 大絕招演出用的文字（T017）：每隻狗放招時預設喊的台詞，以及章末 Boss 的招式。
 * 玩家可以在訓練場改成自己的台詞（存在 GameState.skillLines），沒改就用這裡的。
 * 純資料、全部原創；之後加新狗沒補台詞也沒關係，畫面只會少一行字。
 */
export const DEFAULT_SKILL_LINES: Readonly<Record<string, string>> = {
  daer: '兄弟們，跟我上！',
  heixuan: '吼——讓開讓開！',
  changxu: '有我在，誰都別想過！',
  xiaosuan: '這一步，我早就算好了。',
  abai: '好運，從天上掉下來啦！',
  tieya: '咬緊牙關，一步不退！',
  duantui: '腿短，可是跑得快！',
  shuangyan: '聽見了嗎？這是狼的歌。',
  douding: '汪汪汪！我可是很兇的！',
  chanbi: '聞到了，好吃的在那邊！',
  changgong: '看腳下，我來了！',
  yuandun: '躲我後面，我肉多！',
  modian: '一下不夠，再來一下！',
  zhuifeng: '全員歸隊，聽我口令！',
  shanlan: '這條路我熟，跟緊了！',
  jiying: '你看見的，只是影子。',
  xiongyue: '山不會動，我也不會。',
  xueling: '雪地上，沒有我的腳印。',
  nuantong: '別怕，喝一口就暖了。',
  liuxing: '眨眼之前，我已經到了。',
  songling: '聽我號令，一步都別亂！',
  fuqiu: '好運滾過來囉，接好！',
  haiyan: '抓緊我，浪再大也帶你回來。',
  shuangtong: '看著我的眼睛，慢慢來。',
  jinling: '好消息！好消息來啦！',
  caiyi: '抓不到，抓不到～',
  ronger: '加油加油，尾巴借你搖！',
  maisui: '藥草來了，一人一口！',
  shidun: '此路不通，請繞道。',
  zhouzhou: '呼嚕……大家睡飽再打。',
};

export interface BossSkill {
  name: string;
  line: string;
}

/** 章末 Boss 的大絕招（以 Boss 名字為鍵）；沒列到的 Boss 用 BOSS_SKILL_FALLBACK */
export const BOSS_SKILLS: Readonly<Record<string, BossSkill>> = {
  雷吼: { name: '震山吼', line: '這座山頭，是我的！' },
  巨影: { name: '遮天踏', line: '抬頭看看，誰比較高？' },
  鎮嶺王: { name: '萬嶺鎮壓', line: '想過關，先問過我。' },
  // 第四章起（T018）
  花嶽: { name: '落花掃', line: '別踩到我的花。' },
  沙牙: { name: '捲沙咬', line: '過路的，留下糧草。' },
  玄霧: { name: '霧中追蹤', line: '我聞得到你。' },
  炎錘: { name: '千錘百鍊', line: '這一錘，燙喔。' },
  潮王: { name: '怒潮拍岸', line: '浪來了，站穩。' },
  凌霄: { name: '凌空一槍', line: '雲上的路，由我守。' },
  天狼王: { name: '天狼號令', line: '汪都，不是誰都進得來。' },
};

/** 精銳小兵（不是 Boss、但會放大絕招）的招式 */
export const ELITE_SKILL: BossSkill = { name: '猛衝', line: '衝啊！' };

export const BOSS_SKILL_FALLBACK: BossSkill = { name: '王者咆哮', line: '' };
