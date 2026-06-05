'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import SoundToggle from './SoundToggle';
import { DifficultyStage, FlyingItem, GAME_DURATION_SECONDS, SlashPoint, SliceEffect, getDifficultyStage } from '@/lib/gameConfig';
import { createFlyingItem, distancePointToSegment, getGestureFruitScore, isOutOfBounds, randomBatchSize } from '@/lib/gamePhysics';
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

function getPointFromEvent(event: React.PointerEvent<HTMLDivElement>, stage: HTMLDivElement): SlashPoint {
  const rect = stage.getBoundingClientRect();

  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
    time: performance.now()
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
  const slashRef = useRef<SlashPoint[]>([]);
  const effectsRef = useRef<SliceEffect[]>([]);
  const scoreRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const gestureTimerRef = useRef<number | null>(null);
  const pointerDownRef = useRef(false);
  const runningRef = useRef(true);
  const lastFrameAtRef = useRef(0);
  const endAtRef = useRef(0);
  const nextSpawnAtRef = useRef(0);
  const gestureFruitHitsRef = useRef(0);
  const gesturePointRef = useRef<SlashPoint | null>(null);

  const [items, setItems] = useState<FlyingItem[]>([]);
  const [slash, setSlash] = useState<SlashPoint[]>([]);
  const [effects, setEffects] = useState<SliceEffect[]>([]);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION_SECONDS);
  const [difficultyStage, setDifficultyStage] = useState<DifficultyStage>(() => getDifficultyStage(GAME_DURATION_SECONDS));

  const clearGestureTimer = useCallback(() => {
    if (gestureTimerRef.current !== null) {
      window.clearTimeout(gestureTimerRef.current);
      gestureTimerRef.current = null;
    }
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

  const commitGestureScore = useCallback(() => {
    clearGestureTimer();

    const fruitHits = gestureFruitHitsRef.current;
    if (fruitHits <= 0) return;

    const point = gesturePointRef.current;
    const points = getGestureFruitScore(fruitHits);
    updateScore(scoreRef.current + points);
    playSound(fruitHits >= 2 ? 'combo' : 'slice', soundEnabled);
    pushEffects([
      createEffect({
        kind: fruitHits >= 2 ? 'combo' : 'score',
        x: point?.x ?? window.innerWidth / 2,
        y: point?.y ?? window.innerHeight / 3,
        text: fruitHits >= 2 ? `Combo x${fruitHits}  +${points}` : '+1',
        color: fruitHits >= 2 ? '#f97316' : '#16a34a'
      })
    ]);

    gestureFruitHitsRef.current = 0;
    gesturePointRef.current = null;
  }, [clearGestureTimer, pushEffects, soundEnabled, updateScore]);

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
    itemsRef.current = [];
    slashRef.current = [];
    effectsRef.current = [];
    endAtRef.current = startAt + GAME_DURATION_SECONDS * 1000;
    nextSpawnAtRef.current = startAt + 250;
    lastFrameAtRef.current = startAt;

    const spawnItem = (now: number, stage: DifficultyStage) => {
      const rect = stageRef.current?.getBoundingClientRect();
      if (!rect) return;

      const spawnCount = randomBatchSize(stage);
      const nextItems: FlyingItem[] = [];

      for (let index = 0; index < spawnCount; index += 1) {
        nextItems.push(createFlyingItem(rect.width, rect.height, stage));
      }

      itemsRef.current = [...itemsRef.current, ...nextItems];
      nextSpawnAtRef.current = now + stage.spawnIntervalMs + Math.random() * 90;
    };

    const loop = (now: number) => {
      if (!runningRef.current) return;

      const delta = Math.min(33, now - lastFrameAtRef.current);
      const stepScale = delta / 16.67;
      lastFrameAtRef.current = now;

      const remainingSeconds = Math.max(0, Math.ceil((endAtRef.current - now) / 1000));
      const stage = getDifficultyStage(remainingSeconds);
      setDifficultyStage((current) => (current.id === stage.id ? current : stage));

      if (now >= nextSpawnAtRef.current) {
        spawnItem(now, stage);
      }

      const rect = stageRef.current?.getBoundingClientRect();
      const width = rect?.width ?? window.innerWidth;
      const height = rect?.height ?? window.innerHeight;

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
    };
  }, [clearGestureTimer, finish]);

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!runningRef.current || !stageRef.current) return;

    event.preventDefault();
    pointerDownRef.current = true;
    clearGestureTimer();
    gestureFruitHitsRef.current = 0;
    gesturePointRef.current = null;

    const point = getPointFromEvent(event, stageRef.current);
    slashRef.current = [point];
    setSlash([...slashRef.current]);
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

    if (!previous) return;

    const newEffects: SliceEffect[] = [];
    let bombHits = 0;
    let fruitHits = 0;

    itemsRef.current = itemsRef.current.map((item) => {
      if (item.sliced) return item;

      const hitDistance = distancePointToSegment(item.x, item.y, previous.x, previous.y, point.x, point.y);
      if (hitDistance > item.radius) return item;

      if (item.kind === 'bomb') {
        bombHits += 1;
        newEffects.push(
          createEffect({ kind: 'bomb', x: item.x, y: item.y, text: '-5', color: '#dc2626' }),
          createEffect({ kind: 'sliced', x: item.x, y: item.y, asset: '/assets/explosion.png' })
        );
      } else {
        fruitHits += 1;
        newEffects.push(
          createEffect({ kind: 'splash', x: item.x, y: item.y, asset: '/assets/juice-splash.png', color: item.juice }),
          createEffect({ kind: 'sliced', x: item.x, y: item.y, asset: item.slicedAsset })
        );
      }

      return { ...item, sliced: true };
    });

    if (fruitHits > 0) {
      gestureFruitHitsRef.current += fruitHits;
      gesturePointRef.current = point;
      scheduleGestureCommit();
    }

    if (bombHits > 0) {
      updateScore(scoreRef.current - bombHits * 5);
      playSound('bomb', soundEnabled);
    }

    if (newEffects.length > 0) {
      pushEffects(newEffects);
    }
  }

  function endPointer(event: React.PointerEvent<HTMLDivElement>) {
    if (!pointerDownRef.current) return;

    pointerDownRef.current = false;
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

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f6ffe7] text-emerald-950">
      <div
        className={`absolute inset-0 ${
          difficultyStage.id === 'sprint'
            ? 'bg-[radial-gradient(circle_at_12%_12%,rgba(248,113,113,0.32),transparent_24%),radial-gradient(circle_at_82%_18%,rgba(250,204,21,0.38),transparent_22%),linear-gradient(180deg,#dcfce7_0%,#fef3c7_52%,#fb923c_100%)]'
            : 'bg-[radial-gradient(circle_at_12%_12%,rgba(250,204,21,0.35),transparent_24%),radial-gradient(circle_at_82%_18%,rgba(45,212,191,0.32),transparent_22%),linear-gradient(180deg,#dcfce7_0%,#fef9c3_58%,#fcd34d_100%)]'
        }`}
      />
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
              data-testid="timer-value"
              className={`text-xl font-black sm:text-2xl ${difficultyStage.id === 'sprint' ? 'text-red-600' : 'text-orange-600'}`}
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
              difficultyStage.id === 'sprint' ? 'animate-sprint-pulse bg-red-500 text-white' : 'bg-white/82 text-emerald-800'
            }`}
          >
            {difficultyStage.id === 'sprint' ? '最后冲刺！' : difficultyStage.label}
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
        {items.map((item) => (
          <img
            key={item.id}
            src={item.asset}
            alt={item.label}
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
                effect.kind === 'combo' ? 'animate-combo-pop text-3xl sm:text-4xl' : 'animate-score-float text-2xl'
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
