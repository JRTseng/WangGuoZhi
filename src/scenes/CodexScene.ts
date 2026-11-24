import { bondView } from '../logic/bond';
import Phaser from 'phaser';
import { COLORS, RARITY_COLORS, rarityHex } from '../config';
import { BACKGROUNDS } from '../data/backgrounds';
import type { DogData, DogRarity } from '../data/dogs';
import { ALL_GEARS, GEAR_SLOT_LABEL } from '../data/equipment';
import { wt } from '../data/worldText';
import {
  CODEX_PAGES,
  CODEX_PAGE_NAMES,
  CODEX_PAGE_UNITS,
  CODEX_RARITIES,
  claimCodex,
  codexBackgroundEntries,
  codexClaimable,
  codexEntries,
  codexGearEntries,
  codexMilestones,
  codexPageCount,
  codexRarityCounts,
  codexTiers,
  gearSource,
  type CodexGearEntry,
  type CodexPage,
} from '../logic/codex';
import {
  CODEX_BACKGROUND_COLUMNS,
  codexColumnsFor,
  codexLayout,
  type CodexLayout,
} from '../logic/codexLayout';
import { gearAtStar, gearBonusLabel } from '../logic/equipment';
import { playerFaction } from '../logic/faction';
import { gearStarText } from '../logic/gearStar';
import { dogStats } from '../logic/leveling';
import { perkText } from '../logic/levelSkills';
import { setBackground } from '../logic/progress';
import { rewardText } from '../logic/quests';
import { getState, setState } from '../state/store';
import { Button } from './components/Button';
import { DogInfoPanel, type DogInfoTab } from './components/DogInfoPanel';
import { playSfx } from './components/audio';
import { Scenery } from './components/Scenery';
import { drawDogHead } from './components/dogArt';
import { drawGearIcon } from './components/gearArt';
import { headLook } from './components/headLook';
import { addText, drawHeader, openModal, patchDebug, resetDebug, viewOf } from './ui';

const BAR = 56;
const DOT = 0xe0452b;
const DONE = 0x4f8a3c;
/** 還沒有的格子底色 */
const MISSING = 0xe6dccb;
/** 背景縮圖先照這個倍數畫大再縮小，縮圖才不會糊成一團 */
const THUMB_SCALE = 2;

/**
 * 圖鑑（T038）：主頁右上「圖鑑」進來。
 * 左邊是分頁（汪國／喵國／裝備／背景）、收集進度與收集獎勵，右邊把這一頁的東西全部排出來：
 * 有的亮著、還沒有的暗著。角色點一下看資料與小故事（T041，有的角色才看得到故事）；
 * 裝備點一下看說明與怎麼拿（T043）；背景點一下直接換成主頁背景，還沒有的告訴你怎麼拿（T043）。
 * 每一頁收集到一定數量各領一次獎勵。
 */
export class CodexScene extends Phaser.Scene {
  private page: CodexPage = 'dog';
  private body!: Phaser.GameObjects.Container;
  /** 背景頁的縮圖：進這一頁時畫一次，離開這一頁才收掉（每次重畫都重做太慢） */
  private thumbs: Phaser.GameObjects.Container | null = null;
  /** 開著說明視窗的裝備 */
  private gearInfo: { id: string; layer: Phaser.GameObjects.Container } | null = null;
  /** 一進來要開哪一頁（別的畫面指定的） */
  private startPage: CodexPage | null = null;
  private panel: DogInfoPanel | null = null;
  private panelDogId: string | null = null;
  /** 資料視窗右半邊開哪一頁（T041）：圖鑑先給看小故事，換過頁就記著 */
  private panelTab: DogInfoTab = 'story';
  private toast: Phaser.GameObjects.Text | null = null;

  constructor() {
    super('CodexScene');
  }

  init(data?: { page?: CodexPage }): void {
    this.startPage = data?.page && CODEX_PAGES.includes(data.page) ? data.page : null;
  }

  create(): void {
    resetDebug(this);
    this.panel = null;
    this.panelDogId = null;
    this.toast = null;
    this.thumbs = null;
    this.gearInfo = null;
    const { w, h } = viewOf(this);
    const st = getState();
    // 先看自己的陣營；自己這邊沒獎勵、別頁有的話先開有獎勵的那一頁
    const mine = playerFaction(st);
    this.page =
      this.startPage ??
      (codexClaimable(st, mine) > 0
        ? mine
        : (CODEX_PAGES.find((p) => codexClaimable(st, p) > 0) ?? mine));
    this.add.rectangle(0, 0, w, h, COLORS.background).setOrigin(0, 0);
    const back = drawHeader(this, '圖鑑', () => this.scene.start('LobbyScene'), BAR);
    // 背景頁的縮圖墊在下面，框、字與蓋暗的那一層要壓在縮圖上
    this.body = this.add.container(0, 0).setDepth(1);
    this.render();
    patchDebug({ backButton: back });
  }

