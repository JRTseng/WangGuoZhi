import Phaser from 'phaser';
import { COLORS, rarityHex } from '../../config';
import type { DogData } from '../../data/dogs';
import type { Rect } from '../../logic/layout';
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
  onToggleTeam: () => void;
  onSetLobby: () => void;
  /** 去倉庫幫這隻狗換裝備（T014）；沒給就不顯示按鈕 */
  onGear?: () => void;
  onClose: () => void;
}

/**
 * 角色資訊面板：頭像、數值、技能。
 * 擁有的狗：下方有「加入／移出隊伍」「設為主頁角色」。
 * 沒擁有的狗：暗色頭像 + 「尚未擁有」。點遮罩關閉。
 */
export class DogInfoPanel {
  readonly layer: Phaser.GameObjects.Container;
  readonly buttons: { team?: Rect; lobby?: Rect; gear?: Rect } = {};
  readonly stats: { level: number; exp: number; expNeed: number; power: number; star: number };

  constructor(scene: Phaser.Scene, dog: DogData, o: DogInfoOptions) {
    const { landscape } = viewOf(scene);
    const { layer, box } = openModal(
      scene,
      landscape ? { width: 560, height: 340 } : { width: 350, height: 470 },
      o.onClose,
      o.owned ? (dog.color === 0xf7f4ee ? COLORS.cardBorder : dog.color) : 0x6b5a4a,
    );
    this.layer = layer;
    const s = o.stats;
    this.stats = { level: s.level, exp: s.exp, expNeed: s.expNeed, power: s.power, star: s.star };

    const head = scene.add.graphics();
    const hr = 40;
    const hx = box.x + 24 + hr;
    const hy = box.y + 34 + hr;
    drawDogHead(head, hx, hy, hr, dog.color, dog.accent, { dark: !o.owned, ...o.look });
    layer.add(head);
    // 頭像下面：稀有度・體型・星數（T007）
    if (dog.rarity) {
      const tag = [dog.rarity, dog.size, o.owned ? `★${s.star}` : ''].filter(Boolean).join('・');
      layer.add(
        addText(scene, hx, hy + hr + 6, tag, 13, rarityHex(dog.rarity), true).setOrigin(0.5, 0),
      );
    }

    const tx = hx + hr + 20;
    const textW = box.x + box.width - tx - 16;
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
        `${dog.breed}・${dog.role}`,
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
    const wrap = box.width - 48;
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
    line(`技能「${dog.skill.name}」：${dog.skill.description}`, 16, '#b5651d', true, 40);

    const by = box.y + box.height - 64;
    if (o.owned) {
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
        o.onToggleTeam,
      );
      this.buttons.lobby = this.button(
        scene,
        { x: left + bw + 12, y: by, width: bw, height: 48 },
        o.isLobby ? '主頁角色 ✓' : '設為主頁角色',
        o.isLobby ? COLORS.buttonDisabled : COLORS.harvest,
        o.onSetLobby,
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
    this.layer.destroy();
  }
}
