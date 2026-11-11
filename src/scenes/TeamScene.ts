import Phaser from 'phaser';
import { COLORS } from '../config';
import { DOGS, findDog, type DogData } from '../data/dogs';
import { TEAM_SIZE, busyDogIds } from '../logic/expedition';
import { layoutGrid, type Rect } from '../logic/layout';
import { dogPower, setLobbyDog, teamPower, toggleTeamMember } from '../logic/team';
import { getState, setState } from '../state/store';
import { DogInfoPanel } from './components/DogInfoPanel';
import { drawDogHead } from './components/dogArt';
import { makeTapArea } from './components/hitArea';
import { addText, darken, drawHeader, patchDebug, resetDebug, viewOf } from './ui';

const BAR = 56;

/**
 * 組隊編排：
 * - 上方（橫式在左側）3 個隊伍格，點已放的狗可移出
 * - 下方列出官方已釋放的全部狗狗；沒擁有的用暗色顯示
 * - 點狗狗開資訊面板：加入／移出隊伍、設為主頁角色
 */
export class TeamScene extends Phaser.Scene {
  private layer!: Phaser.GameObjects.Container;
  private panel: DogInfoPanel | null = null;
  private panelDogId: string | null = null;

  constructor() {
    super('TeamScene');
  }

  create(): void {
    this.panel = null;
    this.panelDogId = null;
    resetDebug(this);
    const { w, h } = viewOf(this);
    this.add.rectangle(0, 0, w, h, COLORS.background).setOrigin(0, 0);
    const back = drawHeader(this, '組隊編排', () => this.scene.start('LobbyScene'));
    patchDebug({ backButton: back });
    this.layer = this.add.container(0, 0);
    this.render();
  }

  private render(): void {
    this.layer.removeAll(true);
    const { w, h, landscape } = viewOf(this);
    const st = getState();
    const busy = busyDogIds(st);

    // ---- 隊伍格 ----
    const slotRects: Rect[] = [];
    if (landscape) {
      for (let i = 0; i < TEAM_SIZE; i++)
        slotRects.push({ x: 16, y: BAR + 34 + i * 90, width: 220, height: 80 });
    } else {
      const sw = (w - 32 - 20) / TEAM_SIZE;
      for (let i = 0; i < TEAM_SIZE; i++)
        slotRects.push({ x: 16 + i * (sw + 10), y: BAR + 40, width: sw, height: 112 });
    }
    const titleX = landscape ? 16 : 16;
    this.layer.add(
      addText(
        this,
        titleX,
        BAR + 10,
        `出征隊伍（${st.team.length}/${TEAM_SIZE}）`,
        17,
        COLORS.ink,
        true,
      ),
    );
    this.layer.add(
      addText(
        this,
        landscape ? 236 : w - 16,
        BAR + 10,
        `戰力 ${teamPower(st.team)}`,
        17,
        '#b5651d',
        true,
      ).setOrigin(1, 0),
    );
    slotRects.forEach((r, i) => this.drawSlot(r, st.team[i] ?? null, landscape));

    // ---- 全部角色 ----
    const area: Rect = landscape
      ? { x: 252, y: BAR + 34, width: w - 252 - 16, height: h - BAR - 34 - 12 }
      : { x: 16, y: BAR + 196, width: w - 32, height: h - BAR - 196 - 16 };
    this.layer.add(
      addText(
        this,
        area.x,
        area.y - 26,
        `全部角色（擁有 ${st.owned.length}/${DOGS.length}）`,
        17,
        COLORS.ink,
        true,
      ),
    );
    const rects = layoutGrid(DOGS.length, {
      area,
      columns: landscape ? 4 : 3,
      gap: 10,
      maxCellHeight: 150,
    });
    DOGS.forEach((d, i) => this.drawCell(d, rects[i], busy.has(d.id)));

    patchDebug({
      team: {
        slots: slotRects.map((r, i) => ({ id: st.team[i] ?? null, ...r })),
        dogs: DOGS.map((d, i) => ({
          id: d.id,
          owned: st.owned.includes(d.id),
          inTeam: st.team.includes(d.id),
          busy: busy.has(d.id),
          ...rects[i],
        })),
        panel: this.panelDogId,
        panelButtons: this.panel?.buttons ?? null,
        lobbyDogId: st.lobbyDogId,
      },
    });
  }

