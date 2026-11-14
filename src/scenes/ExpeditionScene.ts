import Phaser from 'phaser';
import { COLORS, FONT_FAMILY } from '../config';
import { DOGS } from '../data/dogs';
import { findStage, type StageData } from '../data/regions';
import { battleSeedFromSearch } from '../logic/battle';
import {
  TEAM_MIN,
  beginExpedition,
  busyDogIds,
  resultNotes,
  runExpedition,
  stageTeamMax,
  stageWinChance,
} from '../logic/expedition';
import { freezeCells, resetFormation } from '../logic/formation';
import { formatCountdown } from '../logic/format';
import { autoTeam } from '../logic/dogFilter';
import type { Rect } from '../logic/layout';
import { SIDE_WIDTH } from '../logic/pickerLayout';
import { newStoriesAfter } from '../logic/progress';
import {
  STAMINA_COST,
  STAMINA_MAX,
  runBlock,
  runsLeft,
  runsTotal,
  type RunBlock,
} from '../logic/stamina';
import { dogContext, dogPower, placeDog, teamPower } from '../logic/team';
import { presetSizes, switchTeam } from '../logic/teams';
import { getState, setState, tick, timeOptions } from '../state/store';
import { Button } from './components/Button';
import { DogPicker } from './components/DogPicker';
import { ResultPanel } from './components/ResultPanel';
import { StaminaShop, type ShopKind } from './components/StaminaShop';
import { drawHeader, patchDebug, resetDebug, viewOf } from './ui';

const BAR_HEIGHT = 56;
/** 多久更新一次體力與倒數顯示 */
const REFRESH_MS = 500;
/** 體力不夠／次數用完時，開戰按鈕旁邊「補體力／加次數」的寬度 */
const BUY_WIDTH = 96;

interface ExpeditionData {
  stageId: string;
  /** 返回地圖時停在哪一章 */
  chapter?: number;
}

/**
 * 出征選隊伍：從地圖點關卡進來。
 * 預設帶入「組隊編排」的隊伍，可再點卡片調整，選 1 隻到這一關的上陣上限（T018），按「開戰」直接進戰鬥（T019：不用等）。
 * 開戰要花體力與今日次數；不夠時按鈕變灰並顯示還要等多久，旁邊可以用骨頭幣補。
 * T015 改版：上方 5 個隊伍格、篩選與排序、可捲動的卡片格、一鍵自動編隊。
 * 只列出擁有的狗；出發按鈕在下方，單手拇指按得到。
 */
export class ExpeditionScene extends Phaser.Scene {
  private stage: StageData | null = null;
  private chapter = 0;
  private selected: string[] = [];
  /** 這一關最多能上陣幾隻（T018：跟著敵人數量） */
  private max = 5;
  private layer!: Phaser.GameObjects.Container;
  private picker!: DogPicker;
  private back!: Rect;
  private confirmRect!: Rect;
  private confirmLabel = '';
  private confirmReady = false;
  private confirmButton: Button | null = null;
  private buyRect: Rect | null = null;
  private buyKind: ShopKind | null = null;
  private statusText!: Phaser.GameObjects.Text;
  /** 目前按鈕是依哪種狀態畫的；狀態變了才整個重畫 */
  private blockKey = '';
  private shop: StaminaShop | null = null;
  private result: ResultPanel | null = null;
  /** 勝率是模擬出來的，隊伍與陣型沒變就不重算 */
  private chanceKey = '';
  private chance = 0;

  constructor() {
    super('ExpeditionScene');
  }

