// 실루엣 시험(10-presentation §5.2 원칙 1 "검게 칠해도 원형·계열이 구분돼야 한다"): 슬라이스 인형을 먹으로 칠해 한 장에 늘어놓는다.
import { HERO_COLOR } from '../../../src/game/content.ts';
import { drawPuppet, heroArt, SLICE_HEROES } from './heroes.ts';
import { spiritArt } from './spirits.ts';

export function silhouetteSheet(): string {
  const c = document.createElement('canvas');
  c.width = 1400;
  c.height = 420;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#efe6cc';
  ctx.fillRect(0, 0, c.width, c.height);
  SLICE_HEROES.forEach((id, i) => {
    const a = heroArt(id, HERO_COLOR[id]);
    drawPuppet(ctx, a, a.poses.idle, { x: 120 + i * 210, y: 370, s: 2, silhouette: '#15110c' });
  });
  const spirits: [string, string, number][] = [['jeojeun_neok', '수귀', 1], ['heogijin_neok', '굶주린 넋', 1], ['sakkun', '수귀', 1.6]];
  spirits.forEach(([id, fam, s], i) => {
    const a = spiritArt(id, fam, s);
    const t = document.createElement('canvas');
    t.width = a.canvas.width;
    t.height = a.canvas.height;
    const tc = t.getContext('2d')!;
    tc.drawImage(a.canvas, 0, 0);
    tc.globalCompositeOperation = 'source-in';
    tc.fillStyle = '#15110c';
    tc.fillRect(0, 0, t.width, t.height);
    const k = 1.6 / a.R;
    const x = 760 + i * 200;
    ctx.drawImage(t, x + a.box[0] * 1.6, 360 + a.box[1] * 1.6, t.width * k, t.height * k);
    if (a.boat) {
      const b = a.boat;
      const bt = document.createElement('canvas');
      bt.width = b.canvas.width;
      bt.height = b.canvas.height;
      const bc = bt.getContext('2d')!;
      bc.drawImage(b.canvas, 0, 0);
      bc.globalCompositeOperation = 'source-in';
      bc.fillStyle = '#15110c';
      bc.fillRect(0, 0, bt.width, bt.height);
      ctx.drawImage(bt, x + b.box[0] * 1.6, 368 + b.box[1] * 1.6, bt.width * (1.6 / a.R), bt.height * (1.6 / a.R));
    }
  });
  return c.toDataURL('image/png');
}