  private drawSlot(r: Rect, id: string | null, landscape: boolean): void {
    const c = this.add.container(r.x, r.y);
    const g = this.add.graphics();
    g.fillStyle(id ? COLORS.cardSelected : 0xefe3cf, 1);
    g.lineStyle(id ? 3 : 2, id ? COLORS.button : COLORS.cardBorder, 1);
    g.fillRoundedRect(0, 0, r.width, r.height, 14);
    g.strokeRoundedRect(0, 0, r.width, r.height, 14);
    c.add(g);
    const d = id ? findDog(id) : undefined;
    if (d) {
      const hg = this.add.graphics();
      if (landscape) {
        drawDogHead(hg, 44, r.height / 2 + 4, 26, d.color, d.accent);
        c.add([
          hg,
          addText(this, 84, 18, d.name, 20, COLORS.ink, true),
          addText(this, 84, 46, `戰力 ${dogPower(d.id)}`, 14, COLORS.inkSoft),
        ]);
      } else {
        drawDogHead(hg, r.width / 2, 44, 26, d.color, d.accent);
        c.add([hg, addText(this, r.width / 2, 86, d.name, 18, COLORS.ink, true).setOrigin(0.5)]);
      }
      makeTapArea(c, r.width, r.height);
      c.on('pointerup', () => {
        setState(toggleTeamMember(getState(), d.id));
        this.render();
      });
    } else {
      c.add(addText(this, r.width / 2, r.height / 2, '＋ 空位', 16, COLORS.inkSoft).setOrigin(0.5));
    }
    this.layer.add(c);
  }

  private drawCell(d: DogData, r: Rect, busy: boolean): void {
    const st = getState();
    const owned = st.owned.includes(d.id);
    const c = this.add.container(r.x, r.y);
    const g = this.add.graphics();
    const inTeam = st.team.includes(d.id);
    g.fillStyle(owned ? COLORS.card : darken(COLORS.card, 0.6), 1);
    g.lineStyle(inTeam ? 4 : 2, inTeam ? COLORS.button : owned ? COLORS.cardBorder : 0x4a3e33, 1);
    g.fillRoundedRect(0, 0, r.width, r.height, 14);
    g.strokeRoundedRect(0, 0, r.width, r.height, 14);
    const hr = Math.min(30, r.height * 0.2);
    drawDogHead(g, r.width / 2, hr + 22, hr, d.color, d.accent, { dark: !owned });
    c.add(g);

    const nameY = hr * 2 + 34;
    c.add(
      addText(this, r.width / 2, nameY, d.name, 18, owned ? COLORS.ink : '#d8cbb8', true).setOrigin(
        0.5,
        0,
      ),
    );
    c.add(
      addText(
        this,
        r.width / 2,
        nameY + 24,
        owned ? `Lv.${d.level}・戰力 ${dogPower(d.id)}` : '未擁有',
        13,
        owned ? COLORS.inkSoft : '#b9a48c',
      ).setOrigin(0.5, 0),
    );

    const badges: [string, string][] = [];
    if (busy) badges.push(['出征中', '#8a6f55']);
    else if (inTeam) badges.push(['隊伍', '#b5651d']);
    if (st.lobbyDogId === d.id) badges.push(['主頁', '#4f8a3c']);
    if (!owned) badges.push(['🔒', '#4a3e33']);
    badges.forEach(([t, bg], i) => {
      c.add(
        addText(this, r.width - 6, 6 + i * 22, t, 12, '#ffffff', true)
          .setOrigin(1, 0)
          .setBackgroundColor(bg)
          .setPadding(5, 2, 5, 2),
      );
    });

    makeTapArea(c, r.width, r.height);
    c.on('pointerup', () => this.openPanel(d));
    this.layer.add(c);
  }

  private openPanel(d: DogData): void {
    if (this.panel) return;
    const show = () => {
      this.panel?.destroy();
      const st = getState();
      this.panelDogId = d.id;
      this.panel = new DogInfoPanel(this, d, {
        owned: st.owned.includes(d.id),
        inTeam: st.team.includes(d.id),
        teamFull: st.team.length >= TEAM_SIZE,
        isLobby: st.lobbyDogId === d.id,
        onToggleTeam: () => {
          setState(toggleTeamMember(getState(), d.id));
          this.render();
          show();
        },
        onSetLobby: () => {
          setState(setLobbyDog(getState(), d.id));
          this.render();
          show();
        },
        onClose: () => this.closePanel(),
      });
      this.render();
    };
    show();
  }

  private closePanel(): void {
    this.panel?.destroy();
    this.panel = null;
    this.panelDogId = null;
    this.render();
  }
}
