// src/components/WalletStatus.tsx
import React from 'react';

export function WalletStatus({ address, balance }: { address?: string; balance?: string }) {
  if (!address) return null;
  
  return (
    <div className="p-4 border rounded-lg">
      <h3 className="text-lg font-bold">Кошелек</h3>
      <p>Адрес: {address.slice(0, 6)}...{address.slice(-4)}</p>
      {balance && <p>Баланс: {balance} TON</p>}
    </div>
  );
}