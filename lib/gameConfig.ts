export const GAME_DURATION_SECONDS = 60;
export const BEST_SCORE_KEY = 'watermelon-ninja-best-score';
export const SOUND_ENABLED_KEY = 'watermelon-ninja-sound-enabled';

export const RUSH_MODE_CONFIG = {
  startsAtSeconds: 20,
  bannerDurationMs: 1500,
  promptDurationMs: 1250,
  shakeDurationMs: 180,
  spawnIntervalMultiplier: 0.94,
  spawnJitterMs: 55
} as const;

export const FINAL_COUNTDOWN_CONFIG = {
  pulseStartsAtSeconds: 10,
  prompts: [
    { timeLeft: 10, text: '10 秒！' },
    { timeLeft: 5, text: '5 秒！' },
    { timeLeft: 1, text: '最后一刀！' }
  ]
} as const;

export const FINAL_BOSS_CONFIG = {
  startsAtSeconds: 10,
  scorePerHit: 2,
  maxHits: 30,
  hitRadiusMultiplier: 1.15,
  explosionHoldMs: 850,
  maxSlashMarks: 12,
  asset: '/assets/watermelon.png',
  slicedAsset: '/assets/watermelon-sliced.png',
  radius: {
    desktop: 86,
    mobile: 68
  },
  rewards: [
    { hits: 5, bonus: 5, text: '大西瓜连斩 +5' },
    { hits: 10, bonus: 10, text: '大西瓜猛攻 +10' },
    { hits: 20, bonus: 20, text: '大西瓜狂切 +20' },
    { hits: 30, bonus: 30, text: '完美切爆 +30' }
  ],
  movement: {
    enabled: true,
    desktopSpeed: 100,
    mobileSpeed: 60,
    directionChangeMinMs: 1000,
    directionChangeMaxMs: 2000,
    edgePadding: 12,
    topSafePadding: 80,
    bottomSafePadding: 24
  }
} as const;

export const FRUIT_SCORE_MAP = {
  watermelon: 1,
  apple: 2,
  banana: 3,
  pineapple: 5,
  bomb: -5
} as const;

export const FRUIT_SPAWN_WEIGHTS = {
  watermelon: 40,
  apple: 25,
  banana: 20,
  pineapple: 15
} as const;

export const COMBO_BONUS = {
  twoFruits: 2,
  threeOrMoreFruits: 5
} as const;

export const BOMB_SMOOTHING_CONFIG = {
  enabled: true,
  allowRandomFromStart: true,
  gracePeriodMs: 5000,
  forceIfNoBombForMs: 5000,
  minIntervalMs: 2500,
  maxBombsPerBatch: 1
} as const;

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
    points: FRUIT_SCORE_MAP.watermelon,
    asset: '/assets/watermelon.png',
    slicedAsset: '/assets/watermelon-sliced.png',
    juice: '#ef4444'
  },
  {
    type: 'pineapple',
    label: '凤梨',
    points: FRUIT_SCORE_MAP.pineapple,
    asset: '/assets/pineapple.png',
    slicedAsset: '/assets/pineapple-sliced.png',
    juice: '#facc15'
  },
  {
    type: 'apple',
    label: '苹果',
    points: FRUIT_SCORE_MAP.apple,
    asset: '/assets/apple.png',
    slicedAsset: '/assets/apple-sliced.png',
    juice: '#f87171'
  },
  {
    type: 'banana',
    label: '香蕉',
    points: FRUIT_SCORE_MAP.banana,
    asset: '/assets/banana.png',
    slicedAsset: '/assets/banana-sliced.png',
    juice: '#fde047'
  }
] as const;

export const BOMB_TYPE = {
  type: 'bomb',
  label: '炸弹',
  points: FRUIT_SCORE_MAP.bomb,
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
  points: number;
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

export interface FinalBossFruit {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  hits: number;
  maxHits: number;
  nextDirectionChangeAt: number;
  defeated: boolean;
  defeatedAt?: number;
  hitFlashId: number;
  slashMarks: BossSlashMark[];
}

export interface BossSlashMark {
  id: string;
  xPercent: number;
  yPercent: number;
  angle: number;
  lengthPercent: number;
  opacity: number;
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
