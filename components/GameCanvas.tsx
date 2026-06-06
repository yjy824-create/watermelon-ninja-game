'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import SoundToggle from './SoundToggle';
import {
  BOMB_SMOOTHING_CONFIG,
  DifficultyStage,
  FINAL_COUNTDOWN_CONFIG,
  FINAL_BOSS_CONFIG,
  FinalBossFruit,
  FlyingItem,
  GAME_DURATION_SECONDS,
  RUSH_MODE_CONFIG,
  SlashPoint,
  SliceEffect,
  getDifficultyStage
} from '@/lib/gameConfig';
import {
  createFinalBoss,
  createFlyingItem,
  getComboBonus,
  getGestureFruitScore,
  isFinalBossHit,
  isOutOfBounds,
  randomBatchSize,
  shouldSpawnBombInBatch,
  distancePointToSegment,
  updateFinalBoss
} from '@/lib/gamePhysics';
import { playSound } from '@/lib/sound';
import { setBestScore } from '@/lib/storage';

interface Props {
  bestScore: number;
  soundEnabled: boolean;
  onSoundToggle: () => void;
  onFinish: (score: number, bestScore: number) => void;
}

const TRAIL_LIFETIME_MS = 170;
const EFFECT_LIFETIME_MS = 820;
const GESTURE_COMMIT_DELAY_MS = 210;

type RushMessage = {
  id: string;
  text: string;
  kind: 'rush' | 'prompt';
};

type BossBurstParticle = {
  id: string;
  dx: number;
  dy: number;
  size: number;
  color: string;
  delayMs: number;
};

type BossFragment = {
  id: string;
  dx: number;
  dy: number;
  size: number;
  rotation: number;
  delayMs: number;
};

type BossExplosion = {
  id: string;
  x: number;
  y: number;
  radius: number;
  createdAt: number;
  particles: BossBurstParticle[];
  fragments: BossFragment[];
};

type MotionStyle = CSSProperties & {
  '--dx'?: string;
  '--dy'?: string;
  '--fragment-rotation'?: string;
  '--motion-delay'?: string;
  '--boss-final-shake-distance'?: string;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getPointFromEvent(event: React.PointerEvent<HTMLDivElement>, stage: HTMLDivElement): SlashPoint {
  const rect = stage.getBoundingClientRect();

  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
    time: performance.now()
  };
}

function createBossSlashMark(point: SlashPoint, boss: FinalBossFruit) {
  const xPercent = clamp(50 + ((point.x - boss.x) / boss.radius) * 50, 18, 82);
  const yPercent = clamp(50 + ((point.y - boss.y) / boss.radius) * 50, 18, 82);

  return {
    id: `${performance.now()}-boss-slash-${Math.random().toString(36).slice(2)}`,
    xPercent,
    yPercent,
    angle: -45 + Math.random() * 90,
    lengthPercent: 42 + Math.random() * 22,
    opacity: 0.62 + Math.random() * 0.24
  };
}

function createBossExplosion(boss: FinalBossFruit): BossExplosion {
  const particleColors = ['#ef4444', '#fb7185', '#f97316', '#facc15', '#22c55e'];
  const particleCount = window.innerWidth < 640 ? Math.round(FINAL_BOSS_CONFIG.explosion.particleCount * 0.72) : FINAL_BOSS_CONFIG.explosion.particleCount;
  const fragments = Array.from({ length: FINAL_BOSS_CONFIG.explosion.fragmentCount }, (_, index) => {
    const angle = (index / FINAL_BOSS_CONFIG.explosion.fragmentCount) * Math.PI * 2 + Math.random() * 0.38;
    const distance = boss.radius * (1.1 + Math.random() * 0.92);

    return {
      id: `${performance.now()}-boss-fragment-${index}-${Math.random().toString(36).slice(2)}`,
      dx: Math.cos(angle) * distance,
      dy: Math.sin(angle) * distance,
      size: boss.radius * (0.34 + Math.random() * 0.24),
      rotation: -120 + Math.random() * 240,
      delayMs: Math.random() * 90
    };
  });
  const particles = Array.from({ length: particleCount }, (_, index) => {
    const angle = (index / particleCount) * Math.PI * 2 + Math.random() * 0.44;
    const distance = boss.radius * (0.95 + Math.random() * 1.3);

    return {
      id: `${performance.now()}-boss-particle-${index}-${Math.random().toString(36).slice(2)}`,
      dx: Math.cos(angle) * distance,
      dy: Math.sin(angle) * distance,
      size: 7 + Math.random() * 13,
      color: particleColors[index % particleColors.length],
      delayMs: Math.random() * 120
    };
  });

  return {
    id: `${performance.now()}-boss-explosion-${Math.random().toString(36).slice(2)}`,
    x: boss.x,
    y: boss.y,
    radius: boss.radius,
    createdAt: performance.now(),
    particles,
    fragments
  };
}

