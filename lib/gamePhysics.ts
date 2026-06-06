import {
  BOMB_SMOOTHING_CONFIG,
  BOMB_TYPE,
  COMBO_BONUS,
  DifficultyStage,
  FINAL_BOSS_CONFIG,
  FRUIT_SPAWN_WEIGHTS,
  FRUIT_TYPES,
  FinalBossFruit,
  FlyingItem,
  FlyingItemKind,
  SlashPoint
} from './gameConfig';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

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

export interface BombSpawnDecisionInput {
  now: number;
  gameStartedAt: number;
  lastBombSpawnAt: number;
  bombChance: number;
  randomValue?: number;
}

export function shouldSpawnBombInBatch({
  now,
  gameStartedAt,
  lastBombSpawnAt,
  bombChance,
  randomValue
}: BombSpawnDecisionInput): boolean {
  if (!BOMB_SMOOTHING_CONFIG.enabled) {
    return (randomValue ?? Math.random()) < bombChance;
  }

  const timeSinceStart = now - gameStartedAt;
  const timeSinceBomb = now - lastBombSpawnAt;
  if (timeSinceBomb < BOMB_SMOOTHING_CONFIG.minIntervalMs) return false;

  const shouldForceBomb =
    timeSinceStart >= BOMB_SMOOTHING_CONFIG.gracePeriodMs && timeSinceBomb >= BOMB_SMOOTHING_CONFIG.forceIfNoBombForMs;
  if (shouldForceBomb) return true;

  if (!BOMB_SMOOTHING_CONFIG.allowRandomFromStart && timeSinceStart < BOMB_SMOOTHING_CONFIG.gracePeriodMs) {
    return false;
  }

  return (randomValue ?? Math.random()) < bombChance;
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

export function createFlyingItem(
  width: number,
  height: number,
  stage: DifficultyStage,
  options: { forceKind?: 'bomb' | 'fruit' } = {}
): FlyingItem {
  const isBomb = options.forceKind === 'bomb' || (options.forceKind !== 'fruit' && Math.random() < stage.bombChance);
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

export function isFinalBossHit(boss: FinalBossFruit, point: SlashPoint, previous?: SlashPoint): boolean {
  if (previous) {
    return distancePointToSegment(boss.x, boss.y, previous.x, previous.y, point.x, point.y) <= boss.radius;
  }

  return Math.hypot(boss.x - point.x, boss.y - point.y) <= boss.radius;
}

function getBossSpeed(width: number): number {
  return width < 640 ? FINAL_BOSS_CONFIG.movement.mobileSpeed : FINAL_BOSS_CONFIG.movement.desktopSpeed;
}

export function getBossBounds(width: number, height: number, radius: number) {
  const { edgePadding, topSafePadding, bottomSafePadding } = FINAL_BOSS_CONFIG.movement;
  const minX = radius + edgePadding;
  const maxX = Math.max(minX, width - radius - edgePadding);
  const minY = radius + topSafePadding;
  const maxY = Math.max(minY, height - radius - bottomSafePadding);

  return { minX, maxX, minY, maxY };
}

function getBossDirection(width: number): Pick<FinalBossFruit, 'vx' | 'vy'> {
  const speed = getBossSpeed(width);
  const angle = -Math.PI * 0.18 + Math.random() * Math.PI * 0.36;
  const direction = Math.random() > 0.5 ? 1 : -1;

  return {
    vx: Math.cos(angle) * speed * direction,
    vy: Math.sin(angle) * speed * 0.64
  };
}

function getNextDirectionChangeAt(now: number): number {
  const { directionChangeMinMs, directionChangeMaxMs } = FINAL_BOSS_CONFIG.movement;
  return now + directionChangeMinMs + Math.random() * (directionChangeMaxMs - directionChangeMinMs);
}

export function createFinalBoss(width: number, height: number, now: number): FinalBossFruit {
  const radius = width < 640 ? FINAL_BOSS_CONFIG.radius.mobile : FINAL_BOSS_CONFIG.radius.desktop;
  const bounds = getBossBounds(width, height, radius);
  const direction = getBossDirection(width);

  return {
    id: `final-boss-${now}`,
    x: clamp(width / 2, bounds.minX, bounds.maxX),
    y: clamp(height * 0.52, bounds.minY, bounds.maxY),
    vx: direction.vx,
    vy: direction.vy,
    radius,
    hits: 0,
    maxHits: FINAL_BOSS_CONFIG.maxHits,
    nextDirectionChangeAt: getNextDirectionChangeAt(now),
    defeated: false,
    hitFlashId: 0
  };
}

export function updateFinalBoss(boss: FinalBossFruit, width: number, height: number, deltaMs: number, now: number): FinalBossFruit {
  const direction = now >= boss.nextDirectionChangeAt ? getBossDirection(width) : { vx: boss.vx, vy: boss.vy };
  const bounds = getBossBounds(width, height, boss.radius);
  let vx = direction.vx;
  let vy = direction.vy;
  let x = boss.x + vx * (deltaMs / 1000);
  let y = boss.y + vy * (deltaMs / 1000);

  if (x <= bounds.minX || x >= bounds.maxX) {
    x = clamp(x, bounds.minX, bounds.maxX);
    vx *= -1;
  }

  if (y <= bounds.minY || y >= bounds.maxY) {
    y = clamp(y, bounds.minY, bounds.maxY);
    vy *= -1;
  }

  return {
    ...boss,
    x,
    y,
    vx,
    vy,
    nextDirectionChangeAt: now >= boss.nextDirectionChangeAt ? getNextDirectionChangeAt(now) : boss.nextDirectionChangeAt
  };
}
