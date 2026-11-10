import Phaser from 'phaser';
import { COLORS, FONT_FAMILY, GAME_HEIGHT, GAME_WIDTH } from '../config';
import { DOGS } from '../data/dogs';
import { REGIONS, type StageData } from '../data/regions';
import { RESOURCE_LABELS, type Resources } from '../data/resources';
import { TEAM_SIZE, busyDogIds, startExpedition } from '../logic/expedition';
import { formatAmount } from '../logic/format';
import { layoutList, type Rect } from '../logic/layout';
import { calcPower } from '../logic/power';
import { minuteMsFromSearch } from '../logic/timeScale';
import { getState, setState } from '../state/store';
import { Button } from './components/Button';
import { DogCard } from './components/DogCard';

const BAR_HEIGHT = 64;
const BACK: Rect = { x: 8, y: 8, width: 96, height: 48 };
const CONFIRM: Rect = { x: 24, y: GAME_HEIGHT - 112, width: GAME_WIDTH - 48, height: 64 };

type Step = 'stage' | 'team';

/**
 * 出征面板：兩步驟。
 * 1. 選關卡（落葉坡 3 關）
 * 2. 選 3 隻狗（出征中的不能選）→ 出發
 * 大按鈕都在畫面下半部，單手拇指按得到。
 */
export class ExpeditionScene extends Phaser.Scene {
  private step: Step = 'stage';
  private stage: StageData | null = null;
  private selected: string[] = [];
  private layer!: Phaser.GameObjects.Container;

  constructor() {
    super('ExpeditionScene');
  }

  create(): void {
    this.step = 'stage';
    this.stage = null;
    this.selected = [];
    this.layer = this.add.container(0, 0);
    this.render();
  }

  private render(): void {
    this.layer.removeAll(true);
    this.drawHeader();
    if (this.step === 'stage') this.renderStages();
    else this.renderTeam();
  }

  private drawHeader(): void {
    const region = REGIONS[0];
    const bar = this.add.rectangle(0, 0, GAME_WIDTH, BAR_HEIGHT, COLORS.bar).setOrigin(0, 0);
    const title = this.add
      .text(GAME_WIDTH / 2, BAR_HEIGHT / 2, `出征・${region.name}`, {
        fontFamily: FONT_FAMILY,
        fontSize: '22px',
        fontStyle: 'bold',
        color: COLORS.barText,
      })
      .setOrigin(0.5);
    const back = this.add
      .text(BACK.x + 12, BACK.y + BACK.height / 2, '‹ 返回', {
        fontFamily: FONT_FAMILY,
        fontSize: '20px',
        color: COLORS.barText,
      })
      .setOrigin(0, 0.5);
    const backHit = this.add
      .zone(BACK.x, BACK.y, BACK.width, BACK.height)
      .setOrigin(0, 0)
      .setInteractive({ cursor: 'pointer' });
    backHit.on('pointerup', () => this.goBack());
    this.layer.add([bar, title, back, backHit]);
  }

  private goBack(): void {
    if (this.step === 'team') {
      this.step = 'stage';
      this.selected = [];
      this.render();
    } else {
      this.scene.start('MainScene');
    }
  }

  // ---- 步驟 1：選關卡 ----

  private renderStages(): void {
    const stages = REGIONS[0].stages;
    const hint = this.text(GAME_WIDTH / 2, BAR_HEIGHT + 32, '選一個關卡', 20, COLORS.ink, true);
    hint.setOrigin(0.5);
    this.layer.add(hint);
    this.drawRegionIntro();

    // 關卡卡片往下放，靠近拇指
    const rects = layoutList(stages.length, {
      area: { x: 16, y: 300, width: GAME_WIDTH - 32, height: GAME_HEIGHT - 300 - 40 },
      gap: 16,
      maxCardHeight: 140,
    });
    stages.forEach((s, i) => this.drawStageCard(s, rects[i]));

    this.debug({
      step: 'stage',
      stages: stages.map((s, i) => ({ id: s.id, name: s.name, ...rects[i] })),
      teamCards: [],
      confirmButton: null,
    });
  }

  /** 地區介紹（佔位插圖 + 文字），放在上半部空間 */
  private drawRegionIntro(): void {
    const region = REGIONS[0];
    const g = this.add.graphics();
    // 佔位插圖：緩坡 + 三片落葉
    g.fillStyle(0xe2c48f, 1);
    g.fillEllipse(GAME_WIDTH / 2, 180, 300, 76);
    g.fillStyle(0xd27a3a, 1);
    for (const [x, y] of [
      [140, 150],
      [200, 138],
      [252, 156],
    ]) {
      g.fillEllipse(x, y, 22, 12);
    }
    const desc = this.text(GAME_WIDTH / 2, 258, region.description, 15, COLORS.inkSoft)
      .setOrigin(0.5)
      .setAlign('center');
    this.layer.add([g, desc]);
  }

