'use client';

interface SoundToggleProps {
  enabled: boolean;
  compact?: boolean;
  onToggle: () => void;
}

export default function SoundToggle({ enabled, compact = false, onToggle }: SoundToggleProps) {
  return (
    <button
      data-testid="sound-toggle"
      type="button"
      aria-pressed={enabled}
      className={`game-button border border-white/70 bg-white/82 text-emerald-800 shadow-soft backdrop-blur ${
        compact ? 'min-h-0 px-3 py-2 text-sm' : 'text-base'
      }`}
      onClick={onToggle}
    >
      音效：{enabled ? '开' : '关'}
    </button>
  );
}
