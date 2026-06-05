import { PlayerRank } from './rank';

interface ShareImageInput {
  score: number;
  bestScore: number;
  rank: PlayerRank;
}

const SHARE_WIDTH = 1080;
const SHARE_HEIGHT = 1350;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function drawRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
  context.fill();
}

function drawCenteredText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number
): void {
  context.fillText(text, x, y, maxWidth);
}

export async function generateShareImage({ score, bestScore, rank }: ShareImageInput): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = SHARE_WIDTH;
  canvas.height = SHARE_HEIGHT;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas is not supported in this browser.');
  }

  const [logo, watermelon, pineapple, banana] = await Promise.all([
    loadImage('/assets/logo.png'),
    loadImage('/assets/watermelon.png'),
    loadImage('/assets/pineapple.png'),
    loadImage('/assets/banana.png')
  ]);

  const background = context.createLinearGradient(0, 0, 0, SHARE_HEIGHT);
  background.addColorStop(0, '#dcfce7');
  background.addColorStop(0.54, '#fef9c3');
  background.addColorStop(1, '#fdba74');
  context.fillStyle = background;
  context.fillRect(0, 0, SHARE_WIDTH, SHARE_HEIGHT);

  context.fillStyle = 'rgba(34, 197, 94, 0.18)';
  context.beginPath();
  context.arc(130, 150, 210, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = 'rgba(250, 204, 21, 0.22)';
  context.beginPath();
  context.arc(940, 220, 230, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = 'rgba(248, 113, 113, 0.15)';
  context.beginPath();
  context.arc(980, 1150, 280, 0, Math.PI * 2);
  context.fill();

  context.save();
  context.globalAlpha = 0.88;
  context.translate(154, 1040);
  context.rotate(-0.18);
  context.drawImage(watermelon, -120, -120, 240, 240);
  context.restore();

  context.save();
  context.globalAlpha = 0.85;
  context.translate(912, 1018);
  context.rotate(0.16);
  context.drawImage(pineapple, -120, -120, 240, 240);
  context.restore();

  context.save();
  context.globalAlpha = 0.82;
  context.translate(890, 330);
  context.rotate(-0.26);
  context.drawImage(banana, -110, -110, 220, 220);
  context.restore();

  context.fillStyle = 'rgba(255, 255, 255, 0.86)';
  drawRoundedRect(context, 92, 112, 896, 1100, 38);

  context.drawImage(logo, 390, 152, 300, 300);

  context.textAlign = 'center';
  context.fillStyle = '#14532d';
  context.font = '900 76px Arial, "Microsoft YaHei", sans-serif';
  drawCenteredText(context, '西瓜忍者', SHARE_WIDTH / 2, 520, 820);

  context.font = '900 46px Arial, "Microsoft YaHei", sans-serif';
  context.fillStyle = '#f97316';
  drawCenteredText(context, '60秒挑战', SHARE_WIDTH / 2, 586, 820);

  context.fillStyle = '#ecfdf5';
  drawRoundedRect(context, 180, 650, 680, 250, 28);

  context.fillStyle = '#047857';
  context.font = '700 40px Arial, "Microsoft YaHei", sans-serif';
  drawCenteredText(context, '本次分数', SHARE_WIDTH / 2, 710, 620);
  context.fillStyle = '#16a34a';
  context.font = '900 132px Arial, "Microsoft YaHei", sans-serif';
  drawCenteredText(context, String(score), SHARE_WIDTH / 2, 840, 620);

  context.fillStyle = '#fff7ed';
  drawRoundedRect(context, 180, 936, 316, 150, 24);
  context.fillStyle = '#fefce8';
  drawRoundedRect(context, 544, 936, 316, 150, 24);

  context.font = '700 32px Arial, "Microsoft YaHei", sans-serif';
  context.fillStyle = '#c2410c';
  drawCenteredText(context, '最高分', 338, 990, 260);
  context.font = '900 54px Arial, "Microsoft YaHei", sans-serif';
  drawCenteredText(context, String(bestScore), 338, 1055, 260);

  context.font = '700 32px Arial, "Microsoft YaHei", sans-serif';
  context.fillStyle = '#166534';
  drawCenteredText(context, '玩家称号', 702, 990, 260);
  context.font = '900 44px Arial, "Microsoft YaHei", sans-serif';
  drawCenteredText(context, rank.title, 702, 1052, 280);

  context.fillStyle = '#14532d';
  context.font = '800 36px Arial, "Microsoft YaHei", sans-serif';
  drawCenteredText(context, rank.encouragement, SHARE_WIDTH / 2, 1164, 760);

  context.fillStyle = 'rgba(20, 83, 45, 0.72)';
  context.font = '700 28px Arial, "Microsoft YaHei", sans-serif';
  drawCenteredText(context, '滑动切水果，避开炸弹！', SHARE_WIDTH / 2, 1242, 760);

  return canvas.toDataURL('image/png');
}

export const SHARE_IMAGE_SIZE = {
  width: SHARE_WIDTH,
  height: SHARE_HEIGHT
};
