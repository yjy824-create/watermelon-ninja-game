export const GAME_DURATION_SECONDS = 60;
export const BEST_SCORE_KEY = 'watermelon-ninja-best-score';
export const SOUND_ENABLED_KEY = 'watermelon-ninja-sound-enabled';

export const DIFFICULTY_STAGES = [
  {
    id: 'warmup',
    label: '开局热身',
    minTimeLeft: 41,
    spawnIntervalMs: 850,
    bombChance: 0.08,
    speedMultiplier: 1,
    minBatchSize: 1,
    maxBatchSize: 2
  },
  {
    id: 'flow',
    label: '手感来了',
    minTimeLeft: 21,
    spawnIntervalMs: 650,
    bombChance: 0.12,
    speedMultiplier: 1.1,
    minBatchSize: 1,
    maxBatchSize: 3
  },
  {
    id: 'sprint',
    label: '最后冲刺',
    minTimeLeft: 0,
    spawnIntervalMs: 480,
    bombChance: 0.16,
    speedMultiplier: 1.2,
    minBatchSize: 2,
    maxBatchSize: 3
  }
] as const;

export type DifficultyStage = (typeof DIFFICULTY_STAGES)[number];

export const FRUIT_TYPES = [
  {
    type: 'watermelon',
    label: '西瓜',
    points: 1,
    asset: '/assets/watermelon.png',
    slicedAsset: '/assets/watermelon-sliced.png',
    juice: '#ef4444'
  },
  {
    type: 'pineapple',
    label: '凤梨',
    points: 1,
    asset: '/assets/pineapple.png',
    slicedAsset: '/assets/pineapple-sliced.png',
    juice: '#facc15'
  },
  {
    type: 'apple',
    label: '苹果',
    points: 1,
    asset: '/assets/apple.png',
    slicedAsset: '/assets/apple-sliced.png',
    juice: '#f87171'
  },
  {
    type: 'banana',
    label: '香蕉',
    points: 1,
    asset: '/assets/banana.png',
    slicedAsset: '/assets/banana-sliced.png',
    juice: '#fde047'
  }
] as const;

export const BOMB_TYPE = {
  type: 'bomb',
  label: '炸弹',
  points: -5,
  asset: '/assets/bomb.png',
  slicedAsset: '/assets/explosion.png',
  juice: '#fb923c'
} as const;

export type FruitKind = (typeof FRUIT_TYPES)[number]['type'] | typeof BOMB_TYPE.type;
export type FlyingItemKind = (typeof FRUIT_TYPES)[number] | typeof BOMB_TYPE;

export interface FlyingItem {
  id: string;
  kind: FruitKind;
  label: string;
  asset: string;
  slicedAsset: string;
  juice: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  gravity: number;
  radius: number;
  sliced: boolean;
  rotation: number;
  rotationSpeed: number;
}

export interface SlashPoint {
  x: number;
  y: number;
  time: number;
}

export interface SliceEffect {
  id: string;
  kind: 'score' | 'combo' | 'bomb' | 'splash' | 'sliced';
  x: number;
  y: number;
  text?: string;
  asset?: string;
  color?: string;
  createdAt: number;
}

export function getDifficultyStage(timeLeft: number): DifficultyStage {
  return DIFFICULTY_STAGES.find((stage) => timeLeft >= stage.minTimeLeft) ?? DIFFICULTY_STAGES[2];
}