  /** 這一頁的排版：格子數量與欄數每一頁不一樣 */
  private layoutFor(page: CodexPage): CodexLayout {
    const { w, h } = viewOf(this);
    const count =
      page === 'gear'
        ? ALL_GEARS.length
        : page === 'background'
          ? BACKGROUNDS.length
          : codexEntries(getState(), page).length;
    const columns =
      page === 'background' ? CODEX_BACKGROUND_COLUMNS : codexColumnsFor(count, h, BAR);
    return codexLayout(w, h, BAR, count, CODEX_PAGES.length, codexTiers(page).length, columns);
  }

  private render(): void {
    const st = getState();
    const page = this.page;
    const L = this.layoutFor(page);
    this.body.removeAll(true);
    if (page !== 'background') {
      this.thumbs?.destroy();
      this.thumbs = null;
    }

    // 分頁
    const tabDebug = {} as Record<CodexPage, WgzRect & { count: number }>;
    CODEX_PAGES.forEach((p, i) => {
      const r = L.tabs[i];
      const count = codexClaimable(st, p);
      const b = new Button(this, r, CODEX_PAGE_NAMES[p], () => this.switchPage(p), 17);
      b.setColor(p === page ? COLORS.button : COLORS.bar);
      this.body.add(b);
      if (count > 0) {
        this.body.add(
          this.add.circle(r.x + r.width - 6, r.y + 6, 7, DOT).setStrokeStyle(2, 0xffffff),
        );
      }
      tabDebug[p] = { ...r, count };
    });

    // 收集進度
    const total = codexPageCount(st, page);
    this.body.add(
      addText(
        this,
        L.count.x,
        L.count.y,
        `收集 ${total.owned}／${total.total}`,
        17,
        COLORS.ink,
        true,
      ),
    );
    if (page === 'background') {
      const now = BACKGROUNDS.find((b) => b.id === st.backgroundId)?.name ?? '';
      this.body.add([
        addText(this, L.rarity.x, L.rarity.y, '主頁現在用', 12, COLORS.inkSoft),
        addText(this, L.rarity.x, L.rarity.y + 15, now, 12, COLORS.ink, true),
      ]);
    } else {
      const byRarity = page === 'gear' ? gearRarityCounts(st) : codexRarityCounts(st, page);
      CODEX_RARITIES.forEach((r, i) => {
        this.body.add(
          addText(
            this,
            L.rarity.x + (i % 2) * 68,
            L.rarity.y + Math.floor(i / 2) * 15,
            `${r} ${byRarity[r].owned}/${byRarity[r].total}`,
            12,
            rarityHex(r),
            true,
          ),
        );
      });
    }

    // 收集獎勵
    const unit = CODEX_PAGE_UNITS[page];
    const milestones = codexMilestones(st, page);
    milestones.forEach((m, i) => {
      const p = L.milestones[i];
      const ready = m.done && !m.claimed;
      this.body.add(
        addText(
          this,
          p.x,
          p.y,
          `${m.claimed ? '✓' : '・'}${m.target} ${unit}\u3000${rewardText(m.reward)}`,
          12,
          m.claimed ? '#b9a48c' : ready ? '#2f7d32' : COLORS.inkSoft,
          ready,
        ),
      );
    });
    const claimable = milestones.filter((m) => m.done && !m.claimed).length;
    const claim = new Button(
      this,
      L.claim,
      claimable > 0 ? `領取獎勵 ${claimable}` : '領取獎勵',
      () => this.claim(),
      17,
    );
    claim.setColor(DONE).setEnabled(claimable > 0);
    this.body.add(claim);

    // 格子
    const cells =
      page === 'gear'
        ? this.renderGears(L)
        : page === 'background'
          ? this.renderBackgrounds(L)
          : this.renderCharacters(L, page);

    patchDebug({
      resources: { ...st.resources },
      codex: {
        faction: page,
        owned: total.owned,
        total: total.total,
        tabs: tabDebug,
        claim: { ...L.claim, count: claimable },
        milestones: milestones.map((m) => ({
          id: m.id,
          target: m.target,
          bones: m.reward.bones,
          done: m.done,
          claimed: m.claimed,
        })),
        cells,
        panel: this.panelDogId,
        panelClose: this.panel?.buttons.close ?? null,
        panelTab: this.panel ? this.panel.tab : null,
        panelTabButton: this.panel?.buttons.tab ?? null,
        gearInfo: this.gearInfo?.id ?? null,
        background: st.backgroundId,
      },
    });
  }

