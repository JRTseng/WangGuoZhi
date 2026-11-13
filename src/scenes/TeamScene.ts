import Phaser from 'phaser';
import { COLORS } from '../config';
import { DOGS, type DogData } from '../data/dogs';
import { TEAM_SIZE } from '../logic/expedition';
import { dogStats } from '../logic/leveling';
import { autoFillTeam, setLobbyDog, teamPower, toggleTeamMember } from '../logic/team';
import { getState, setState } from '../state/store';
import { DogInfoPanel } from './components/DogInfoPanel';
import { DogPicker } from './components/DogPicker';
import { FormationPanel } from './components/FormationPanel';
import { drawHeader, patchDebug, resetDebug, viewOf } from './ui';

const BAR = 56;

/**
 * 組隊編排（T015 改版）：
 * - 上方（橫式在左側）5 個隊伍格，點已放的狗可移出
 * - 篩選列（定位、狀態）與排序，預設全部、戰力高到低
 * - 下方可捲動的卡片格，列出官方已釋放的全部狗狗；沒擁有的用暗色顯示
 * - 點狗狗開資訊面板：加入／移出隊伍、設為主頁角色
 * - 一鍵「自動編隊」：換成可出征裡戰力最高的 5 隻，並照定位排好前中後排
 * - 「陣型」（T023）：開陣型面板，把隊伍裡的狗排到前排、中排、後排
 */
export class TeamScene extends Phaser.Scene {
  private picker!: DogPicker;
  private panel: DogInfoPanel | null = null;
  private panelDogId: string | null = null;
  private formation: FormationPanel | null = null;

  constructor() {
    super('TeamScene');
  }

  create(): void {
    this.panel = null;
    this.panelDogId = null;
    this.formation = null;
    resetDebug(this);
    const { w, h, landscape } = viewOf(this);
    this.add.rectangle(0, 0, w, h, COLORS.background).setOrigin(0, 0);
    const back = drawHeader(this, '組隊編排', () => this.scene.start('LobbyScene'));
    patchDebug({ backButton: back });
    this.picker = new DogPicker(this, {
      mode: 'team',
      top: BAR + 6,
      bottom: h - (landscape ? 12 : 16),
      dogs: () => DOGS,
      selected: () => getState().team,
      title: () => {
        const st = getState();
        return `隊伍 ${st.team.length}/${TEAM_SIZE}・戰力 ${teamPower(st, st.team)}`;
      },
      onSlotTap: (id) => {
        setState(toggleTeamMember(getState(), id));
        this.picker.render();
      },
      onCellTap: (dog) => this.openPanel(dog),
      onAuto: () => {
        setState(autoFillTeam(getState()));
        this.picker.render();
      },
      onFormation: () => this.openFormation(),
      onUpdate: () => this.publish(),
    });
    this.picker.render();
  }

  private publish(): void {
    const st = getState();
    const p = this.picker.debug();
    patchDebug({
      picker: p,
      team: {
        slots: p.slots,
        dogs: p.cells.map(({ selected, ...c }) => ({ ...c, inTeam: selected })),
        owned: st.owned.length,
        panel: this.panelDogId,
        panelStats: this.panel?.stats ?? null,
        panelButtons: this.panel?.buttons ?? null,
        lobbyDogId: st.lobbyDogId,
      },
    });
  }

  private openFormation(): void {
    if (this.panel || this.formation || this.picker.wasDragged) return;
    if (getState().team.length === 0) return;
    this.formation = new FormationPanel(this, getState().team, () => {
      this.formation = null;
      this.picker.render();
    });
  }

  private openPanel(d: DogData): void {
    if (this.panel || this.formation) return;
    const show = () => {
      this.panel?.destroy();
      const st = getState();
      this.panelDogId = d.id;
      this.panel = new DogInfoPanel(this, d, {
        stats: dogStats(st, d),
        owned: st.owned.includes(d.id),
        inTeam: st.team.includes(d.id),
        teamFull: st.team.length >= TEAM_SIZE,
        boarding: st.boarding.some((b) => b.dogId === d.id),
        isLobby: st.lobbyDogId === d.id,
        onToggleTeam: () => {
          setState(toggleTeamMember(getState(), d.id));
          show();
        },
        onSetLobby: () => {
          setState(setLobbyDog(getState(), d.id));
          show();
        },
        onClose: () => this.closePanel(),
      });
      this.picker.render();
    };
    show();
  }

  private closePanel(): void {
    this.panel?.destroy();
    this.panel = null;
    this.panelDogId = null;
    this.picker.render();
  }
}
