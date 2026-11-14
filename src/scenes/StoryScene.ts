import Phaser from 'phaser';
import { startNext, type NextFrom } from './components/nextStage';
import { COLORS } from '../config';
import { findDog } from '../data/dogs';
import { findStage } from '../data/regions';
import { STORIES, findStory, type StoryData } from '../data/stories';
import { layoutList, type Rect } from '../logic/layout';
import { isStoryUnlocked, markStorySeen } from '../logic/progress';
import { getState, setState } from '../state/store';
import { DogSprite } from './components/DogSprite';
import { makeTapArea } from './components/hitArea';
import { Scenery } from './components/Scenery';
import { addText, drawHeader, patchDebug, resetDebug, viewOf } from './ui';

const BAR = 56;

interface StorySceneData {
  mode: 'list' | 'play';
  storyId?: string;
  /** 播完回哪裡：從回顧清單進來回清單，過關自動播放回主頁 */
  returnTo?: 'list' | 'lobby';
  /** 結算畫面按了「下一關」才進來的：看完劇情接著打下一關 */
  next?: NextFrom;
}

/**
 * 劇情：
 * - list：劇情回顧清單，已解鎖的可以重看，沒解鎖的顯示「？？？」與解鎖條件
 * - play：情境圖 + 說話的狗狗 + 對話框，點一下下一句，右上可跳過
 */
export class StoryScene extends Phaser.Scene {
  private mode: 'list' | 'play' = 'list';
  private story: StoryData | null = null;
  private returnTo: 'list' | 'lobby' = 'lobby';
  private nextFrom: NextFrom | null = null;
  private line = 0;
  private dialog!: Phaser.GameObjects.Container;
  private speaker: DogSprite | null = null;
  private skip!: Rect;

  constructor() {
    super('StoryScene');
  }

  init(data: StorySceneData): void {
    this.mode = data?.mode ?? 'list';
    this.story = data?.storyId ? (findStory(data.storyId) ?? null) : null;
    this.returnTo = data?.returnTo ?? 'lobby';
    this.nextFrom = data?.next ?? null;
    this.line = 0;
    if (this.mode === 'play' && !this.story) this.mode = 'list';
  }

  create(): void {
    resetDebug(this);
    this.speaker = null;
    if (this.mode === 'list') this.renderList();
    else this.renderPlay();
  }

  // ---- 回顧清單 ----

  private renderList(): void {
    const { w, h, landscape } = viewOf(this);
    this.add.rectangle(0, 0, w, h, COLORS.background).setOrigin(0, 0);
    const back = drawHeader(this, '劇情回顧', () => this.scene.start('LobbyScene'));
    const st = getState();
    const area: Rect = landscape
      ? { x: 60, y: BAR + 14, width: w - 120, height: h - BAR - 26 }
      : { x: 16, y: BAR + 20, width: w - 32, height: h - BAR - 40 };
    // 橫式排兩欄（十章共 12 段，一欄放不下）：先排左欄由上而下，再排右欄
    const gap = landscape ? 8 : 12;
    const perCol = landscape ? Math.ceil(STORIES.length / 2) : STORIES.length;
    const colW = landscape ? (area.width - 16) / 2 : area.width;
    const col = layoutList(perCol, { area: { ...area, width: colW }, gap, maxCardHeight: 96 });
    const rects = STORIES.map((_, i) => {
      const r = col[i % perCol];
      return { ...r, x: r.x + Math.floor(i / perCol) * (colW + 16) };
    });
    const items = STORIES.map((s, i) => {
      const r = rects[i];
      const unlocked = isStoryUnlocked(st, s);
      const seen = st.seenStories.includes(s.id);
      const c = this.add.container(r.x, r.y);
      const g = this.add.graphics();
      g.fillStyle(unlocked ? COLORS.card : 0xc9b79c, 1);
      g.lineStyle(2, COLORS.cardBorder, 1);
      g.fillRoundedRect(0, 0, r.width, r.height, 14);
      g.strokeRoundedRect(0, 0, r.width, r.height, 14);
      c.add(g);
      if (unlocked) {
        c.add(
          addText(
            this,
            18,
            r.height / 2 - 11,
            s.title,
            landscape ? 17 : 19,
            COLORS.ink,
            true,
          ).setOrigin(0, 0.5),
        );
        c.add(
          addText(
            this,
            18,
            r.height / 2 + 12,
            s.lines[0].text.slice(0, landscape ? 14 : 18) + '…',
            13,
            COLORS.inkSoft,
          ).setOrigin(0, 0.5),
        );
        c.add(
          addText(
            this,
            r.width - 16,
            r.height / 2,
            seen ? '▶ 重看' : '▶ 新！',
            16,
            seen ? '#b5651d' : '#c0392b',
            true,
          ).setOrigin(1, 0.5),
        );
        makeTapArea(c, r.width, r.height);
        c.on('pointerup', () =>
          this.scene.start('StoryScene', { mode: 'play', storyId: s.id, returnTo: 'list' }),
        );
      } else {
        const stage = s.unlockAfter ? findStage(s.unlockAfter)?.name : '';
        c.add(
          addText(
            this,
            18,
            r.height / 2 - 11,
            '🔒 ？？？',
            landscape ? 16 : 19,
            '#6d5f52',
            true,
          ).setOrigin(0, 0.5),
        );
        c.add(
          addText(this, 18, r.height / 2 + 12, `通過「${stage}」後解鎖`, 13, '#6d5f52').setOrigin(
            0,
            0.5,
          ),
        );
      }
      return { id: s.id, unlocked, ...r };
    });
    patchDebug({
      backButton: back,
      story: { mode: 'list', items, playing: null, line: 0, total: 0 },
    });
  }