  /** 角色格子（汪國／喵國） */
  private renderCharacters(L: CodexLayout, faction: 'dog' | 'cat'): CodexCellDebug[] {
    const st = getState();
    const entries = codexEntries(st, faction).slice(0, L.cells.length);
    const g = this.add.graphics();
    this.body.add(g);
    entries.forEach((e, i) => {
      const c = L.cells[i];
      const d = e.dog;
      const rarity = d.rarity ?? 'N';
      g.fillStyle(e.owned ? COLORS.card : MISSING, 1);
      g.lineStyle(2, e.owned ? RARITY_COLORS[rarity] : COLORS.cardBorder, e.owned ? 1 : 0.6);
      g.fillRoundedRect(c.x, c.y, c.width, c.height, 9);
      g.strokeRoundedRect(c.x, c.y, c.width, c.height, 9);
      const hr = Math.min(15, (c.height - 24) / 2);
      drawDogHead(g, c.x + c.width / 2, c.y + 7 + hr, hr, d.color, d.accent, {
        ...(e.owned ? headLook(st, d.id) : {}),
        dark: !e.owned,
        breed: d.breed,
        photo: d.id,
      });
      const name = addText(
        this,
        c.x + c.width / 2,
        c.y + c.height - 9,
        d.name,
        12,
        e.owned ? COLORS.ink : COLORS.inkSoft,
        e.owned,
      ).setOrigin(0.5);
      if (name.width > c.width - 4) name.setScale((c.width - 4) / name.width);
      this.body.add([
        name,
        addText(this, c.x + 4, c.y + 2, rarity, 9, rarityHex(rarity), true).setAlpha(
          e.owned ? 1 : 0.7,
        ),
        this.tapZone(c, () => this.openPanel(d)),
      ]);
    });
    return entries.map((e, i) => ({
      ...L.cells[i],
      id: e.dog.id,
      rarity: e.dog.rarity ?? 'N',
      owned: e.owned,
    }));
  }

  /** 裝備格子（T043）：有的照原本的顏色畫，還沒有的畫成灰色 */
  private renderGears(L: CodexLayout): CodexCellDebug[] {
    const entries = codexGearEntries(getState()).slice(0, L.cells.length);
    const g = this.add.graphics();
    this.body.add(g);
    entries.forEach((e, i) => {
      const c = L.cells[i];
      const gear = e.gear;
      g.fillStyle(e.owned ? COLORS.card : MISSING, 1);
      g.lineStyle(2, e.owned ? RARITY_COLORS[gear.rarity] : COLORS.cardBorder, e.owned ? 1 : 0.6);
      g.fillRoundedRect(c.x, c.y, c.width, c.height, 9);
      g.strokeRoundedRect(c.x, c.y, c.width, c.height, 9);
      const s = Math.min(12, (c.height - 22) / 2);
      drawGearIcon(
        g,
        c.x + c.width / 2,
        c.y + 6 + s,
        s,
        e.owned ? gear : { ...gear, color: 0xa89c8c, accent: 0x8a7e6f },
      );
      const name = addText(
        this,
        c.x + c.width / 2,
        c.y + c.height - 8,
        gear.name,
        11,
        e.owned ? COLORS.ink : COLORS.inkSoft,
        e.owned,
      ).setOrigin(0.5);
      if (name.width > c.width - 4) name.setScale((c.width - 4) / name.width);
      this.body.add([
        name,
        addText(this, c.x + 3, c.y + 1, gear.rarity, 9, rarityHex(gear.rarity), true).setAlpha(
          e.owned ? 1 : 0.7,
        ),
        this.tapZone(c, () => this.openGearInfo(e)),
      ]);
      if (e.star > 0) {
        this.body.add(
          addText(this, c.x + c.width - 3, c.y + 1, `★${e.star}`, 9, '#d99a1c', true).setOrigin(
            1,
            0,
          ),
        );
      }
    });
    return entries.map((e, i) => ({
      ...L.cells[i],
      id: e.gear.id,
      rarity: e.gear.rarity,
      owned: e.owned,
    }));
  }

