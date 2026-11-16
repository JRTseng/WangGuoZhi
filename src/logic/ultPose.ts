/**
 * 大絕招的專屬姿勢（2026-11-15 Jimmy：「大絕招可以有一些狗狗的獨有姿勢出現」）。
 * 喊招字卡上不再只有大頭，而是整隻狗擺出自己的姿勢（穿著的裝備也畫出來）。
 * 姿勢一共 12 種動作，每隻狗指定一種、再加上自己的傾斜角度，所以 30 隻都不一樣。
 * 這裡只有資料與查表（純函式）；怎麼動在 src/scenes/components/DogSprite.ts 的 ultPose。
 */
export const ULT_POSES = [
  'pounce', // 撲擊：壓低再往前撲
  'howl', // 仰天長嚎
  'rear', // 後腳站立
  'crouch', // 伏地蓄力、全身發抖
  'spin', // 跳起來轉一圈
  'guard', // 挺胸踏地
  'leap', // 高高跳起
  'tailwhip', // 轉身甩尾
  'paw', // 坐下招手
  'roll', // 翻滾
  'dash', // 衝刺
  'snooze', // 打盹後突然驚醒
] as const;
export type UltPose = (typeof ULT_POSES)[number];

export interface UltPoseSpec {
  pose: UltPose;
  /** 這隻狗自己的傾斜角度（度），同一種動作也會有點不一樣 */
  lean: number;
}

/** 姿勢的中文名字（除錯與文件用） */
export const ULT_POSE_NAMES: Readonly<Record<UltPose, string>> = {
  pounce: '撲擊',
  howl: '仰天長嚎',
  rear: '後腳站立',
  crouch: '伏地蓄力',
  spin: '迴旋跳',
  guard: '挺胸踏地',
  leap: '高跳',
  tailwhip: '轉身甩尾',
  paw: '坐下招手',
  roll: '翻滾',
  dash: '衝刺',
  snooze: '打盹驚醒',
};

/** 每隻狗的姿勢，照招式的意思挑的 */
const TABLE: Readonly<Record<string, readonly [UltPose, number]>> = {
  daer: ['howl', 0], // 結義
  heixuan: ['pounce', 0], // 怒吼
  changxu: ['rear', 0], // 單騎
  xiaosuan: ['paw', 0], // 借箭
  abai: ['leap', 0], // 天降
  tieya: ['guard', 0], // 鐵壁
  duantui: ['dash', 0], // 急行軍
  shuangyan: ['howl', 8], // 狼嚎
  douding: ['rear', -10], // 虛張聲勢
  chanbi: ['crouch', 0], // 聞香尋糧
  changgong: ['crouch', 8], // 掘地突襲
  yuandun: ['dash', 6], // 肉盾衝撞
  modian: ['pounce', 8], // 連環飛撲
  zhuifeng: ['tailwhip', 0], // 牧陣
  shanlan: ['paw', 8], // 識途
  jiying: ['dash', -6], // 影襲
  xiongyue: ['guard', 6], // 不動如山
  xueling: ['spin', 0], // 雪上無痕
  nuantong: ['paw', -8], // 暖心桶
  liuxing: ['leap', 10], // 一線天
  songling: ['howl', -8], // 號令
  fuqiu: ['roll', 0], // 好運滾滾
  haiyan: ['leap', -8], // 踏浪救援
  shuangtong: ['tailwhip', 8], // 異色凝視
  jinling: ['spin', 8], // 報喜
  caiyi: ['spin', -8], // 翩翩
  ronger: ['tailwhip', -8], // 搖尾打氣
  maisui: ['roll', 8], // 叼來藥草
  shidun: ['guard', -8], // 不讓路
  zhouzhou: ['snooze', 0], // 呼嚕午睡
  taxue: ['guard', 10], // 雪原壁壘
  jinsi: ['paw', -4], // 絲絲入扣
  zhongquan: ['pounce', -8], // 連環重拳
  yunzhou: ['roll', -8], // 掃雲開路
  xuebao: ['rear', 8], // 白色城牆
  jingzhu: ['crouch', -8], // 無聲計
  yuanbao: ['paw', 5], // 招財進寶
  mianhua: ['tailwhip', 5], // 棉花抱抱
  wangyue: ['howl', 5], // 千里歸途
  xuanfeng: ['spin', 5], // 蛋頭衝鋒
  maoshi: ['guard', -4], // 獅子坐鎮
  huzi: ['rear', 5], // 老成持重
  baitang: ['leap', 5], // 甜頭
  chouer: ['roll', -5], // 梳毛安神
  beiguo: ['snooze', 8], // 慢慢聞
  xiaoding: ['dash', 10], // 小釘子
  huomiao: ['pounce', 5], // 一點就著
  atu: ['snooze', -8], // 悶聲扛
  nuomi: ['leap', -4], // 黏黏好運
  paofu: ['roll', 5], // 泡芙呼呼
};

/** 這隻狗（或敵人）放大絕招時的姿勢；表裡沒有的（敵方頭目、精銳）用長嚎或撲擊 */
export function ultPoseOf(id: string, role?: string): UltPoseSpec {
  const hit = TABLE[id];
  if (hit) return { pose: hit[0], lean: hit[1] };
  return { pose: role === '頭目' ? 'howl' : 'pounce', lean: 0 };
}
