import Phaser from 'phaser';
import { COLORS, RARITY_COLORS, rarityHex } from '../config';
import { FACTIONS, FACTION_NAMES, type DogData, type Faction } from '../data/dogs';
import {
  CODEX_RARITIES,
  claimCodex,
  codexClaimable,
  codexCount,
  codexEntries,
  codexMilestones,
  codexRarityCounts,
} from '../logic/codex';
import { codexLayout, type CodexLayout } from '../logic/codexLayout';
import { playerFaction } from '../logic/faction';
import { dogStats } from '../logic/leveling';
import { rewardText } from '../logic/quests';
import { getState, setState } from '../state/store';
import { Button } from './components/Button';
import { DogInfoPanel, type DogInfoTab } from './components/DogInfoPanel';
import { playSfx } from './components/audio';
import { drawDogHead } from './components/dogArt';
import { headLook } from './components/headLook';
import { addText, drawHeader, patchDebug, resetDebug, viewOf } from './ui';

const BAR = 56;
const DOT = 0xe0452b;
const DONE = 0x4f8a3c;

/**
 * 圖鑑（T038）：主頁右上「圖鑑」進來。
 * 左邊是陣營分頁（汪國／喵國）、收集進度與收集獎勵，右邊把這個陣營的角色全部排出來：
 * 有的亮著、還沒有的暗著，點一下看資料與小故事（T041，有的角色才看得到故事）。收集到 10／20／30／40／50 隻各領一次獎勵。
 */
export class CodexScene extends Phaser.Scene {
  private layout!: CodexLayout;
  private faction: Faction = 'dog';
  private body!: Phaser.GameObjects.Container;
  private panel: DogInfoPanel | null = null;
  private panelDogId: string | null = null;
  /** 資料視窗右半邊開哪一頁（T041）：圖鑑先給看小故事，換過頁就記著 */
  private panelTab: DogInfoTab = 'story';
  private toast: Phaser.GameObjects.Text | null = null;

  constructor() {
    super('CodexScene');
  }

  create(): void {
    resetDebug(this);
    this.panel = null;
    this.panelDogId = null;
    this.toast = null;
    const { w, h } = viewOf(this);
    const st = getState();
    // 先看自己的陣營；自己這邊沒獎勵、另一邊有的話先開另一邊
    const mine = playerFaction(st);
    this.faction =
      codexClaimable(st, mine) > 0
        ? mine
        : (FACTIONS.find((f) => codexClaimable(st, f) > 0) ?? mine);
    this.layout = codexLayout(w, h, BAR, codexEntries(st, this.faction).length, FACTIONS.length);
    this.add.rectangle(0, 0, w, h, COLORS.background).setOrigin(0, 0);
    const back = drawHeader(this, '圖鑑', () => this.scene.start('LobbyScene'), BAR);
    this.body = this.add.container(0, 0);
    this.render();
    patchDebug({ backButton: back });
  }

  private render(): void {
    const st = getState();
    const L = this.layout;
    this.body.removeAll(true);

    // 陣營分頁
    const tabDebug = {} as Record<Faction, WgzRect & { count: number }>;
    FACTIONS.forEach((f, i) => {
      const r = L.tabs[i];
      const count = codexClaimable(st, f);
      const b = new Button(this, r, FACTION_NAMES[f], () => this.switchFaction(f), 17);
      b.setColor(f === this.faction ? COLORS.button : COLORS.bar);
      this.body.add(b);
      if (count > 0) {
        this.body.add(
          this.add.circle(r.x + r.width - 6, r.y + 6, 7, DOT).setStrokeStyle(2, 0xffffff),
        );
      }
      tabDebug[f] = { ...r, count };
    });

    // 收集進度
    const total = codexCount(st, this.faction);
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
    const byRarity = codexRarityCounts(st, this.faction);
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

    // 收集獎勵
    const milestones = codexMilestones(st, this.faction);
    milestones.forEach((m, i) => {
      const p = L.milestones[i];
      const ready = m.done && !m.claimed;
      this.body.add(
        addText(
          this,
          p.x,
          p.y,
          `${m.claimed ? '✓' : '・'}${m.target} 隻\u3000${rewardText(m.reward)}`,
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

    // 角色格子
    const entries = codexEntries(st, this.faction).slice(0, L.cells.length);
    const g = this.add.graphics();
    this.body.add(g);
    entries.forEach((e, i) => {
      const c = L.cells[i];
      const d = e.dog;
      const rarity = d.rarity ?? 'N';
      g.fillStyle(e.owned ? COLORS.card : 0xe6dccb, 1);
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
        this.add
          .zone(c.x, c.y, c.width, c.height)
          .setOrigin(0, 0)
          .setInteractive({ cursor: 'pointer' })
          .on('pointerdown', () => playSfx('tap'))
          .on('pointerup', () => this.openPanel(d)),
      ]);
    });

    patchDebug({
      resources: { ...st.resources },
      codex: {
        faction: this.faction,
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
        cells: entries.map((e, i) => ({
          ...L.cells[i],
          id: e.dog.id,
          rarity: e.dog.rarity ?? 'N',
          owned: e.owned,
        })),
        panel: this.panelDogId,
        panelClose: this.panel?.buttons.close ?? null,
        panelTab: this.panel ? this.panel.tab : null,
        panelTabButton: this.panel?.buttons.tab ?? null,
      },
    });
  }

  private switchFaction(f: Faction): void {
    if (f === this.faction) return;
    this.faction = f;
    this.render();
  }

  private claim(): void {
    const r = claimCodex(getState(), this.faction);
    if (r.count === 0) return;
    setState(r.state);
    playSfx('levelup');
    this.render();
    this.showToast(`領取：${rewardText(r.reward)}`);
  }

  private openPanel(d: DogData): void {
    if (this.panel) return;
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