  init(data: ExpeditionData): void {
    this.stage = findStage(data?.stageId ?? '') ?? null;
    this.chapter = data?.chapter ?? 0;
    const st = tick();
    const busy = busyDogIds(st);
    this.max = stageTeamMax(this.stage?.id ?? '');
    // 組隊編排的隊伍超過這一關的上限時，留戰力最高的幾隻
    this.selected = this.fit(st.team.filter((id) => st.owned.includes(id) && !busy.has(id)));
    this.shop = null;
    this.result = null;
    this.chanceKey = '';
    this.confirmButton = null;
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
    const brief = `體力 ${STAMINA_COST}・建議戰力 ${stage.recommendedPower}・可上陣 ${this.max} 隻`;
    // 橫式標題列右邊還要放體力與次數，只留關卡名與上陣數（建議戰力在左欄）
    const short = `${stage.name}・可上陣 ${this.max} 隻`;
    // 橫式高度不夠，關卡資訊併進標題列
    this.back = drawHeader(this, landscape ? short : `出征・${stage.name}`, () =>
      this.scene.start('CampaignScene', { chapter: this.chapter }),
    );
    if (!landscape) {
      this.text(w / 2, BAR_HEIGHT + 22, brief, 17, COLORS.ink, true).setOrigin(0.5);
    }
    this.confirmRect = landscape
      ? { x: 16, y: h - 66, width: SIDE_WIDTH, height: 54 }
      : { x: 24, y: h - 96, width: w - 48, height: 64 };
    // 目前體力與今日次數：直式放在戰力那一行上面，橫式放標題列右邊
    this.statusText = landscape
      ? this.text(w - 14, BAR_HEIGHT / 2, '', 15, COLORS.barText, true)
          .setOrigin(1, 0.5)
          .setDepth(51)
      : this.text(w / 2, this.confirmRect.y - 42, '', 15, COLORS.inkSoft, true)
          .setOrigin(0.5)
          .setDepth(1);
    // 放在卡片格上面，捲動時出發按鈕不會被卡片擋住
    this.layer = this.add.container(0, 0).setDepth(1);
    this.picker = new DogPicker(this, {
      mode: 'expedition',
      top: landscape ? BAR_HEIGHT + 6 : BAR_HEIGHT + 40,
      bottom: landscape ? h - 12 : this.confirmRect.y - 62,
      slotsBottom: landscape ? this.confirmRect.y - 48 : undefined,
      dogs: () => DOGS.filter((d) => getState().owned.includes(d.id)),
      selected: () => this.selected,
      title: () => `${landscape ? '隊伍' : '出征隊伍'} ${this.selected.length}/${this.max}`,
      teams: {
        index: () => getState().teamIndex,
        // 目前這組顯示畫面上正在選的隻數
        sizes: () =>
          presetSizes(getState()).map((n, i) =>
            i === getState().teamIndex ? this.selected.length : n,
          ),
        onSwitch: (i) => {
          // 換一組：帶入那一組存好的成員與站位
          const st = switchTeam(getState(), i);
          setState(st);
          this.selected = this.fit(st.team);
          this.render();
        },
      },
      onSlotTap: (id) => this.toggleDog(id),
      onCellTap: (dog) => this.toggleDog(dog.id),
      onAuto: () => {
        const st = getState();
        const team = autoTeam(DOGS, dogContext(st), this.max);
        if (team.length > 0) {
          this.selected = team;
          // 站位也照定位重新排好
          setState(resetFormation(st, team));
        }
        this.render();
      },
      onPlace: (id, row, lane) => {
        const r = placeDog(getState(), this.selected, id, row, lane, this.max);
        if (!r.error) {
          this.selected = r.team;
          setState(r.state);
          this.render();
        }
        return r.error;
      },
      locked: () => !!(this.shop || this.result),
      onUpdate: () => this.publish(),
    });
    this.render();
    this.time.addEvent({ delay: REFRESH_MS, loop: true, callback: () => this.refresh() });
  }

  /** 超過這一關上陣上限的隊伍：留戰力最高的幾隻，順序不變 */
  private fit(team: readonly string[]): string[] {
    if (team.length <= this.max) return [...team];
    const st = getState();
    const keep = new Set(
      [...team].sort((a, b) => dogPower(st, b) - dogPower(st, a)).slice(0, this.max),
    );
    return team.filter((id) => keep.has(id));
  }

  /** 現在能不能開戰（體力、今日次數） */
  private block(): RunBlock {
    return runBlock(tick(), this.stage!.id, Date.now(), timeOptions());
  }

  /** 定時更新體力與倒數；能不能開戰的狀態變了才整個重畫 */
  private refresh(): void {
    if (this.result) return;
    const b = this.block();
    if ((b.ok ? 'ok' : b.reason) !== this.blockKey) {
      this.render();
      return;
    }
    this.updateStatus(b);
    this.publish();
  }

  private updateStatus(b: RunBlock): void {
    const st = getState();
    const now = Date.now();
    const o = timeOptions();
    const id = this.stage!.id;
    this.statusText.setText(
      `體力 ${st.stamina.value}/${STAMINA_MAX}・今日剩 ${runsLeft(st, id, now, o)}/${runsTotal(st, id, now, o)} 次`,
    );
    const ready = this.selected.length >= TEAM_MIN && this.selected.length <= this.max;
    if (!b.ok) {
      const wait = formatCountdown(b.waitMs);
      this.confirmLabel = b.reason === 'no-runs' ? `次數用完 ${wait}` : `體力不足 ${wait}`;
    } else {
      this.confirmLabel = ready ? '開戰！' : `開戰（已選 ${this.selected.length}/${this.max}）`;
    }
    this.confirmReady = b.ok && ready;
    this.confirmButton?.setText(this.confirmLabel).setEnabled(this.confirmReady);
  }