  /** 背景格子（T043）：每張都是場景的縮圖；有的點一下換成主頁背景，還沒有的蓋暗、寫怎麼拿 */
  private renderBackgrounds(L: CodexLayout): CodexCellDebug[] {
    const st = getState();
    const entries = codexBackgroundEntries(st).slice(0, L.cells.length);
    const LABEL = 20;
    if (!this.thumbs) {
      // 縮圖不會動（低畫質的畫法），畫一次留著；換主頁背景只重畫上面的框與字
      const thumbs = (this.thumbs = this.add.container(0, 0));
      entries.forEach((e, i) => {
        const c = L.cells[i];
        const pic = new Scenery(
          this,
          {
            x: c.x + 2,
            y: c.y + 2,
            width: (c.width - 4) * THUMB_SCALE,
            height: (c.height - 4 - LABEL) * THUMB_SCALE,
          },
          e.background.id,
          'low',
          0.6,
        ).setScale(1 / THUMB_SCALE);
        thumbs.add(pic);
      });
    }
    const g = this.add.graphics();
    this.body.add(g);
    entries.forEach((e, i) => {
      const c = L.cells[i];
      const picH = c.height - 4 - LABEL;
      if (!e.owned) {
        g.fillStyle(0x2a2018, 0.72);
        g.fillRect(c.x + 2, c.y + 2, c.width - 4, picH);
      }
      // 名字那一條
      g.fillStyle(e.current ? 0xffe2c2 : e.owned ? COLORS.card : MISSING, 1);
      g.fillRect(c.x + 2, c.y + 2 + picH, c.width - 4, LABEL);
      g.lineStyle(e.current ? 4 : 2, e.current ? COLORS.button : COLORS.cardBorder, 1);
      g.strokeRoundedRect(c.x + 1, c.y + 1, c.width - 2, c.height - 2, 6);
      const name = addText(
        this,
        c.x + c.width / 2,
        c.y + 2 + picH + LABEL / 2,
        e.background.name,
        12,
        e.owned ? COLORS.ink : COLORS.inkSoft,
        e.owned,
      ).setOrigin(0.5);
      if (name.width > c.width - 8) name.setScale((c.width - 8) / name.width);
      this.body.add(name);
      if (!e.owned) {
        this.body.add(
          addText(
            this,
            c.x + c.width / 2,
            c.y + 2 + picH / 2,
            `還沒拿到\n${e.background.howToGet}`,
            12,
            '#fff6e8',
            true,
          )
            .setOrigin(0.5)
            .setAlign('center'),
        );
      } else if (e.current) {
        this.body.add(
          addText(this, c.x + 6, c.y + 6, '使用中', 11, '#ffffff', true)
            .setPadding(5, 2, 5, 2)
            .setBackgroundColor('#b5651d'),
        );
      }
      this.body.add(this.tapZone(c, () => this.pickBackground(e.background.id)));
    });
    return entries.map((e, i) => ({
      ...L.cells[i],
      id: e.background.id,
      rarity: '',
      owned: e.owned,
      current: e.current,
    }));
  }

  private tapZone(c: WgzRect, onTap: () => void): Phaser.GameObjects.Zone {
    return this.add
      .zone(c.x, c.y, c.width, c.height)
      .setOrigin(0, 0)
      .setInteractive({ cursor: 'pointer' })
      .on('pointerdown', () => playSfx('tap'))
      .on('pointerup', onTap);
  }

  private switchPage(p: CodexPage): void {
    if (p === this.page) return;
    this.page = p;
    this.render();
  }

  /** 點背景：有的換成主頁背景，還沒有的說怎麼拿 */
  private pickBackground(id: (typeof BACKGROUNDS)[number]['id']): void {
    const before = getState();
    const data = BACKGROUNDS.find((b) => b.id === id);
    if (!data) return;
    if (id === before.backgroundId) {
      this.showToast(`主頁現在就是「${data.name}」`);
      return;
    }
    const after = setBackground(before, id);
    if (after === before) {
      this.showToast(`還沒拿到：${data.howToGet}`);
      return;
    }
    setState(after);
    this.render();
    this.showToast(`主頁背景換成「${data.name}」`);
  }

