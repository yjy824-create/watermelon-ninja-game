import { BOMB_TYPE, COMBO_BONUS, DifficultyStage, FRUIT_SPAWN_WEIGHTS, FRUIT_TYPES, FlyingItem, FlyingItemKind } from './gameConfig';

export function distancePointToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): number {
  const dx = bx - ax;
  const dy = by - ay;

  if (dx === 0 && dy === 0) {
    return Math.hypot(px - ax, py - ay);
  }

  const segmentLengthSquared = dx * dx + dy * dy;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / segmentLengthSquared));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

export function getComboBonus(hitCount: number): number {
  if (hitCount >= 3) return COMBO_BONUS.threeOrMoreFruits;
  if (hitCount === 2) return COMBO_BONUS.twoFruits;
  return 0;
}

export function getGestureFruitScore(baseScore: number, hitCount: number, bombPenalty = 0): number {
  return baseScore + getComboBonus(hitCount) + bombPenalty;
}

export function randomBatchSize(stage: DifficultyStage): number {
  const range = stage.maxBatchSize - stage.minBatchSize + 1;
  return stage.minBatchSize + Math.floor(Math.random() * range);
}

function selectWeightedFruit(): (typeof FRUIT_TYPES)[number] {
  const totalWeight = FRUIT_TYPES.reduce((total, fruit) => total + FRUIT_SPAWN_WEIGHTS[fruit.type], 0);
  let roll = Math.random() * totalWeight;

  for (const fruit of FRUIT_TYPES) {
    roll -= FRUIT_SPAWN_WEIGHTS[fruit.type];
    if (roll <= 0) return fruit;
  }

  return FRUIT_TYPES[0];
}

export function createFlyingItem(width: number, height: number, stage: DifficultyStage): FlyingItem {
  const isBomb = Math.random() < stage.bombChance;
  const selected: FlyingItemKind = isBomb ? BOMB_TYPE : selectWeightedFruit();
  const x = 36 + Math.random() * Math.max(1, width - 72);
  const centerBias = x < width / 2 ? 1 : -1;
  const radius = isBomb ? 36 : 40 + Math.random() * 7;

  return {
    id: `${performance.now()}-${Math.random().toString(36).slice(2)}`,
    kind: selected.type,
    label: selected.label,
    asset: selected.asset,
    slicedAsset: selected.slicedAsset,
    juice: selected.juice,
    points: selected.points,
    x,
    y: height + radius + 16,
    vx: centerBias * (1.2 + Math.random() * 2.4) * stage.speedMultiplier,
    vy: -(14.5 + Math.random() * 7) * stage.speedMultiplier,
    gravity: 0.27,
    radius,
    sliced: false,
    rotation: Math.random() * 360,
    rotationSpeed: -5.5 + Math.random() * 11
  };
}

export function isOutOfBounds(item: FlyingItem, width: number, height: number): boolean {
  return item.y > height + item.radius + 110 || item.x < -120 || item.x > width + 120;
}
