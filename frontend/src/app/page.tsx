//frontend\src\app\page.tsx
'use client';

import dynamic from 'next/dynamic';
import { useEffect } from 'react';

const TonConnect = dynamic(() => import('../components/TonConnect'), {
  ssr: false,
});

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center p-4">
      <TonConnect />
    </main>
  );
}