  /** 裝備的說明視窗：名字、加成、名字的由來、怎麼拿；點旁邊或「關閉」收起來 */
  private openGearInfo(e: CodexGearEntry): void {
    if (this.gearInfo || this.panel) return;
    const gear = e.gear;
    const { layer, box } = openModal(
      this,
      { width: 440, height: 236 },
      () => this.closeGearInfo(),
      e.owned ? RARITY_COLORS[gear.rarity] : 0x6b5a4a,
    );
    const g = this.add.graphics();
    const s = 30;
    const ix = box.x + 24 + s;
    const iy = box.y + 26 + s;
    drawGearIcon(g, ix, iy, s, e.owned ? gear : { ...gear, color: 0xa89c8c, accent: 0x8a7e6f });
    const tx = ix + s + 20;
    const textW = box.x + box.width - 24 - tx;
    const kind = gear.exclusive ? '專屬' : gear.tower ? '爬塔飾品' : '';
    const perks = gear.perks ? perkText(gear.perks) : '';
    const lines: Phaser.GameObjects.GameObject[] = [
      g,
      addText(this, tx, box.y + 22, gear.name, 22, COLORS.ink, true),
      addText(
        this,
        tx,
        box.y + 54,
        [gear.rarity, GEAR_SLOT_LABEL[gear.slot], kind].filter(Boolean).join('・'),
        14,
        rarityHex(gear.rarity),
        true,
      ),
      addText(
        this,
        tx,
        box.y + 76,
        e.owned
          ? `持有 ${e.count} 件\u3000${gearStarText(e.star)}\u3000${gearBonusLabel(gearAtStar(gear, e.star))}`
          : `尚未擁有\u3000${gearBonusLabel(gear)}`,
        14,
        e.owned ? COLORS.ink : '#c0392b',
        true,
      ).setWordWrapWidth(textW),
      addText(
        this,
        box.x + 24,
        box.y + 106,
        [
          perks ? `功能：${perks}` : '',
          `名字出自「${gear.pun}」`,
          wt(gear.note),
          `怎麼拿：${gearSource(gear)}`,
        ]
          .filter(Boolean)
          .join('\n'),
        14,
        COLORS.inkSoft,
      )
        .setWordWrapWidth(box.width - 48, true)
        .setLineSpacing(4),
    ];
    const close = { x: box.x + box.width - 96, y: box.y + box.height - 54, width: 80, height: 44 };
    lines.push(new Button(this, close, '關閉', () => this.closeGearInfo(), 17));
    layer.add(lines);
    this.gearInfo = { id: gear.id, layer };
    patchDebug({
      codex: { ...window.__WGZ__!.codex!, gearInfo: gear.id, gearInfoClose: close },
    });
  }

  private closeGearInfo(): void {
    if (!this.gearInfo) return;
    this.gearInfo.layer.destroy();
    this.gearInfo = null;
    patchDebug({ codex: { ...window.__WGZ__!.codex!, gearInfo: null, gearInfoClose: null } });
  }

  private claim(): void {
    const r = claimCodex(getState(), this.page);
    if (r.count === 0) return;
    setState(r.state);
    playSfx('levelup');
    this.render();
    this.showToast(`領取：${rewardText(r.reward)}`);
  }

  private openPanel(d: DogData): void {
    if (this.panel || this.gearInfo) return;
    const st = getState();
    const owned = st.owned.includes(d.id);
    this.panelDogId = d.id;
    this.panel = new DogInfoPanel(this, d, {
      stats: dogStats(st, d),
      owned,
      inTeam: st.team.includes(d.id),
      teamFull: false,
      isLobby: st.lobbyDogId === d.id,
      look: owned ? headLook(st, d.id) : undefined,
      bond: bondView(st, d.id),
      onClose: () => this.closePanel(),
      tab: this.panelTab,
      onTab: (tab) => {
        this.panelTab = tab;
        patchDebug({ codex: { ...window.__WGZ__!.codex!, panelTab: tab } });
      },
    });
    this.render();
  }

  private closePanel(): void {
    this.panel?.destroy();
    this.panel = null;
    this.panelDogId = null;
    this.render();
  }

  private showToast(text: string): void {
    this.toast?.destroy();
    const { w } = viewOf(this);
    const t = addText(this, w - 12, BAR / 2, text, 15, '#ffffff', true)
      .setOrigin(1, 0.5)
      .setPadding(14, 8, 14, 8)
      .setBackgroundColor('#4f8a3c')
      .setDepth(60);
    this.toast = t;
    this.tweens.add({
      targets: t,
      alpha: 0,
      delay: 1600,
      duration: 400,
      onComplete: () => {
        if (this.toast === t) this.toast = null;
        t.destroy();
      },
    });
  }
}

type CodexCellDebug = NonNullable<WgzDebugState['codex']>['cells'][number];

/** 各稀有度的裝備收集了幾種、一共幾種 */
function gearRarityCounts(
  state: Parameters<typeof codexGearEntries>[0],
): Record<DogRarity, { owned: number; total: number }> {
  const out = Object.fromEntries(CODEX_RARITIES.map((r) => [r, { owned: 0, total: 0 }])) as Record<
    DogRarity,
    { owned: number; total: number }
  >;
  for (const e of codexGearEntries(state)) {
    out[e.gear.rarity].total += 1;
    if (e.owned) out[e.gear.rarity].owned += 1;
  }
  return out;
}
