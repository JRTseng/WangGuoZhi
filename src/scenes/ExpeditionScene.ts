import Phaser from 'phaser';
import { COLORS, FONT_FAMILY } from '../config';
import { DOGS } from '../data/dogs';
import { findStage, type StageData } from '../data/regions';
import { skillBonusOf, winChance } from '../logic/battle';
import { TEAM_MIN, TEAM_SIZE, battleDogOf, busyDogIds, startExpedition } from '../logic/expedition';
import { autoTeam } from '../logic/dogFilter';
import type { Rect } from '../logic/layout';
import { SIDE_WIDTH } from '../logic/pickerLayout';
import { teamPower } from '../logic/team';
import { minuteMsFromSearch } from '../logic/timeScale';
import { getState, setState } from '../state/store';
import { Button } from './components/Button';
import { DogPicker } from './components/DogPicker';
import { drawHeader, patchDebug, resetDebug, viewOf } from './ui';

const BAR_HEIGHT = 56;

interface ExpeditionData {
  stageId: string;
  /** 返回地圖時停在哪一章 */
  chapter?: number;
}

/**
 * 出征選隊伍：從地圖點關卡進來。
 * 預設帶入「組隊編排」的隊伍（出征中的除外），可再點卡片調整，選 1 到 5 隻出發。
 * T015 改版：上方 5 個隊伍格、篩選與排序、可捲動的卡片格、一鍵自動編隊。
 * 只列出擁有的狗；出發按鈕在下方，單手拇指按得到。
 */
export class ExpeditionScene extends Phaser.Scene {
  private stage: StageData | null = null;
  private chapter = 0;
  private selected: string[] = [];
  private layer!: Phaser.GameObjects.Container;
  private picker!: DogPicker;
  private back!: Rect;
  private confirmRect!: Rect;
  private confirmLabel = '';
  private confirmReady = false;

  constructor() {
    super('ExpeditionScene');
  }

  init(data: ExpeditionData): void {
    this.stage = findStage(data?.stageId ?? '') ?? null;
    this.chapter = data?.chapter ?? 0;
    const st = getState();
    const busy = busyDogIds(st);
    this.selected = st.team.filter((id) => st.owned.includes(id) && !busy.has(id));
  }

  create(): void {
    resetDebug(this);
    if (!this.stage) {
      this.scene.start('CampaignScene');
      return;
    }
    const stage = this.stage;
    const { w, h, landscape } = viewOf(this);
    this.add.rectangle(0, 0, w, h, COLORS.background).setOrigin(0, 0);
    const brief = `${stage.durationMin} 分鐘・建議戰力 ${stage.recommendedPower}`;
    // 橫式高度不夠，關卡資訊併進標題列
    this.back = drawHeader(
      this,
      landscape ? `出征・${stage.name}・${brief}` : `出征・${stage.name}`,
      () => this.scene.start('CampaignScene', { chapter: this.chapter }),
    );
    if (!landscape) {
      this.text(
        w / 2,
        BAR_HEIGHT + 22,
        `${brief}・選 ${TEAM_MIN}～${TEAM_SIZE} 隻`,
        17,
        COLORS.ink,
        true,
      ).setOrigin(0.5);
    }
    this.confirmRect = landscape
      ? { x: 16, y: h - 66, width: SIDE_WIDTH, height: 54 }
      : { x: 24, y: h - 96, width: w - 48, height: 64 };
    // 放在卡片格上面，捲動時出發按鈕不會被卡片擋住
    this.layer = this.add.container(0, 0).setDepth(1);
    this.picker = new DogPicker(this, {
      mode: 'expedition',
      top: landscape ? BAR_HEIGHT + 6 : BAR_HEIGHT + 40,
      bottom: landscape ? h - 12 : this.confirmRect.y - 42,
      slotsBottom: landscape ? this.confirmRect.y - 48 : undefined,
      dogs: () => DOGS.filter((d) => getState().owned.includes(d.id)),
      selected: () => this.selected,
      title: () => `${landscape ? '隊伍' : '出征隊伍'} ${this.selected.length}/${TEAM_SIZE}`,
      onSlotTap: (id) => this.toggleDog(id),
      onCellTap: (dog) => this.toggleDog(dog.id),
      onAuto: () => {
        const st = getState();
        const team = autoTeam(DOGS, { owned: st.owned, busy: busyDogIds(st) });
        if (team.length > 0) this.selected = team;
        this.render();
      },
      onUpdate: () => this.publish(),
    });
    this.render();
  }

  /** 下方（橫式在左欄下方）的戰力、勝率與出發按鈕，再重畫選狗區 */
  private render(): void {
    this.layer.removeAll(true);
    const stage = this.stage!;
    const { w, landscape } = viewOf(this);
    const confirm = this.confirmRect;

    const power = teamPower(this.selected);
    const chance = winChance(
      power,
      stage.recommendedPower,
      skillBonusOf(this.selected.flatMap((id) => battleDogOf(id) ?? [])),
    );
    const color = chance >= 0.6 ? '#4f8a3c' : chance > 0 ? COLORS.inkSoft : '#b0413e';
    const powerLine = `隊伍戰力 ${power}／建議 ${stage.recommendedPower}`;
    const chanceLine = `勝率約 ${Math.round(chance * 100)}%`;
    if (landscape) {
      this.layer.add([
        this.text(confirm.x, confirm.y - 42, powerLine, 14, color, true),
        this.text(confirm.x, confirm.y - 23, chanceLine, 14, color, true),
      ]);
    } else {
      this.layer.add(
        this.text(w / 2, confirm.y - 20, `${powerLine}・${chanceLine}`, 15, color, true).setOrigin(
          0.5,
        ),
      );
    }

    const ready = this.selected.length >= TEAM_MIN && this.selected.length <= TEAM_SIZE;
    this.confirmLabel = ready ? '出發！' : `出發（已選 ${this.selected.length}/${TEAM_SIZE}）`;
    this.confirmReady = ready;
    const btn = new Button(this, confirm, this.confirmLabel, () => this.confirm());
    btn.setEnabled(ready);
    this.layer.add(btn);

    this.picker.render();
  }

  private publish(): void {
    const p = this.picker.debug();
    patchDebug({
      backButton: this.back,
      picker: p,
      expeditionPanel: {
        step: 'team',
        stageId: this.stage!.id,
        stages: [],
        teamCards: p.cells.map(({ id, busy, selected, x, y, width, height }) => ({
          id,
          busy,
          selected,
          x,
          y,
          width,
          height,
        })),
        confirmButton: {
          label: this.confirmLabel,
          enabled: this.confirmReady,
          ...this.confirmRect,
        },
      },
    });
  }

  private toggleDog(id: string): void {
    if (busyDogIds(getState()).has(id)) return; // 出征中的不能選
    if (this.selected.includes(id)) {
      this.selected = this.selected.filter((x) => x !== id);
    } else if (this.selected.length < TEAM_SIZE) {
      this.selected = [...this.selected, id];
    } else {
      return; // 已滿，先取消一隻才能換
    }
    this.render();
  }

  private confirm(): void {
    if (!this.stage || this.picker.wasDragged) return;
    const r = startExpedition(
      getState(),
      this.stage.id,
      this.selected,
      Date.now(),
      minuteMsFromSearch(window.location.search),
      // 這一仗的亂數種子：出發時就定下來，之後不能重抽
      Math.floor(Math.random() * 0x100000000),
    );
    if (!r.ok) return;
    setState(r.state);
    this.scene.start('LobbyScene');
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
}
