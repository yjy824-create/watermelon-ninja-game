'use client';

import { useState } from 'react';
import { PlayerRank } from '@/lib/rank';
import { generateShareImage } from '@/lib/shareImage';
import { playSound } from '@/lib/sound';

interface ShareCardProps {
  score: number;
  bestScore: number;
  rank: PlayerRank;
  soundEnabled: boolean;
}

export default function ShareCard({ score, bestScore, rank, soundEnabled }: ShareCardProps) {
  const [imageUrl, setImageUrl] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');

  async function handleGenerate() {
    playSound('click', soundEnabled);
    setIsGenerating(true);
    setError('');

    try {
      const nextImageUrl = await generateShareImage({ score, bestScore, rank });
      setImageUrl(nextImageUrl);
    } catch {
      setError('分享图生成失败，请再试一次。');
    } finally {
      setIsGenerating(false);
    }
  }

  function handleDownload() {
    playSound('click', soundEnabled);
    if (!imageUrl) return;

    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = 'watermelon-ninja-score.png';
    link.click();
  }

  return (
    <section className="mt-5 rounded-[8px] bg-emerald-50/85 p-4 text-center shadow-inner">
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          data-testid="generate-share-button"
          type="button"
          className="game-button bg-orange-500 text-white shadow-lg shadow-orange-700/20"
          onClick={handleGenerate}
          disabled={isGenerating}
        >
          {isGenerating ? '生成中...' : '生成分享图'}
        </button>
        <button
          data-testid="download-share-button"
          type="button"
          className="game-button bg-yellow-300 text-emerald-950 shadow-lg shadow-yellow-700/10 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={handleDownload}
          disabled={!imageUrl}
        >
          下载分享图
        </button>
      </div>

      {error && <p className="mt-3 text-sm font-bold text-red-600">{error}</p>}

      {imageUrl && (
        <div className="mt-4">
          <img
            data-testid="share-preview"
            src={imageUrl}
            alt="分享成绩预览"
            className="mx-auto max-h-[48dvh] w-auto max-w-full rounded-[8px] border border-white bg-white object-contain shadow-soft"
          />
        </div>
      )}
    </section>
  );
}