  private drawStageCard(stage: StageData, r: Rect): void {
    const c = this.add.container(r.x, r.y);
    const g = this.add.graphics();
    g.fillStyle(COLORS.card, 1);
    g.lineStyle(2, COLORS.cardBorder, 1);
    g.fillRoundedRect(0, 0, r.width, r.height, 14);
    g.strokeRoundedRect(0, 0, r.width, r.height, 14);
    const stars = '★'.repeat(stage.difficulty) + '☆'.repeat(Math.max(0, 3 - stage.difficulty));
    c.add([
      g,
      this.text(18, 16, stage.name, 24, COLORS.ink, true),
      this.text(r.width - 18, 20, stars, 20, '#b5651d').setOrigin(1, 0),
      this.text(
        18,
        56,
        `耗時 ${stage.durationMin} 分鐘・建議戰力 ${stage.recommendedPower}`,
        16,
        COLORS.inkSoft,
      ),
      this.text(18, 86, `獎勵 ${rewardText(stage.reward)}`, 17, COLORS.ink),
    ]);
    c.setSize(r.width, r.height);
    c.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, r.width, r.height),
      Phaser.Geom.Rectangle.Contains,
    );
    c.input!.cursor = 'pointer';
    c.on('pointerup', () => {
      this.stage = stage;
      this.step = 'team';
      this.selected = [];
      this.render();
    });
    this.layer.add(c);
  }

  // ---- 步驟 2：選隊伍 ----

  private renderTeam(): void {
    const stage = this.stage!;
    const busy = busyDogIds(getState());

    this.layer.add(
      this.text(
        GAME_WIDTH / 2,
        BAR_HEIGHT + 28,
        `${stage.name}・${stage.durationMin} 分鐘・選 ${TEAM_SIZE} 隻`,
        19,
        COLORS.ink,
        true,
      ).setOrigin(0.5),
    );

    const listTop = BAR_HEIGHT + 56;
    const rects = layoutList(DOGS.length, {
      area: { x: 16, y: listTop, width: GAME_WIDTH - 32, height: CONFIRM.y - 48 - listTop },
      gap: 10,
      maxCardHeight: 100,
    });
    const cards = DOGS.map((dog, i) => {
      const card = new DogCard(this, dog, rects[i], () => this.toggleDog(dog.id));
      card.setStatus({ busy: busy.has(dog.id), selected: this.selected.includes(dog.id) });
      this.layer.add(card);
      return card;
    });

    const teamPower = this.selected.reduce((sum, id) => {
      const d = DOGS.find((x) => x.id === id)!;
      return sum + calcPower(d.baseAttack, d.baseDefense, d.level);
    }, 0);
    this.layer.add(
      this.text(
        GAME_WIDTH / 2,
        CONFIRM.y - 24,
        `隊伍戰力 ${teamPower}／建議 ${stage.recommendedPower}`,
        17,
        teamPower >= stage.recommendedPower ? '#4f8a3c' : COLORS.inkSoft,
        true,
      ).setOrigin(0.5),
    );

    const ready = this.selected.length === TEAM_SIZE;
    const label = ready ? '出發！' : `出發（已選 ${this.selected.length}/${TEAM_SIZE}）`;
    const btn = new Button(this, CONFIRM, label, () => this.confirm());
    btn.setEnabled(ready);
    this.layer.add(btn);

    this.debug({
      step: 'team',
      stages: [],
      teamCards: cards.map((c) => ({
        id: c.dog.id,
        busy: busy.has(c.dog.id),
        selected: this.selected.includes(c.dog.id),
        ...c.rect,
      })),
      confirmButton: { label, enabled: ready, ...CONFIRM },
    });
  }

  private toggleDog(id: string): void {
    if (busyDogIds(getState()).has(id)) return; // 出征中的不能選
    if (this.selected.includes(id)) {
      this.selected = this.selected.filter((x) => x !== id);
    } else if (this.selected.length < TEAM_SIZE) {
      this.selected = [...this.selected, id];
    } else {
      return; // 已滿 3 隻，先取消一隻才能換
    }
    this.render();
  }

  private confirm(): void {
    if (!this.stage) return;
    const r = startExpedition(
      getState(),
      this.stage.id,
      this.selected,
      Date.now(),
      minuteMsFromSearch(window.location.search),
    );
    if (!r.ok) return;
    setState(r.state);
    this.scene.start('MainScene');
  }

  // ---- 小工具 ----

  private text(
    x: number,
    y: number,
    s: string,
    size: number,
    color: string = COLORS.ink,
    bold = false,
  ): Phaser.GameObjects.Text {
    return this.add.text(x, y, s, {
      fontFamily: FONT_FAMILY,
      fontSize: `${size}px`,
      fontStyle: bold ? 'bold' : 'normal',
      color,
    });
  }

  private debug(info: NonNullable<WgzDebugState['expeditionPanel']>): void {
    window.__WGZ__ = {
      ...window.__WGZ__,
      scene: 'ExpeditionScene',
      version: window.__WGZ__?.version ?? '',
      backButton: BACK,
      expeditionPanel: info,
    };
  }
}

function rewardText(r: Resources): string {
  return (Object.keys(RESOURCE_LABELS) as (keyof Resources)[])
    .map((k) => `${RESOURCE_LABELS[k]} ${formatAmount(r[k])}`)
    .join('、');
}
