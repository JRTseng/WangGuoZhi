import Phaser from 'phaser';
import { COLORS, FONT_FAMILY, GAME_HEIGHT, GAME_WIDTH } from '../config';
import { DOGS, type DogData } from '../data/dogs';
import { INITIAL_RESOURCES, RESOURCE_LABELS, type Resources } from '../data/resources';
import { formatAmount } from '../logic/format';
import { layoutList } from '../logic/layout';
import { DogCard } from './components/DogCard';
import { DogInfoPanel } from './components/DogInfoPanel';

const BAR_HEIGHT = 64;
const BUTTON = { x: 24, y: GAME_HEIGHT - 112, width: GAME_WIDTH - 48, height: 64 };

export class MainScene extends Phaser.Scene {
  private panel: DogInfoPanel | null = null;
  private resources: Resources = { ...INITIAL_RESOURCES };

  constructor() {
    super('MainScene');
  }

  create(): void {
    this.panel = null;
    this.drawResourceBar();

    this.add
      .text(GAME_WIDTH / 2, BAR_HEIGHT + 30, '我的武將', {
        fontFamily: FONT_FAMILY,
        fontSize: '22px',
        fontStyle: 'bold',
        color: COLORS.ink,
      })
      .setOrigin(0.5);

    const listTop = BAR_HEIGHT + 56;
    const rects = layoutList(DOGS.length, {
      area: { x: 16, y: listTop, width: GAME_WIDTH - 32, height: BUTTON.y - 20 - listTop },
      gap: 12,
      maxCardHeight: 108,
    });
    const cards = DOGS.map(
      (dog, i) => new DogCard(this, dog, rects[i], (d) => this.togglePanel(d)),
    );

    this.drawExpeditionButton();

    window.__WGZ__ = {
      ...window.__WGZ__,
      scene: 'MainScene',
      version: window.__WGZ__?.version ?? '',
      resources: { ...this.resources },
      cards: cards.map((c) => ({ id: c.dog.id, name: c.dog.name, power: c.power, ...c.rect })),
      panel: null,
      expeditionButton: { label: '出征（即將開放）', ...BUTTON },
    };
  }

  private drawResourceBar(): void {
    this.add.rectangle(0, 0, GAME_WIDTH, BAR_HEIGHT, COLORS.bar).setOrigin(0, 0);
    const keys = Object.keys(RESOURCE_LABELS) as (keyof Resources)[];
    const slot = GAME_WIDTH / keys.length;
    keys.forEach((key, i) => {
      const cx = slot * i + slot / 2;
      const icon = this.add.graphics();
      if (key === 'food') {
        // 糧草：一束麥（橢圓）
        icon.fillStyle(0xf2c14e, 1);
        icon.fillEllipse(cx - 58, BAR_HEIGHT / 2, 16, 26);
      } else {
        // 骨頭幣：圓幣
        icon.fillStyle(0xf5f0e6, 1);
        icon.fillCircle(cx - 58, BAR_HEIGHT / 2, 12);
        icon.lineStyle(2, 0xc9b79c, 1);
        icon.strokeCircle(cx - 58, BAR_HEIGHT / 2, 12);
      }
      this.add
        .text(
          cx - 40,
          BAR_HEIGHT / 2,
          `${RESOURCE_LABELS[key]} ${formatAmount(this.resources[key])}`,
          {
            fontFamily: FONT_FAMILY,
            fontSize: '18px',
            fontStyle: 'bold',
            color: COLORS.barText,
          },
        )
        .setOrigin(0, 0.5)
        .setName(`resource-${key}`);
    });
  }

  private drawExpeditionButton(): void {
    const g = this.add.graphics();
    g.fillStyle(COLORS.buttonDisabled, 1);
    g.fillRoundedRect(BUTTON.x, BUTTON.y, BUTTON.width, BUTTON.height, 18);
    this.add
      .text(BUTTON.x + BUTTON.width / 2, BUTTON.y + BUTTON.height / 2, '出征（即將開放）', {
        fontFamily: FONT_FAMILY,
        fontSize: '24px',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5);
  }

  private togglePanel(dog: DogData): void {
    if (this.panel) {
      this.closePanel();
      return;
    }
    this.panel = new DogInfoPanel(this, dog, () => this.closePanel());
    if (window.__WGZ__) window.__WGZ__.panel = dog.id;
  }

  private closePanel(): void {
    this.panel?.destroy();
    this.panel = null;
    if (window.__WGZ__) window.__WGZ__.panel = null;
  }
}