  /** 下方（橫式在左欄下方）的戰力、勝率與出發按鈕，再重畫選狗區 */
  private render(): void {
    this.layer.removeAll(true);
    const stage = this.stage!;
    const { w, landscape } = viewOf(this);
    const confirm = this.confirmRect;

    const power = teamPower(getState(), this.selected);
    const chance = this.winChance();
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

    // 體力不夠或次數用完：開戰按鈕縮短，右邊多一顆「補體力／加次數」
    const b = this.block();
    this.blockKey = b.ok ? 'ok' : b.reason;
    this.buyKind = b.ok ? null : b.reason === 'no-runs' ? 'runs' : 'stamina';
    // 橫式左欄比較窄，按鈕與字都小一點
    const buyW = landscape ? 76 : BUY_WIDTH;
    const main: Rect = b.ok ? confirm : { ...confirm, width: confirm.width - buyW - 8 };
    this.buyRect = b.ok ? null : { ...confirm, x: confirm.x + confirm.width - buyW, width: buyW };
    this.confirmButton = new Button(
      this,
      main,
      '',
      () => this.confirm(),
      b.ok ? 24 : landscape ? 13 : 19,
    );
    this.layer.add(this.confirmButton);
    if (this.buyRect && this.buyKind) {
      const kind = this.buyKind;
      const buy = new Button(
        this,
        this.buyRect,
        kind === 'runs' ? '加次數' : '補體力',
        () => this.openShop(kind),
        19,
      );
      buy.setColor(COLORS.harvest);
      this.layer.add(buy);
    }
    this.updateStatus(b);

    this.picker.render();
  }

  /** 勝率約幾成：照目前的隊伍與陣型模擬很多場（自動放招） */
  private winChance(): number {
    const st = getState();
    const key = JSON.stringify([this.selected, st.formation, st.dogs]);
    if (key !== this.chanceKey) {
      this.chanceKey = key;
      this.chance = stageWinChance(st, this.stage!.id, this.selected);
    }
    return this.chance;
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
          ...(this.confirmButton?.rect ?? this.confirmRect),
        },
        buyButton: this.buyRect && this.buyKind ? { kind: this.buyKind, ...this.buyRect } : null,
        runsLeft: runsLeft(getState(), this.stage!.id, Date.now(), timeOptions()),
        winChance: this.chance,
      },
      stamina: { value: getState().stamina.value, max: STAMINA_MAX },
      resources: { ...getState().resources },
    });
  }

  private openShop(kind: ShopKind): void {
    if (this.shop || this.result || this.picker.wasDragged) return;
    this.shop = new StaminaShop(this, kind, this.stage!.id, () => {
      this.shop = null;
      this.render();
    });
  }

  private toggleDog(id: string): void {
    if (busyDogIds(getState()).has(id)) return; // 寄宿中的不能選
    const full = !this.selected.includes(id) && this.selected.length >= this.max;
    // 其他隊友留在原本的格子上（九宮格）
    if (!full) setState(freezeCells(getState(), this.selected));
    if (this.selected.includes(id)) {
      this.selected = this.selected.filter((x) => x !== id);
    } else if (this.selected.length < this.max) {
      this.selected = [...this.selected, id];
    } else {
      return; // 已滿，先取消一隻才能換
    }
    this.render();
  }

  /**
   * 開戰：扣體力與次數。預設進戰鬥畫面一步一步打，打完才結算；
   * 設定開了「略過戰鬥畫面」就用自動放招當下算完，直接看結算。
   */
  private confirm(): void {
    if (!this.stage || this.shop || this.result || this.picker.wasDragged) return;
    const stage = this.stage;
    const before = tick();
    const opts = {
      ...timeOptions(),
      // 這一仗的亂數種子：開戰時就定下來，之後不能重抽（測試模式可用 &seed= 指定）
      seed: battleSeedFromSearch(window.location.search) ?? Math.floor(Math.random() * 0x100000000),
    };
    if (!before.settings.skipBattle) {
      const b = beginExpedition(before, stage.id, this.selected, Date.now(), opts);
      if (!b.ok) {
        this.render();
        return;
      }
      setState(b.state);
      this.scene.start('BattleScene', { chapter: this.chapter });
      return;
    }
    const r = runExpedition(before, stage.id, this.selected, Date.now(), opts);
    if (!r.ok) {
      this.render();
      return;
    }
    setState(r.state);
    const record = r.record;
    const storyId = newStoriesAfter(r.state, stage.id)[0]?.id;
    // 設定開了「略過戰鬥畫面」：直接看結算，關掉後回地圖
    this.result = new ResultPanel(
      this,
      stage.name,
      record.reward,
      record.win,
      () => {
        patchDebug({ result: null, growth: null });
        if (storyId) this.scene.start('StoryScene', { mode: 'play', storyId });
        else this.scene.start('CampaignScene', { chapter: this.chapter });
      },
      resultNotes(before, r.state, record),
      record.gains,
    );
    patchDebug({
      result: { ...record.reward, win: record.win, newDogId: record.newDogId },
      growth: record.gains,
      resources: { ...r.state.resources },
      stamina: { value: r.state.stamina.value, max: STAMINA_MAX },
    });
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