function createEffect(effect: Omit<SliceEffect, 'id' | 'createdAt'>): SliceEffect {
  return {
    ...effect,
    id: `${performance.now()}-${Math.random().toString(36).slice(2)}`,
    createdAt: performance.now()
  };
}

function TrailSegment({ from, to }: { from: SlashPoint; to: SlashPoint }) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);

  return (
    <span
      className="pointer-events-none absolute h-2 origin-left rounded-full bg-white/95 shadow-[0_0_18px_rgba(255,255,255,0.95)]"
      style={{
        left: from.x,
        top: from.y,
        width: Math.max(12, length),
        transform: `rotate(${angle}deg) translateY(-50%)`
      }}
    />
  );
}

export default function GameCanvas({ bestScore, soundEnabled, onSoundToggle, onFinish }: Props) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const itemsRef = useRef<FlyingItem[]>([]);
  const bossRef = useRef<FinalBossFruit | null>(null);
  const bossSpawnedRef = useRef(false);
  const slashRef = useRef<SlashPoint[]>([]);
  const effectsRef = useRef<SliceEffect[]>([]);
  const bossExplosionRef = useRef<BossExplosion | null>(null);
  const scoreRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const gestureTimerRef = useRef<number | null>(null);
  const pointerDownRef = useRef(false);
  const runningRef = useRef(true);
  const lastFrameAtRef = useRef(0);
  const endAtRef = useRef(0);
  const gameStartedAtRef = useRef(0);
  const lastBombSpawnAtRef = useRef(Number.NEGATIVE_INFINITY);
  const nextSpawnAtRef = useRef(0);
  const gestureFruitHitsRef = useRef(0);
  const gestureBaseScoreRef = useRef(0);
  const gestureBombPenaltyRef = useRef(0);
  const bossGestureHitRef = useRef(false);
  const gesturePointRef = useRef<SlashPoint | null>(null);
  const rushModeRef = useRef(false);
  const rushBannerShownRef = useRef(false);
  const promptedSecondsRef = useRef<Set<number>>(new Set());
  const rushMessageTimerRef = useRef<number | null>(null);
  const shakeTimerRef = useRef<number | null>(null);
  const bossFinalShakeTimerRef = useRef<number | null>(null);

  const [items, setItems] = useState<FlyingItem[]>([]);
  const [boss, setBoss] = useState<FinalBossFruit | null>(null);
  const [slash, setSlash] = useState<SlashPoint[]>([]);
  const [effects, setEffects] = useState<SliceEffect[]>([]);
  const [bossExplosion, setBossExplosion] = useState<BossExplosion | null>(null);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION_SECONDS);
  const [difficultyStage, setDifficultyStage] = useState<DifficultyStage>(() => getDifficultyStage(GAME_DURATION_SECONDS));
  const [rushMessage, setRushMessage] = useState<RushMessage | null>(null);
  const [isShaking, setIsShaking] = useState(false);
  const [isBossFinalShaking, setIsBossFinalShaking] = useState(false);

  const clearGestureTimer = useCallback(() => {
    if (gestureTimerRef.current !== null) {
      window.clearTimeout(gestureTimerRef.current);
      gestureTimerRef.current = null;
    }
  }, []);

  const clearRushMessageTimer = useCallback(() => {
    if (rushMessageTimerRef.current !== null) {
      window.clearTimeout(rushMessageTimerRef.current);
      rushMessageTimerRef.current = null;
    }
  }, []);

  const showRushMessage = useCallback(
    (text: string, kind: RushMessage['kind']) => {
      clearRushMessageTimer();
      setRushMessage({
        id: `${performance.now()}-${text}`,
        text,
        kind
      });
      rushMessageTimerRef.current = window.setTimeout(() => {
        setRushMessage(null);
        rushMessageTimerRef.current = null;
      }, kind === 'rush' ? RUSH_MODE_CONFIG.bannerDurationMs : RUSH_MODE_CONFIG.promptDurationMs);
    },
    [clearRushMessageTimer]
  );

  const triggerShake = useCallback(() => {
    if (!rushModeRef.current) return;

    if (shakeTimerRef.current !== null) {
      window.clearTimeout(shakeTimerRef.current);
    }

    setIsShaking(true);
    shakeTimerRef.current = window.setTimeout(() => {
      setIsShaking(false);
      shakeTimerRef.current = null;
    }, RUSH_MODE_CONFIG.shakeDurationMs);
  }, []);

  const triggerBossFinalShake = useCallback(() => {
    if (bossFinalShakeTimerRef.current !== null) {
      window.clearTimeout(bossFinalShakeTimerRef.current);
    }

    setIsBossFinalShaking(true);
    bossFinalShakeTimerRef.current = window.setTimeout(() => {
      setIsBossFinalShaking(false);
      bossFinalShakeTimerRef.current = null;
    }, FINAL_BOSS_CONFIG.explosion.shakeDurationMs);
  }, []);

  const updateScore = useCallback((next: number) => {
    const safeScore = Math.max(0, Math.round(next));
    scoreRef.current = safeScore;
    setScore(safeScore);
  }, []);

  const pushEffects = useCallback((newEffects: SliceEffect[]) => {
    effectsRef.current = [...effectsRef.current, ...newEffects];
    setEffects([...effectsRef.current]);
  }, []);

  const hitFinalBoss = useCallback(
    (point: SlashPoint) => {
      const currentBoss = bossRef.current;
      if (!currentBoss || !currentBoss.active || currentBoss.exploding || currentBoss.completed || currentBoss.defeated || bossGestureHitRef.current) return;

      const nextHits = currentBoss.hits + 1;
      const reward = FINAL_BOSS_CONFIG.rewards.find((milestone) => milestone.hits === nextHits);
      const totalPoints = FINAL_BOSS_CONFIG.scorePerHit + (reward?.bonus ?? 0);
      const defeated = nextHits >= FINAL_BOSS_CONFIG.maxHits;
      const explosionStartedAt = defeated ? performance.now() : undefined;
      const nextSlashMarks = [...currentBoss.slashMarks, createBossSlashMark(point, currentBoss)].slice(-FINAL_BOSS_CONFIG.maxSlashMarks);

      updateScore(scoreRef.current + totalPoints);
      playSound(reward ? 'combo' : 'slice', soundEnabled);
      if (defeated) {
        triggerBossFinalShake();
      } else {
        triggerShake();
      }

      const nextBoss = {
        ...currentBoss,
        hits: nextHits,
        active: true,
        exploding: defeated,
        completed: defeated,
        explosionStartedAt,
        defeated,
        defeatedAt: explosionStartedAt ?? currentBoss.defeatedAt,
        hitFlashId: currentBoss.hitFlashId + 1,
        slashMarks: nextSlashMarks
      };

      bossRef.current = nextBoss;
      setBoss(nextBoss);
      bossGestureHitRef.current = true;

      const bossEffects: SliceEffect[] = [
        createEffect({
          kind: 'score',
          x: point.x,
          y: point.y - 28,
          text: `+${FINAL_BOSS_CONFIG.scorePerHit}`,
          color: '#ef4444'
        }),
        createEffect({
          kind: 'splash',
          x: point.x,
          y: point.y,
          asset: '/assets/juice-splash.png',
          color: '#ef4444'
        })
      ];

      if (reward) {
        bossEffects.push(
          createEffect({
            kind: 'combo',
            x: currentBoss.x,
            y: currentBoss.y - currentBoss.radius * 0.76,
            text: defeated ? `${FINAL_BOSS_CONFIG.explosion.text}${FINAL_BOSS_CONFIG.explosion.bonusText}` : reward.text,
            color: defeated ? '#dc2626' : '#f97316'
          })
        );
      }

      if (defeated) {
        const explosion = createBossExplosion(currentBoss);
        bossExplosionRef.current = explosion;
        setBossExplosion(explosion);
        bossEffects.push(
          createEffect({ kind: 'splash', x: currentBoss.x, y: currentBoss.y, asset: '/assets/juice-splash.png', color: '#ef4444' }),
          createEffect({ kind: 'sliced', x: currentBoss.x, y: currentBoss.y, asset: '/assets/explosion.png' }),
          createEffect({ kind: 'sliced', x: currentBoss.x, y: currentBoss.y, asset: FINAL_BOSS_CONFIG.slicedAsset })
        );
      }

      pushEffects(bossEffects);
    },
    [pushEffects, soundEnabled, triggerBossFinalShake, triggerShake, updateScore]
  );

  const tryHitFinalBoss = useCallback(
    (point: SlashPoint, previous?: SlashPoint) => {
      const currentBoss = bossRef.current;
      if (!currentBoss || !currentBoss.active || currentBoss.exploding || currentBoss.completed || currentBoss.defeated || bossGestureHitRef.current) return;

      if (isFinalBossHit(currentBoss, point, previous)) {
        hitFinalBoss(point);
      }
    },
    [hitFinalBoss]
  );

  const commitGestureScore = useCallback(() => {
    clearGestureTimer();

    const fruitHits = gestureFruitHitsRef.current;
    const bombPenalty = gestureBombPenaltyRef.current;
    if (fruitHits <= 0 && bombPenalty === 0) return;

    const point = gesturePointRef.current;
    const comboBonus = getComboBonus(fruitHits);
    const totalPoints = getGestureFruitScore(gestureBaseScoreRef.current, fruitHits, bombPenalty);
    updateScore(scoreRef.current + totalPoints);
    if (fruitHits > 0) {
      playSound(fruitHits >= 2 ? 'combo' : 'slice', soundEnabled);
    }
    if (fruitHits >= 2) {
      triggerShake();
    }
    if (comboBonus > 0) {
      pushEffects([
        createEffect({
          kind: 'combo',
          x: point?.x ?? window.innerWidth / 2,
          y: point?.y ?? window.innerHeight / 3,
          text: `Combo +${comboBonus}`,
          color: '#f97316'
        })
      ]);
    }

    gestureFruitHitsRef.current = 0;
    gestureBaseScoreRef.current = 0;
    gestureBombPenaltyRef.current = 0;
    gesturePointRef.current = null;
  }, [clearGestureTimer, pushEffects, soundEnabled, triggerShake, updateScore]);

  const scheduleGestureCommit = useCallback(() => {
    clearGestureTimer();
    gestureTimerRef.current = window.setTimeout(commitGestureScore, GESTURE_COMMIT_DELAY_MS);
  }, [clearGestureTimer, commitGestureScore]);

  const finish = useCallback(() => {
    if (!runningRef.current) return;

    runningRef.current = false;
    clearGestureTimer();
    commitGestureScore();

    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    const finalScore = scoreRef.current;
    const finalBest = Math.max(bestScore, finalScore);
    setBestScore(finalBest);
    playSound('game-over', soundEnabled);
    onFinish(finalScore, finalBest);
  }, [bestScore, clearGestureTimer, commitGestureScore, onFinish, soundEnabled]);

  useEffect(() => {
    const startAt = performance.now();
    runningRef.current = true;
    rushModeRef.current = false;
    rushBannerShownRef.current = false;
    promptedSecondsRef.current = new Set();
    itemsRef.current = [];
    bossRef.current = null;
    bossExplosionRef.current = null;
    bossSpawnedRef.current = false;
    slashRef.current = [];
    effectsRef.current = [];
    endAtRef.current = startAt + GAME_DURATION_SECONDS * 1000;
    gameStartedAtRef.current = startAt;
    lastBombSpawnAtRef.current = Number.NEGATIVE_INFINITY;
    nextSpawnAtRef.current = startAt + 250;
    lastFrameAtRef.current = startAt;

    const spawnItem = (now: number, stage: DifficultyStage) => {
      const rect = stageRef.current?.getBoundingClientRect();
      if (!rect) return;

      const spawnCount = randomBatchSize(stage);
      const nextItems: FlyingItem[] = [];
      const shouldIncludeBomb = shouldSpawnBombInBatch({
        now,
        gameStartedAt: gameStartedAtRef.current,
        lastBombSpawnAt: lastBombSpawnAtRef.current,
        bombChance: stage.bombChance
      });
      const bombCount = shouldIncludeBomb ? Math.min(BOMB_SMOOTHING_CONFIG.maxBombsPerBatch, spawnCount) : 0;

      for (let index = 0; index < bombCount; index += 1) {
        nextItems.push(createFlyingItem(rect.width, rect.height, stage, { forceKind: 'bomb' }));
      }

      if (bombCount > 0) {
        lastBombSpawnAtRef.current = now;
      }

      for (let index = bombCount; index < spawnCount; index += 1) {
        nextItems.push(createFlyingItem(rect.width, rect.height, stage, { forceKind: 'fruit' }));
      }

      itemsRef.current = [...itemsRef.current, ...nextItems];
      const isRushMode = rushModeRef.current;
      const interval = isRushMode ? stage.spawnIntervalMs * RUSH_MODE_CONFIG.spawnIntervalMultiplier : stage.spawnIntervalMs;
      const jitter = isRushMode ? RUSH_MODE_CONFIG.spawnJitterMs : 90;
      nextSpawnAtRef.current = now + interval + Math.random() * jitter;
    };

    const loop = (now: number) => {
      if (!runningRef.current) return;

      const delta = Math.min(33, now - lastFrameAtRef.current);
      const stepScale = delta / 16.67;
      lastFrameAtRef.current = now;

      const remainingSeconds = Math.max(0, Math.ceil((endAtRef.current - now) / 1000));
      const stage = getDifficultyStage(remainingSeconds);
      const isRushMode = remainingSeconds <= RUSH_MODE_CONFIG.startsAtSeconds;
      rushModeRef.current = isRushMode;
      setDifficultyStage((current) => (current.id === stage.id ? current : stage));

      if (isRushMode && !rushBannerShownRef.current) {
        rushBannerShownRef.current = true;
        showRushMessage('最后冲刺！', 'rush');
      }

      const finalPrompt = FINAL_COUNTDOWN_CONFIG.prompts.find((prompt) => prompt.timeLeft === remainingSeconds);
      if (finalPrompt && !promptedSecondsRef.current.has(remainingSeconds)) {
        promptedSecondsRef.current.add(remainingSeconds);
        showRushMessage(finalPrompt.text, 'prompt');
      }

      if (now >= nextSpawnAtRef.current) {
        spawnItem(now, stage);
      }

      const rect = stageRef.current?.getBoundingClientRect();
      const width = rect?.width ?? window.innerWidth;
      const height = rect?.height ?? window.innerHeight;

      if (remainingSeconds <= FINAL_BOSS_CONFIG.startsAtSeconds && !bossSpawnedRef.current) {
        bossRef.current = createFinalBoss(width, height, now);
        bossSpawnedRef.current = true;
      }

      if (
        bossRef.current?.exploding &&
        bossRef.current.explosionStartedAt &&
        now - bossRef.current.explosionStartedAt >= FINAL_BOSS_CONFIG.explosion.durationMs
      ) {
        bossRef.current = {
          ...bossRef.current,
          active: false,
          exploding: false
        };
        bossRef.current = null;
      }

      if (bossExplosionRef.current && now - bossExplosionRef.current.createdAt >= FINAL_BOSS_CONFIG.explosion.durationMs) {
        bossExplosionRef.current = null;
        setBossExplosion(null);
      }

      if (bossRef.current && bossRef.current.active && !bossRef.current.exploding && !bossRef.current.defeated && FINAL_BOSS_CONFIG.movement.enabled) {
        bossRef.current = updateFinalBoss(bossRef.current, width, height, delta, now);
      }

      itemsRef.current = itemsRef.current
        .map((item) => ({
          ...item,
          x: item.x + item.vx * stepScale,
          y: item.y + item.vy * stepScale,
          vy: item.vy + item.gravity * stepScale,
          rotation: item.rotation + item.rotationSpeed * stepScale
        }))
        .filter((item) => !item.sliced && !isOutOfBounds(item, width, height));

      slashRef.current = slashRef.current.filter((point) => now - point.time < TRAIL_LIFETIME_MS);
      effectsRef.current = effectsRef.current.filter((effect) => now - effect.createdAt < EFFECT_LIFETIME_MS);

      setItems([...itemsRef.current]);
      setBoss(bossRef.current ? { ...bossRef.current } : null);
      setSlash([...slashRef.current]);
      setEffects([...effectsRef.current]);

      setTimeLeft((current) => (current === remainingSeconds ? current : remainingSeconds));

      if (remainingSeconds <= 0) {
        finish();
        return;
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      runningRef.current = false;
      clearGestureTimer();
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
      clearRushMessageTimer();
      if (shakeTimerRef.current !== null) {
        window.clearTimeout(shakeTimerRef.current);
      }
      if (bossFinalShakeTimerRef.current !== null) {
        window.clearTimeout(bossFinalShakeTimerRef.current);
      }
    };
  }, [clearGestureTimer, clearRushMessageTimer, finish, showRushMessage]);

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!runningRef.current || !stageRef.current) return;

    event.preventDefault();
    pointerDownRef.current = true;
    clearGestureTimer();
    gestureFruitHitsRef.current = 0;
    gestureBaseScoreRef.current = 0;
    gestureBombPenaltyRef.current = 0;
    bossGestureHitRef.current = false;
    gesturePointRef.current = null;

    const point = getPointFromEvent(event, stageRef.current);
    slashRef.current = [point];
    setSlash([...slashRef.current]);
    tryHitFinalBoss(point);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Synthetic pointer checks may not have an active browser pointer to capture.
    }
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!pointerDownRef.current || !runningRef.current || !stageRef.current) return;

    event.preventDefault();
    const point = getPointFromEvent(event, stageRef.current);
    const previous = slashRef.current.at(-1);
    slashRef.current.push(point);

    if (!previous) {
      tryHitFinalBoss(point);
      return;
    }

    const newEffects: SliceEffect[] = [];
    let bombHits = 0;
    let fruitHits = 0;
    let bombPenalty = 0;
    let fruitBaseScore = 0;

    tryHitFinalBoss(point, previous);

    itemsRef.current = itemsRef.current.map((item) => {
      if (item.sliced) return item;

      const hitDistance = distancePointToSegment(item.x, item.y, previous.x, previous.y, point.x, point.y);
      if (hitDistance > item.radius) return item;

      if (item.kind === 'bomb') {
        bombHits += 1;
        bombPenalty += item.points;
        newEffects.push(
          createEffect({ kind: 'bomb', x: item.x, y: item.y, text: String(item.points), color: '#dc2626' }),
          createEffect({ kind: 'sliced', x: item.x, y: item.y, asset: '/assets/explosion.png' })
        );
      } else {
        fruitHits += 1;
        fruitBaseScore += item.points;
        newEffects.push(
          createEffect({ kind: 'score', x: item.x, y: item.y - item.radius * 0.58, text: `+${item.points}`, color: item.juice }),
          createEffect({ kind: 'splash', x: item.x, y: item.y, asset: '/assets/juice-splash.png', color: item.juice }),
          createEffect({ kind: 'sliced', x: item.x, y: item.y, asset: item.slicedAsset })
        );
      }

      return { ...item, sliced: true };
    });

    if (fruitHits > 0) {
      gestureFruitHitsRef.current += fruitHits;
      gestureBaseScoreRef.current += fruitBaseScore;
      gesturePointRef.current = point;
      scheduleGestureCommit();
    }

    if (bombHits > 0) {
      gestureBombPenaltyRef.current += bombPenalty;
      gesturePointRef.current = point;
      scheduleGestureCommit();
      playSound('bomb', soundEnabled);
      triggerShake();
    }

    if (newEffects.length > 0) {
      pushEffects(newEffects);
    }
  }

  function endPointer(event: React.PointerEvent<HTMLDivElement>) {
    if (!pointerDownRef.current) return;

    if (runningRef.current && stageRef.current) {
      const point = getPointFromEvent(event, stageRef.current);
      const previous = slashRef.current.at(-1);
      tryHitFinalBoss(point, previous ?? undefined);
    }

    pointerDownRef.current = false;
    bossGestureHitRef.current = false;
    slashRef.current = [];
    setSlash([]);
    commitGestureScore();

    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch {
      // See pointer capture note in handlePointerDown.
    }
  }

  const trailSegments = slash.slice(1).map((point, index) => ({
    from: slash[index],
    to: point
  }));
  const isRushMode = timeLeft <= RUSH_MODE_CONFIG.startsAtSeconds;
  const isFinalCountdown = timeLeft <= FINAL_COUNTDOWN_CONFIG.pulseStartsAtSeconds;
  const bossProgress = boss ? (boss.hits / boss.maxHits) * 100 : 0;
  const bossStage = boss ? (boss.defeated ? 'defeated' : boss.hits >= 20 ? 'critical' : boss.hits >= 10 ? 'damaged' : boss.hits >= 5 ? 'marked' : 'fresh') : 'fresh';

  return (
    <main
      className={`relative min-h-screen overflow-hidden bg-[#f6ffe7] text-emerald-950 ${isShaking ? 'animate-rush-shake' : ''} ${
        isBossFinalShaking ? 'animate-boss-final-shake' : ''
      }`}
      style={{ '--boss-final-shake-distance': `${FINAL_BOSS_CONFIG.explosion.shakeIntensity}px` } as MotionStyle}
    >
      <div
        className={`absolute inset-0 ${
          isRushMode
            ? 'bg-[radial-gradient(circle_at_12%_12%,rgba(248,113,113,0.32),transparent_24%),radial-gradient(circle_at_82%_18%,rgba(250,204,21,0.38),transparent_22%),linear-gradient(180deg,#dcfce7_0%,#fef3c7_52%,#fb923c_100%)]'
            : 'bg-[radial-gradient(circle_at_12%_12%,rgba(250,204,21,0.35),transparent_24%),radial-gradient(circle_at_82%_18%,rgba(45,212,191,0.32),transparent_22%),linear-gradient(180deg,#dcfce7_0%,#fef9c3_58%,#fcd34d_100%)]'
        }`}
      />
      {isRushMode && (
        <>
          <div className="rush-speed-lines absolute inset-0" />
          <div className={`rush-warm-glow absolute inset-0 ${isFinalCountdown ? 'rush-warm-glow-final' : ''}`} />
        </>
      )}
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-emerald-400/35 to-transparent" />

      <header className="absolute left-0 right-0 top-0 z-20 px-3 pt-3 sm:px-5">
        <div className="mx-auto grid max-w-4xl grid-cols-3 gap-2 rounded-[8px] border border-white/70 bg-white/82 p-2 text-center shadow-soft backdrop-blur">
          <div className="rounded-[6px] bg-emerald-50 px-2 py-2">
            <p className="text-xs font-bold text-emerald-700">分数</p>
            <p data-testid="score-value" className="score-pop text-xl font-black sm:text-2xl">
              {score}
            </p>
          </div>
          <div className="rounded-[6px] bg-yellow-50 px-2 py-2">
            <p className="text-xs font-bold text-yellow-700">倒计时</p>
            <p
              key={timeLeft}
              data-testid="timer-value"
              className={`font-black ${
                isRushMode ? 'text-2xl text-red-600 sm:text-3xl' : 'text-xl text-orange-600 sm:text-2xl'
              } ${isFinalCountdown ? 'animate-final-countdown-pulse' : ''}`}
            >
              {timeLeft}s
            </p>
          </div>
          <div className="rounded-[6px] bg-lime-50 px-2 py-2">
            <p className="text-xs font-bold text-emerald-700">最高</p>
            <p data-testid="best-value" className="text-xl font-black sm:text-2xl">
              {Math.max(bestScore, score)}
            </p>
          </div>
        </div>
        <div className="mx-auto mt-2 flex max-w-4xl items-center justify-between gap-2">
          <div
            data-testid="difficulty-stage"
            data-stage-id={difficultyStage.id}
            className={`rounded-[8px] border border-white/70 px-4 py-2 text-sm font-black shadow-soft backdrop-blur ${
              isRushMode ? 'animate-sprint-pulse bg-red-500 text-white' : 'bg-white/82 text-emerald-800'
            }`}
          >
            {isRushMode ? '最后冲刺！' : difficultyStage.label}
          </div>
          <SoundToggle enabled={soundEnabled} compact onToggle={onSoundToggle} />
        </div>
      </header>

      <div
        ref={stageRef}
        data-testid="game-stage"
        className="relative z-10 h-[100dvh] w-screen touch-none select-none overflow-hidden"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onContextMenu={(event) => event.preventDefault()}
      >
        {rushMessage && (
          <div
            key={rushMessage.id}
            data-testid="rush-message"
            className={`pointer-events-none absolute left-1/2 z-30 -translate-x-1/2 text-center font-black text-white drop-shadow-[0_8px_18px_rgba(127,29,29,0.34)] ${
              rushMessage.kind === 'rush'
                ? 'animate-rush-banner top-[26%] text-5xl sm:text-6xl'
                : 'animate-final-hint top-[18%] rounded-[8px] bg-red-500/88 px-5 py-2 text-3xl shadow-soft backdrop-blur sm:text-4xl'
            }`}
          >
            {rushMessage.text}
          </div>
        )}

        {items.map((item) => (
          <img
            key={item.id}
            src={item.asset}
            alt={item.label}
            data-item-kind={item.kind}
            data-item-points={item.points}
            draggable={false}
            className="pointer-events-none absolute object-contain drop-shadow-[0_14px_16px_rgba(20,83,45,0.22)]"
            style={{
              left: item.x - item.radius,
              top: item.y - item.radius,
              width: item.radius * 2,
              height: item.radius * 2,
              transform: `rotate(${item.rotation}deg)`
            }}
          />
        ))}

        {boss && (
          <>
            <div
              data-testid="final-boss-fruit"
              data-boss-hits={boss.hits}
              data-boss-max-hits={boss.maxHits}
              data-boss-x={Math.round(boss.x)}
              data-boss-y={Math.round(boss.y)}
              data-boss-vx={Math.round(boss.vx)}
              data-boss-vy={Math.round(boss.vy)}
              data-boss-stage={bossStage}
              className={`pointer-events-none absolute z-10 final-boss-shell final-boss-stage-${bossStage}`}
              style={{
                left: boss.x - boss.radius,
                top: boss.y - boss.radius,
                width: boss.radius * 2,
                height: boss.radius * 2
              }}
            >
              <img
                key={boss.hitFlashId}
                src={boss.defeated ? FINAL_BOSS_CONFIG.slicedAsset : FINAL_BOSS_CONFIG.asset}
                alt="Boss 大西瓜"
                draggable={false}
                className={`final-boss-image h-full w-full object-contain drop-shadow-[0_18px_22px_rgba(127,29,29,0.28)] ${
                  boss.defeated ? 'final-boss-image-defeated' : ''
                }`}
              />
              <span className="final-boss-glow" />
              {boss.slashMarks.map((mark) => (
                <span
                  key={mark.id}
                  className="final-boss-slash-mark"
                  style={{
                    left: `${mark.xPercent}%`,
                    top: `${mark.yPercent}%`,
                    width: `${mark.lengthPercent}%`,
                    opacity: mark.opacity,
                    transform: `translate(-50%, -50%) rotate(${mark.angle}deg)`
                  }}
                />
              ))}
              {bossStage === 'damaged' || bossStage === 'critical' || bossStage === 'defeated' ? <span className="final-boss-juice-dot final-boss-juice-dot-a" /> : null}
              {bossStage === 'critical' || bossStage === 'defeated' ? (
                <>
                  <span className="final-boss-juice-dot final-boss-juice-dot-b" />
                  <span className="final-boss-juice-dot final-boss-juice-dot-c" />
                </>
              ) : null}
              {bossStage === 'critical' && <span className="final-boss-critical-label">快切爆了！</span>}
            </div>
            <div className="pointer-events-none absolute bottom-20 left-1/2 z-20 w-[min(88vw,420px)] -translate-x-1/2 rounded-[8px] border border-white/70 bg-white/78 px-3 py-2 shadow-soft backdrop-blur">
              <div className={`flex items-center justify-between text-xs font-black ${boss.hits >= 20 ? 'text-red-700' : 'text-orange-700'}`}>
                <span>超大西瓜</span>
                <span>
                  {boss.hits}/{boss.maxHits}
                </span>
              </div>
              <div className={`mt-1 h-2 overflow-hidden rounded-full ${boss.hits >= 20 ? 'bg-red-100' : 'bg-orange-100'}`}>
                <div
                  className={`h-full rounded-full transition-[width] duration-150 ${
                    boss.hits >= 20 ? 'animate-boss-progress-hot bg-gradient-to-r from-red-500 to-rose-600' : 'bg-gradient-to-r from-orange-400 to-red-500'
                  }`}
                  style={{ width: `${bossProgress}%` }}
                />
              </div>
            </div>
          </>
        )}

        {bossExplosion && (
          <div
            key={bossExplosion.id}
            data-testid="boss-explosion"
            className="pointer-events-none absolute z-40"
            style={{
              left: bossExplosion.x,
              top: bossExplosion.y
            }}
          >
            <span
              data-testid="boss-explosion-ring"
              className="boss-explosion-ring"
              style={{
                left: -bossExplosion.radius * 1.45,
                top: -bossExplosion.radius * 1.45,
                width: bossExplosion.radius * 2.9,
                height: bossExplosion.radius * 2.9,
                animationDuration: `${FINAL_BOSS_CONFIG.explosion.ringDurationMs}ms`
              }}
            />
            <span
              className="boss-explosion-ring boss-explosion-ring-secondary"
              style={{
                left: -bossExplosion.radius * 1.18,
                top: -bossExplosion.radius * 1.18,
                width: bossExplosion.radius * 2.36,
                height: bossExplosion.radius * 2.36,
                animationDuration: `${FINAL_BOSS_CONFIG.explosion.ringDurationMs}ms`
              }}
            />
            <img
              src="/assets/explosion.png"
              alt=""
              draggable={false}
              className="boss-explosion-flash"
              style={{
                left: -bossExplosion.radius * 1.24,
                top: -bossExplosion.radius * 1.24,
                width: bossExplosion.radius * 2.48,
                height: bossExplosion.radius * 2.48
              }}
            />
            <img
              src="/assets/juice-splash.png"
              alt=""
              draggable={false}
              className="boss-explosion-splash"
              style={{
                left: -bossExplosion.radius * 1.48,
                top: -bossExplosion.radius * 1.48,
                width: bossExplosion.radius * 2.96,
                height: bossExplosion.radius * 2.96
              }}
            />
            <div className="boss-explosion-text">
              {FINAL_BOSS_CONFIG.explosion.text}
              <span>{FINAL_BOSS_CONFIG.explosion.bonusText}</span>
            </div>
            {bossExplosion.fragments.map((fragment) => (
              <img
                key={fragment.id}
                src={FINAL_BOSS_CONFIG.slicedAsset}
                alt=""
                draggable={false}
                className="boss-fragment"
                style={
                  {
                    left: -fragment.size / 2,
                    top: -fragment.size / 2,
                    width: fragment.size,
                    height: fragment.size,
                    '--dx': `${fragment.dx}px`,
                    '--dy': `${fragment.dy}px`,
                    '--fragment-rotation': `${fragment.rotation}deg`,
                    '--motion-delay': `${fragment.delayMs}ms`
                  } as MotionStyle
                }
              />
            ))}
            {bossExplosion.particles.map((particle) => (
              <span
                key={particle.id}
                className="boss-burst-particle"
                style={
                  {
                    left: -particle.size / 2,
                    top: -particle.size / 2,
                    width: particle.size,
                    height: particle.size,
                    background: particle.color,
                    color: particle.color,
                    '--dx': `${particle.dx}px`,
                    '--dy': `${particle.dy}px`,
                    '--motion-delay': `${particle.delayMs}ms`
                  } as MotionStyle
                }
              />
            ))}
          </div>
        )}

        {effects.map((effect) => {
          if (effect.asset) {
            const size = effect.kind === 'splash' ? 112 : effect.kind === 'sliced' ? 118 : 96;

            return (
              <img
                key={effect.id}
                src={effect.asset}
                alt=""
                draggable={false}
                className={`pointer-events-none absolute object-contain ${
                  effect.kind === 'splash' ? 'animate-splash-pop opacity-80 mix-blend-multiply' : 'animate-slice-pop'
                }`}
                style={{
                  left: effect.x - size / 2,
                  top: effect.y - size / 2,
                  width: size,
                  height: size,
                  filter: effect.color ? `drop-shadow(0 0 8px ${effect.color})` : undefined
                }}
              />
            );
          }

          return (
            <div
              key={effect.id}
              className={`pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 font-black drop-shadow-lg ${
                effect.kind === 'combo'
                  ? isRushMode
                    ? 'animate-rush-combo-pop text-4xl sm:text-5xl'
                    : 'animate-combo-pop text-3xl sm:text-4xl'
                  : 'animate-score-float text-2xl'
              }`}
              style={{
                left: effect.x,
                top: effect.y,
                color: effect.color
              }}
            >
              {effect.text}
            </div>
          );
        })}

        {trailSegments.map((segment, index) => (
          <TrailSegment key={`${segment.from.time}-${segment.to.time}-${index}`} from={segment.from} to={segment.to} />
        ))}

        <div className="pointer-events-none absolute bottom-5 left-1/2 w-[min(92vw,560px)] -translate-x-1/2 rounded-[8px] bg-white/54 px-4 py-2 text-center text-sm font-bold text-emerald-800 shadow-soft backdrop-blur">
          滑动切水果，看到炸弹就收手
        </div>
      </div>
    </main>
  );
}