  // ---- 播放 ----

  private renderPlay(): void {
    const story = this.story!;
    const { w, h, landscape } = viewOf(this);
    new Scenery(
      this,
      { x: 0, y: 0, width: w, height: h },
      story.art,
      getState().settings.quality,
      landscape ? 0.55 : 0.5,
    );

    // 標題列（半透明）與跳過
    this.add.rectangle(0, 0, w, BAR, 0x000000, 0.45).setOrigin(0, 0);
    addText(this, 16, BAR / 2, story.title, 18, '#ffffff', true).setOrigin(0, 0.5);
    this.skip = { x: w - 100, y: 8, width: 88, height: BAR - 16 };
    const skip = this.add.container(this.skip.x, this.skip.y);
    const sg = this.add.graphics();
    sg.fillStyle(0xffffff, 0.25);
    sg.fillRoundedRect(0, 0, this.skip.width, this.skip.height, 12);
    skip.add([
      sg,
      addText(
        this,
        this.skip.width / 2,
        this.skip.height / 2,
        '跳過 ▶▶',
        15,
        '#ffffff',
        true,
      ).setOrigin(0.5),
    ]);
    makeTapArea(skip, this.skip.width, this.skip.height);
    skip.setDepth(20);
    skip.on('pointerup', () => this.finish());

    // 點畫面任何地方 → 下一句（跳過鍵除外）
    this.add
      .zone(0, BAR, w, h - BAR)
      .setOrigin(0, 0)
      .setInteractive({ cursor: 'pointer' })
      .on('pointerup', () => this.next());

    this.dialog = this.add.container(0, 0).setDepth(10);
    this.showLine();
  }

  private showLine(): void {
    const story = this.story!;
    const { w, h, landscape } = viewOf(this);
    const ln = story.lines[this.line];
    this.dialog.removeAll(true);
    this.speaker?.destroy();
    this.speaker = null;

    const boxH = landscape ? 120 : 190;
    const box: Rect = { x: 12, y: h - boxH - 12, width: w - 24, height: boxH };
    const dog = ln.speaker ? findDog(ln.speaker) : undefined;
    if (dog) {
      const sx = landscape ? w * 0.18 : w * 0.3;
      this.speaker = new DogSprite(this, sx, box.y - 6, { color: dog.color, accent: dog.accent });
      this.speaker.setScale(landscape ? 0.85 : 1.15).setDepth(5);
      this.speaker.play('wag');
    }

    const g = this.add.graphics();
    g.fillStyle(0xfffaf2, 0.96);
    g.lineStyle(3, COLORS.bar, 1);
    g.fillRoundedRect(box.x, box.y, box.width, box.height, 16);
    g.strokeRoundedRect(box.x, box.y, box.width, box.height, 16);
    this.dialog.add(g);
    if (dog) {
      this.dialog.add(
        addText(this, box.x + 18, box.y - 16, dog.name, 18, '#ffffff', true)
          .setBackgroundColor('#6b4a2e')
          .setPadding(10, 4, 10, 4),
      );
    }
    this.dialog.add(
      addText(
        this,
        box.x + 20,
        box.y + (dog ? 26 : 18),
        ln.text,
        landscape ? 18 : 19,
        dog ? COLORS.ink : COLORS.inkSoft,
        !!dog,
      )
        .setWordWrapWidth(box.width - 40, true)
        .setLineSpacing(6),
    );
    this.dialog.add(
      addText(
        this,
        box.x + box.width - 16,
        box.y + box.height - 12,
        `${this.line + 1}/${story.lines.length}\u3000點一下繼續 ▼`,
        13,
        COLORS.inkSoft,
      ).setOrigin(1, 1),
    );

    patchDebug({
      story: {
        mode: 'play',
        items: [],
        playing: story.id,
        line: this.line,
        total: story.lines.length,
        skip: this.skip,
      },
    });
  }

  private next(): void {
    if (this.line + 1 >= this.story!.lines.length) {
      this.finish();
      return;
    }
    this.line++;
    this.showLine();
  }

  private finish(): void {
    setState(markStorySeen(getState(), this.story!.id));
    if (this.nextFrom && startNext(this, this.nextFrom)) return;
    if (this.returnTo === 'list') this.scene.start('StoryScene', { mode: 'list' });
    else this.scene.start('LobbyScene');
  }
}
