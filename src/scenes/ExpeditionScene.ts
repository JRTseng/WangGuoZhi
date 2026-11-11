import Phaser from 'phaser';
import { COLORS, FONT_FAMILY } from '../config';
import { DOGS } from '../data/dogs';
import { findStage, type StageData } from '../data/regions';
import { TEAM_SIZE, busyDogIds, startExpedition } from '../logic/expedition';
import { layoutGrid, layoutList, type Rect } from '../logic/layout';
import { teamPower } from '../logic/team';
import { minuteMsFromSearch } from '../logic/timeScale';
import { getState, setState } from '../state/store';
import { Button } from './components/Button';
import { DogCard } from './components/DogCard';
import { drawHeader, patchDebug, resetDebug, viewOf } from './ui';

const BAR_HEIGHT = 56;

interface ExpeditionData {
  stageId: string;
  /** 返回地圖時停在哪一章 */
  chapter?: number;
}

/**
 * 出征選隊伍：從地圖點關卡進來。
 * 預設帶入「組隊編排」的隊伍（出征中的除外），可再點卡片調整，選滿 3 隻出發。
 * 只列出擁有的狗；大按鈕在下方，單手拇指按得到。
 */
export class ExpeditionScene extends Phaser.Scene {
  private stage: StageData | null = null;
  private chapter = 0;
  private selected: string[] = [];
  private layer!: Phaser.GameObjects.Container;
  private back!: Rect;

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
    const { w, h } = viewOf(this);
    this.add.rectangle(0, 0, w, h, COLORS.background).setOrigin(0, 0);
    this.back = drawHeader(this, `出征・${this.stage.name}`, () =>
      this.scene.start('CampaignScene', { chapter: this.chapter }),
    );
    this.layer = this.add.container(0, 0);
    this.render();
  }

  private render(): void {
    this.layer.removeAll(true);
    const stage = this.stage!;
    const st = getState();
    const busy = busyDogIds(st);
    const { w, h, landscape } = viewOf(this);
    const dogs = DOGS.filter((d) => st.owned.includes(d.id));

    const confirm: Rect = landscape
      ? { x: w - 316, y: h - 72, width: 300, height: 60 }
      : { x: 24, y: h - 96, width: w - 48, height: 64 };

    this.layer.add(
      this.text(
        w / 2,
        BAR_HEIGHT + 22,
        `${stage.durationMin} 分鐘・建議戰力 ${stage.recommendedPower}・選 ${TEAM_SIZE} 隻`,
        17,
        COLORS.ink,
        true,
      ).setOrigin(0.5),
    );

    const listTop = BAR_HEIGHT + 44;
    const rects = landscape
      ? layoutGrid(dogs.length, {
          area: { x: 16, y: listTop, width: w - 32, height: confirm.y - 12 - listTop },
          columns: 3,
          gap: 10,
          maxCellHeight: 100,
        })
      : layoutList(dogs.length, {
          area: { x: 16, y: listTop, width: w - 32, height: confirm.y - 76 - listTop },
          gap: 10,
          maxCardHeight: 100,
        });
    const cards = dogs.map((dog, i) => {
      const card = new DogCard(this, dog, rects[i], () => this.toggleDog(dog.id));
      card.setSelectable(true);
      card.setStatus({ busy: busy.has(dog.id), selected: this.selected.includes(dog.id) });
      this.layer.add(card);
      return card;
    });

    const power = teamPower(this.selected);
    const names = this.selected.map((id) => DOGS.find((d) => d.id === id)!.name);
    const infoX = landscape ? 16 : w / 2;
    const info1 = this.text(
      infoX,
      landscape ? confirm.y + 4 : confirm.y - 52,
      names.length
        ? `已選 ${names.length}/${TEAM_SIZE}：${names.join('、')}`
        : `點卡片選 ${TEAM_SIZE} 隻，再點一次取消`,
      landscape ? 16 : 18,
      names.length ? '#b5651d' : COLORS.inkSoft,
      true,
    ).setOrigin(landscape ? 0 : 0.5, landscape ? 0 : 0.5);
    const info2 = this.text(
      infoX,
      landscape ? confirm.y + 32 : confirm.y - 22,
      `隊伍戰力 ${power}／建議 ${stage.recommendedPower}`,
      15,
      power >= stage.recommendedPower ? '#4f8a3c' : COLORS.inkSoft,
      true,
    ).setOrigin(landscape ? 0 : 0.5, landscape ? 0 : 0.5);
    this.layer.add([info1, info2]);

    const ready = this.selected.length === TEAM_SIZE;
    const label = ready ? '出發！' : `出發（已選 ${this.selected.length}/${TEAM_SIZE}）`;
    const btn = new Button(this, confirm, label, () => this.confirm());
    btn.setEnabled(ready);
    this.layer.add(btn);

    patchDebug({
      backButton: this.back,
      expeditionPanel: {
        step: 'team',
        stageId: stage.id,
        stages: [],
        teamCards: cards.map((c) => ({
          id: c.dog.id,
          busy: busy.has(c.dog.id),
          selected: this.selected.includes(c.dog.id),
          ...c.rect,
        })),
        confirmButton: { label, enabled: ready, ...confirm },
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
