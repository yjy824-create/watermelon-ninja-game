'use client';

import { useEffect, useState } from 'react';
import GameCanvas from './GameCanvas';
import ShareCard from './ShareCard';
import SoundToggle from './SoundToggle';
import { COMBO_BONUS, FRUIT_SCORE_MAP } from '@/lib/gameConfig';
import { getPlayerRank } from '@/lib/rank';
import { getSoundEnabled, initializeSound, playSound, setSoundEnabled } from '@/lib/sound';
import { getBestScore } from '@/lib/storage';

type Screen = 'home' | 'playing' | 'result';

export default function GameShell() {
  const [screen, setScreen] = useState<Screen>('home');
  const [lastScore, setLastScore] = useState(0);
  const [bestScore, setBestScoreState] = useState(0);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [soundEnabled, setSoundEnabledState] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setBestScoreState(getBestScore());
      setSoundEnabledState(getSoundEnabled());
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  async function handleSoundToggle() {
    const nextEnabled = !soundEnabled;
    setSoundEnabledState(nextEnabled);
    setSoundEnabled(nextEnabled);

    if (nextEnabled) {
      await initializeSound();
      playSound('click', true);
    }
  }

  async function handleStartGame() {
    await initializeSound();
    playSound('click', soundEnabled);
    setIsNewRecord(false);
    setLastScore(0);
    setScreen('playing');
  }

  async function handleReplay() {
    await initializeSound();
    playSound('click', soundEnabled);
    setScreen('playing');
  }

  function handleGoHome() {
    playSound('click', soundEnabled);
    setScreen('home');
  }

  if (screen === 'playing') {
    return (
      <GameCanvas
        bestScore={bestScore}
        soundEnabled={soundEnabled}
        onSoundToggle={handleSoundToggle}
        onFinish={(score, best) => {
          setLastScore(score);
          setIsNewRecord(score > bestScore);
          setBestScoreState(best);
          setScreen('result');
        }}
      />
    );
  }

  if (screen === 'result') {
    const rank = getPlayerRank(lastScore);

    return (
      <main className="relative min-h-screen overflow-hidden bg-[#f6ffe7] px-5 py-8 text-center text-emerald-950">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(250,204,21,0.38),transparent_24%),radial-gradient(circle_at_85%_18%,rgba(45,212,191,0.28),transparent_20%),linear-gradient(180deg,#dcfce7_0%,#fef9c3_58%,#fbbf24_100%)]" />
        <section className="relative mx-auto flex min-h-[calc(100dvh-4rem)] max-w-xl flex-col items-center justify-center">
          <div data-testid="result-panel" className="w-full animate-result-in rounded-[8px] border border-white/80 bg-white/84 p-6 shadow-soft backdrop-blur sm:p-8">
            <img src="/assets/logo.png" alt="" draggable={false} className="mx-auto h-24 w-24 object-contain drop-shadow-lg" />
            <h1 className="mt-3 text-3xl font-black sm:text-4xl">游戏结束</h1>
            <p className="mt-2 text-base font-bold text-emerald-700">
              {isNewRecord ? '刷新纪录，漂亮！' : '再切一轮，纪录就在前面'}
            </p>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-[8px] bg-emerald-50 p-4">
                <p className="text-sm font-bold text-emerald-700">本次分数</p>
                <p className="mt-1 text-5xl font-black text-emerald-600">{lastScore}</p>
              </div>
              <div className="rounded-[8px] bg-yellow-50 p-4">
                <p className="text-sm font-bold text-yellow-700">最高分</p>
                <p className="mt-1 text-5xl font-black text-orange-500">{bestScore}</p>
              </div>
            </div>

            <div className="mt-4 rounded-[8px] bg-white/80 px-4 py-3 shadow-inner">
              <p data-testid="player-rank" data-rank-title={rank.title} className="text-2xl font-black text-orange-500">
                {rank.title}
              </p>
              <p className="mt-1 text-sm font-bold text-emerald-700">{rank.encouragement}</p>
            </div>

            <ShareCard score={lastScore} bestScore={bestScore} rank={rank} soundEnabled={soundEnabled} />

            <div className="mt-7 grid gap-3">
              <button
                data-testid="replay-button"
                className="game-button bg-emerald-500 text-xl text-white shadow-lg shadow-emerald-700/20"
                onClick={handleReplay}
              >
                再玩一次
              </button>
              <button data-testid="home-button" className="game-button bg-lime-100 text-lg text-emerald-800" onClick={handleGoHome}>
                返回首页
              </button>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f6ffe7] px-5 py-7 text-center text-emerald-950">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_14%,rgba(250,204,21,0.42),transparent_23%),radial-gradient(circle_at_86%_16%,rgba(52,211,153,0.35),transparent_22%),linear-gradient(180deg,#dcfce7_0%,#fef9c3_62%,#fdba74_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-emerald-500/25 to-transparent" />

      <section className="relative mx-auto flex min-h-[calc(100dvh-3.5rem)] max-w-xl flex-col items-center justify-center">
        <div className="w-full rounded-[8px] border border-white/80 bg-white/84 p-6 shadow-soft backdrop-blur sm:p-8">
          <img src="/assets/logo.png" alt="" draggable={false} className="mx-auto h-28 w-28 object-contain drop-shadow-lg" />
          <h1 className="mt-3 text-4xl font-black leading-tight sm:text-5xl">西瓜忍者</h1>
          <p className="mt-2 text-2xl font-black text-orange-500">60秒挑战</p>
          <p className="mt-4 text-lg font-bold text-emerald-700">滑动切水果，避开炸弹！</p>

          <div className="mt-6 grid gap-3 text-left text-sm font-bold leading-6 text-emerald-900">
            <div className="rounded-[8px] bg-emerald-50 p-4 shadow-inner">
              <p>西瓜 +{FRUIT_SCORE_MAP.watermelon}，苹果 +{FRUIT_SCORE_MAP.apple}，香蕉 +{FRUIT_SCORE_MAP.banana}，凤梨 +{FRUIT_SCORE_MAP.pineapple}。</p>
              <p>连切 2 个水果额外 +{COMBO_BONUS.twoFruits}，连切 3 个以上额外 +{COMBO_BONUS.threeOrMoreFruits}。</p>
              <p>炸弹 {FRUIT_SCORE_MAP.bomb} 分，不计入 Combo。</p>
              <p>漏掉水果不扣分，分数不会低于 0。</p>
            </div>
          </div>

          <div className="mt-5 rounded-[8px] bg-yellow-50 px-4 py-3 text-lg font-black text-orange-600 shadow-inner">
            最高分：<span data-testid="home-best-score">{bestScore}</span>
          </div>

          <div className="mt-4">
            <SoundToggle enabled={soundEnabled} onToggle={handleSoundToggle} />
          </div>

          <button
            data-testid="start-button"
            className="game-button mt-6 w-full bg-emerald-500 text-2xl text-white shadow-lg shadow-emerald-700/20"
            onClick={handleStartGame}
          >
            开始游戏
          </button>
        </div>
      </section>
    </main>
  );
}
