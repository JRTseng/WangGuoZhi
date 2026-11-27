import Phaser from 'phaser';
import { COLORS, rarityHex } from '../../config';
import { bioOf } from '../../data/bios';
import type { DogData } from '../../data/dogs';
import { DEFAULT_SKILL_LINES } from '../../data/skillLines';
import { bondText, faveText, type BondView } from '../../logic/bond';
import { battleRoleOf } from '../../logic/formation';
import type { Rect } from '../../logic/layout';
import { levelSkillsOf, perkText } from '../../logic/levelSkills';
import type { DogStats } from '../../logic/leveling';
import { MAX_LEVEL } from '../../logic/leveling';
import { addText, openModal, viewOf } from '../ui';
import { drawDogHead, type HeadOptions } from './dogArt';
import { drawExpBar, expLabel } from './ExpBar';
import { makeTapArea } from './hitArea';

export interface DogInfoOptions {
  /** 目前的等級、經驗、攻防與戰力（含升級成長） */
  stats: DogStats;
  owned: boolean;
  inTeam: boolean;
  teamFull: boolean;
  /** 在訓練場寄宿中（T021）：要先接回來才能加入隊伍 */
  boarding?: boolean;
  isLobby: boolean;
  /** 頭像的外觀（T014）：頭飾與受傷 */
  look?: Pick<HeadOptions, 'gear' | 'hurt'>;
  /** 加入／移出隊伍、設為主頁角色；沒給就只看資料（出征選隊伍時長按打開的） */
  onToggleTeam?: () => void;
  onSetLobby?: () => void;
  /** 去倉庫幫這隻狗換裝備（T014）；沒給就不顯示按鈕 */
  onGear?: () => void;
  onClose: () => void;
  /** 好感度（T042）；有給、而且擁有這個角色才顯示 */
  bond?: BondView;
  /** 右半邊一開始顯示哪一頁（T041）：成長技能（預設）或小故事 */
  tab?: DogInfoTab;
  /** 換頁之後通知場景（更新測試用的除錯資訊） */
  onTab?: (tab: DogInfoTab) => void;
}

/** 資料視窗右半邊的兩頁（T041） */
export type DogInfoTab = 'skills' | 'story';

/**
 * 角色資訊面板（素質與技能頁面）：頭像、數值、大絕招，右邊是每 10 級學一個的成長技能，
 * 按右上角可以換成「小故事」那一頁（T041，拿到這個角色才看得到內容）。
 * 組隊編排點卡片、或組隊與出征選隊伍時長按狗狗圖示打開。
 * 擁有的狗：下方有「加入／移出隊伍」「設為主頁角色」。
 * 沒擁有的狗：暗色頭像 + 「尚未擁有」。點遮罩關閉。
 */
export class DogInfoPanel {
  readonly layer: Phaser.GameObjects.Container;
  readonly buttons: { team?: Rect; lobby?: Rect; gear?: Rect; close?: Rect; tab?: Rect } = {};
  /** 右半邊現在是哪一頁（T041） */
  tab: DogInfoTab = 'skills';
  readonly stats: { level: number; exp: number; expNeed: number; power: number; star: number };
  /** 成長技能：學會幾個、一共幾個 */
  readonly skills: { learned: number; total: number } = { learned: 0, total: 0 };
  /** 按著打開的時候，要等手指放開、再按下去之後，點遮罩才會關（不然一放手就關掉） */
  private armed: boolean;
  private readonly arm = (): void => {
    this.armed = true;
  };
  private readonly scene: Phaser.Scene;

