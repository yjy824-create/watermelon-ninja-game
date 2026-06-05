import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '西瓜忍者｜60秒挑战',
  description: '滑动切水果，避开炸弹的手机网页小游戏。'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hans">
      <body>{children}</body>
    </html>
  );
}
