// src/components/TonConnect.tsx
'use client';

import { 
  TonConnectButton, 
  useTonAddress, 
  useTonConnectUI,
  TonConnectUIProvider 
} from '@tonconnect/ui-react';
import { useEffect, useState } from 'react';
import { telegram } from '../utils/telegram';
import { CourseCard } from './CourseCard';
import { WalletStatus } from './WalletStatus';

const courses = [
  {
    id: 1,
    title: 'Основы TON',
    description: 'Базовый курс по блокчейну TON',
    price: 10
  },
  {
    id: 2,
    title: 'Смарт-контракты TON',
    description: 'Разработка смарт-контрактов для TON',
    price: 20
  }
];

function WalletConnection() {
  const [tonConnectUI] = useTonConnectUI();
  const userAddress = useTonAddress();

  useEffect(() => {
    try {
      telegram.MainButton.setText('Подключить кошелек');
      telegram.MainButton.show();
      
      if (telegram.user) {
        telegram.showAlert(`Привет, ${telegram.user.username || 'пользователь'}!`);
      }
    } catch (e) {
      console.log('Telegram WebApp not initialized');
    }
  }, []);

  useEffect(() => {
    if (userAddress) {
      telegram.MainButton.setText('Кошелек подключен');
      telegram.MainButton.disable();
    } else {
      telegram.MainButton.setText('Подключить кошелек');
      telegram.MainButton.enable();
    }
  }, [userAddress]);

  const handlePurchase = async (courseId: number, price: number) => {
    if (!userAddress) {
      telegram.showAlert('Пожалуйста, подключите кошелек');
      return;
    }
  
    try {
      // Отправляем транзакцию через TonConnect
      const result = await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 60 * 20, // 20 минут
        messages: [
          {
            address: process.env.NEXT_PUBLIC_PROJECT_WALLET || '',
            amount: (price * 1000000000).toString(), // конвертируем в наноTON и в строку
          },
        ],
      });
  
      // Проверяем транзакцию на бэкенде
      const verifyResponse = await fetch('/api/wallet/verify-purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionHash: result.boc,
          userWallet: userAddress,
          amount: price,
          telegramId: telegram.initDataUnsafe?.user?.id,
        }),
      });
  
      const verifyData = await verifyResponse.json();
  
      if (verifyData.success) {
        telegram.showAlert('Покупка успешно совершена!');
      } else {
        telegram.showAlert('Ошибка при проверке платежа');
      }
    } catch (error) {
      console.error('Purchase error:', error);
      telegram.showAlert('Ошибка при совершении покупки');
    }
  };

  return (
    <div className="flex flex-col items-center w-full">
      <div className="mb-4">
        <TonConnectButton />
      </div>

      <h1 className="text-2xl font-bold mb-8">Доступные курсы</h1>

      <div className="w-full max-w-2xl">
        {courses.map(course => (
          <CourseCard
            key={course.id}
            title={course.title}
            description={course.description}
            price={course.price}
            onBuy={() => handlePurchase(course.id, course.price)}
          />
        ))}
      </div>

      {userAddress && <WalletStatus address={userAddress} />}
    </div>
  );
}

export default function TonConnect() {
  return (
    <TonConnectUIProvider manifestUrl="https://elder-illustration-audit-drum.trycloudflare.com/tonconnect-manifest.json">
      <WalletConnection />
    </TonConnectUIProvider>
  );
}