  constructor(scene: Phaser.Scene, dog: DogData, o: DogInfoOptions) {
    const { landscape } = viewOf(scene);
    this.scene = scene;
    this.armed = !scene.input.activePointer.isDown;
    scene.input.on('pointerdown', this.arm);
    const { layer, box } = openModal(
      scene,
      landscape ? { width: 790, height: 366 } : { width: 350, height: 470 },
      () => {
        if (this.armed) o.onClose();
      },
      o.owned ? (dog.color === 0xf7f4ee ? COLORS.cardBorder : dog.color) : 0x6b5a4a,
    );
    this.layer = layer;
    const s = o.stats;
    this.stats = { level: s.level, exp: s.exp, expNeed: s.expNeed, power: s.power, star: s.star };

    const head = scene.add.graphics();
    const hr = 40;
    const hx = box.x + 24 + hr;
    const hy = box.y + 34 + hr;
    drawDogHead(head, hx, hy, hr, dog.color, dog.accent, {
      dark: !o.owned,
      ...o.look,
      breed: dog.breed,
      photo: dog.id,
    });
    layer.add(head);
    // 頭像下面：稀有度・體型・星數（T007）
    if (dog.rarity) {
      const tag = [dog.rarity, dog.size, o.owned ? `★${s.star}` : ''].filter(Boolean).join('・');
      layer.add(
        addText(scene, hx, hy + hr + 6, tag, 13, rarityHex(dog.rarity), true).setOrigin(0.5, 0),
      );
    }

    // 橫式分兩欄：左邊素質，右邊成長技能
    const leftW = landscape ? 372 : box.width - 48;
    const tx = hx + hr + 20;
    const textW = box.x + 24 + leftW - tx;
    layer.add(
      addText(
        scene,
        tx,
        box.y + 30,
        o.owned ? `${dog.name}  Lv.${s.level}` : dog.name,
        26,
        COLORS.ink,
        true,
      ),
    );
    layer.add(
      addText(
        scene,
        tx,
        box.y + 66,
        `${dog.breed}・${dog.role}` + (o.owned && o.bond ? `\u3000♥${o.bond.level}` : ''),
        15,
        COLORS.inkSoft,
      ).setWordWrapWidth(textW),
    );
    if (!o.owned) {
      layer.add(addText(scene, tx, box.y + 92, '尚未擁有', 16, '#c0392b', true));
    } else {
      // 經驗條
      const bar = scene.add.graphics();
      const barW = Math.min(textW, 200);
      drawExpBar(bar, tx, box.y + 98, barW, 8, s.exp / (s.expNeed || 1), s.expNeed === 0);
      layer.add([
        bar,
        addText(
          scene,
          tx,
          box.y + 110,
          s.expNeed === 0 && s.levelCap < MAX_LEVEL
            ? `等級上限 ${s.levelCap}・升星可提高`
            : expLabel(s.exp, s.expNeed),
          13,
          COLORS.inkSoft,
        ),
      ]);
    }
    const left = box.x + 24;
    const wrap = leftW;
    let y = box.y + 140;
    const line = (s: string, size: number, color: string = COLORS.ink, bold = false, gap = 30) => {
      const t = addText(scene, left, y, s, size, color, bold).setWordWrapWidth(wrap, true);
      layer.add(t);
      y += gap;
    };
    line(`性格：${dog.personality}`, 16);
    line(
      `攻擊 ${s.attack}\u3000防禦 ${s.defense}\u3000戰力 ${s.power}` +
        (s.gearAttack + s.gearDefense > 0 ? `（裝備 +${s.gearAttack + s.gearDefense}）` : ''),
      16,
    );
    line(`大絕招「${dog.skill.name}」：${dog.skill.description}`, 14, '#b5651d', true, 40);

    if (landscape) {
      // 成長技能：每 10 級學一個，學會的亮起來
      const list = levelSkillsOf(battleRoleOf(dog.role));
      const learned = o.owned ? list.filter((k) => k.level <= s.level).length : 0;
      this.skills.learned = learned;
      this.skills.total = list.length;
      const sx = box.x + 24 + leftW + 20;
      const sw = box.x + box.width - 24 - sx;
      const g = scene.add.graphics();
      g.lineStyle(1, COLORS.cardBorder, 0.7);
      g.lineBetween(sx - 10, box.y + 22, sx - 10, box.y + box.height - 78);
      layer.add(g);
      // 右半邊兩頁：成長技能／小故事（T041），右上角的按鈕換頁
      const side = scene.add.container(0, 0);
      layer.add(side);
      const bio = bioOf(dog.id);
      const drawSide = (): void => {
        side.removeAll(true);
        if (this.tab === 'story' && bio) {
          side.add(addText(scene, sx, box.y + 20, '小故事', 15, COLORS.ink, true));
          if (!o.owned) {
            side.add([
              addText(scene, sx, box.y + 56, '？？？', 20, COLORS.inkSoft, true),
              addText(
                scene,
                sx,
                box.y + 92,
                '拿到這位夥伴以後，就能看牠的小故事',
                14,
                COLORS.inkSoft,
              ).setWordWrapWidth(sw, true),
            ]);
            return;
          }
          const story = addText(scene, sx, box.y + 54, bio.story, 14, COLORS.ink)
            .setWordWrapWidth(sw, true)
            .setLineSpacing(6);
          side.add(story);
          let fy = Math.max(box.y + 150, story.y + story.height + 16);
          const line = DEFAULT_SKILL_LINES[dog.id];
          const rows: [string, string, string][] = [
            ['喜歡', bio.likes, '#b5651d'],
            ['害怕', bio.fears, '#5a6f94'],
          ];
          if (line) rows.push(['口頭禪', `「${line}」`, '#4f8a3c']);
          if (o.bond) {
            rows.push(['愛吃', faveText(o.bond.fave), '#c0522b']);
            rows.push(['好感度', bondText(o.bond), '#e0452b']);
          }
          // 行數多的時候排緊一點，好感度那行換行也不會碰到下面的按鈕
          const pitch = rows.length > 4 ? 25 : 30;
          for (const [label, text, color] of rows) {
            side.add([
              addText(scene, sx, fy, label, 14, color, true),
              addText(scene, sx + 58, fy, text, 14, COLORS.ink).setWordWrapWidth(sw - 58, true),
            ]);
            fy += pitch;
          }
          return;
        }
        side.add(
          addText(
            scene,
            sx,
            box.y + 20,
            `成長技能 ${learned}/${list.length}（每 10 級學一個）`,
            15,
            COLORS.ink,
            true,
          ),
        );
        list.forEach((k, i) => {
          const got = o.owned && k.level <= s.level;
          // 超過目前等級上限的要先升星
          const needStar = o.owned && !got && k.level > s.levelCap;
          side.add(
            addText(
              scene,
              sx,
              box.y + 46 + i * 23.5,
              `${got ? '✓' : '・'}Lv.${k.level} ${k.name}：${perkText(k.perks)}${needStar ? '（要升星）' : ''}`,
              12,
              got ? '#2f7d32' : needStar ? '#b9a48c' : COLORS.inkSoft,
              got,
            ),
          );
        });
      };
      if (bio) {
        this.tab = o.tab ?? 'skills';
        // 換頁按鈕：寫的是「按了會去哪一頁」
        const tr: Rect = { x: box.x + box.width - 24 - 84, y: box.y + 12, width: 84, height: 30 };
        const tc = scene.add.container(tr.x, tr.y);
        const tg = scene.add.graphics();
        tg.fillStyle(0x8a6f55, 1);
        tg.fillRoundedRect(0, 0, tr.width, tr.height, 10);
        const label = addText(scene, tr.width / 2, tr.height / 2, '', 14, '#ffffff', true);
        label.setOrigin(0.5);
        const relabel = (): void => {
          label.setText(this.tab === 'story' ? '成長技能' : '小故事');
        };
        relabel();
        tc.add([tg, label]);
        makeTapArea(tc, tr.width, tr.height);
        tc.on('pointerup', () => {
          this.tab = this.tab === 'story' ? 'skills' : 'story';
          relabel();
          drawSide();
          o.onTab?.(this.tab);
        });
        layer.add(tc);
        this.buttons.tab = tr;
      }
      drawSide();
    }

    const by = box.y + box.height - 64;
    if (o.owned && !(o.onToggleTeam && o.onSetLobby)) {
      // 只看資料：一顆關閉
      this.buttons.close = this.button(
        scene,
        { x: box.x + box.width / 2 - 110, y: by, width: 220, height: 48 },
        '關閉',
        0x8a6f55,
        o.onClose,
      );
    } else if (o.owned) {
      const onToggleTeam = o.onToggleTeam!;
      const onSetLobby = o.onSetLobby!;
      const n = o.onGear ? 3 : 2;
      const bw = (box.width - 48 - 12 * (n - 1)) / n;
      const blocked = o.boarding ? '寄宿中' : o.teamFull ? '隊伍已滿' : null;
      const teamLabel = o.inTeam ? '移出隊伍' : (blocked ?? '加入隊伍');
      const teamColor = o.inTeam ? 0x8a6f55 : blocked ? COLORS.buttonDisabled : COLORS.button;
      this.buttons.team = this.button(
        scene,
        { x: left, y: by, width: bw, height: 48 },
        teamLabel,
        teamColor,
        onToggleTeam,
      );
      this.buttons.lobby = this.button(
        scene,
        { x: left + bw + 12, y: by, width: bw, height: 48 },
        o.isLobby ? '主頁角色 ✓' : '設為主頁角色',
        o.isLobby ? COLORS.buttonDisabled : COLORS.harvest,
        onSetLobby,
      );
      if (o.onGear) {
        this.buttons.gear = this.button(
          scene,
          { x: left + (bw + 12) * 2, y: by, width: bw, height: 48 },
          '裝備',
          0x3d5a94,
          o.onGear,
        );
      }
    } else {
      layer.add(
        addText(
          scene,
          box.x + box.width / 2,
          by + 24,
          dog.rewardOnly ? '打贏第 1 章 Boss 就會加入，召募也抽得到' : '到主頁的「召募」抽抽看',
          16,
          COLORS.inkSoft,
        ).setOrigin(0.5),
      );
    }
  }

  private button(
    scene: Phaser.Scene,
    r: Rect,
    label: string,
    color: number,
    onTap: () => void,
  ): Rect {
    const c = scene.add.container(r.x, r.y);
    const g = scene.add.graphics();
    g.fillStyle(color, 1);
    g.fillRoundedRect(0, 0, r.width, r.height, 14);
    c.add([
      g,
      addText(scene, r.width / 2, r.height / 2, label, 18, '#ffffff', true).setOrigin(0.5),
    ]);
    makeTapArea(c, r.width, r.height);
    c.on('pointerup', onTap);
    this.layer.add(c);
    return r;
  }

  destroy(): void {
    this.scene.input.off('pointerdown', this.arm);
    this.layer.destroy();
  }
}
