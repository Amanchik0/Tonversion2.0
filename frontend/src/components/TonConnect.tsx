//frontend\src\components\TonConnect.tsx
'use client';

import { TonConnectButton, TonConnectUIProvider, useTonAddress } from '@tonconnect/ui-react';
import { useEffect } from 'react';
import { telegram } from '@/utils/telegram';
import { CourseCard } from './CourseCard';

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
            onBuy={() => {
              if (!userAddress) {
                telegram.showAlert('Пожалуйста, подключите кошелек');
                return;
              }
              telegram.showConfirm(`Купить курс за ${course.price} TON?`);
            }}
          />
        ))}
      </div>

      {userAddress && (
        <p className="mt-4 text-sm text-gray-600">
          Ваш адрес: {userAddress.slice(0, 6)}...{userAddress.slice(-4)}
        </p>
      )}
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