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
import TransactionsViewer from './TransactionsViewer';
import ProjectTransactions from './ProjectTransations';
import { Address } from '@ton/core';

const courses = [
  {
    id: 1,
    title: 'Основы TON',
    description: 'Базовый курс по блокчейну TON',
    price: 0.01
  },
  {
    id: 2,
    title: 'Смарт-контракты TON',
    description: 'Разработка смарт-контрактов для TON',
    price: 0.0000001
  }
];

// Адрес проекта для тестнета
const PROJECT_WALLET = "0QDXQV-nSC_PQDgw4SPIbhJhB0i9Qjun4SVV0LZQ46njk02I";
// const PROJECT_WALLET = "UQDetz09xwcYGqStovaF2Awqarcel2IORninjvQ3ua9TQalG"

interface TransactionResponse {
  boc: string;
  confirmed: boolean;
  validUntil: number;
}
function WalletConnection() {
  const [tonConnectUI] = useTonConnectUI();
  const userAddress = useTonAddress();
  const [logs, setLogs] = useState<string[]>([]);
  const [paidCourses, setPaidCourses] = useState<{ [key: number]: string }>({});

  const addLog = (message: string) => {
    console.log(message); // Дублируем в консоль
    setLogs(prev => [...prev, `${new Date().toISOString()}: ${message}`]);
  };

  useEffect(() => {
    try {
      telegram.MainButton.setText('Подключить кошелек');
      telegram.MainButton.show();
      
      if (telegram.user) {
        addLog(`Пользователь: ${telegram.user.username || 'неизвестен'}`);
      }
    } catch (e) {
      addLog('Ошибка инициализации Telegram WebApp');
    }
  }, []);

  useEffect(() => {
    if (userAddress) {
      addLog(`Подключен кошелек: ${userAddress}`);
      telegram.MainButton.setText('Кошелек подключен');
      telegram.MainButton.disable();
    } else {
      telegram.MainButton.setText('Подключить кошелек');
      telegram.MainButton.enable();
    }
  }, [userAddress]);




  const waitForTransactionConfirmation = async (recipient: string, sender: string, amount: string): Promise<any> => {
    const maxRetries = 10; // Максимальное число попыток
    const delay = 3000; // Задержка между попытками
  
    const apiKey = process.env.NEXT_PUBLIC_TON_API_KEY || '';
  
    for (let i = 0; i < maxRetries; i++) {
      // Формируем URL с query-параметрами
      const url = `https://testnet.toncenter.com/api/v2/getTransactions?address=${recipient}&limit=10`;
  
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-API-KEY': apiKey
        },
      });
  
      if (!response.ok) {
        console.error('Ошибка при получении транзакций:', response.statusText);
        await new Promise(res => setTimeout(res, delay));
        continue;
      }
  
      const data = await response.json();
      // Поиск транзакции по критериям
      const transaction = data.result.find((tx: any) => {
        return (
          tx.in_msg.source === sender &&
          tx.in_msg.destination === recipient &&
          parseFloat(tx.in_msg.value) === parseFloat(amount)
        );
      });
  
      if (transaction) {
        return transaction;
      }
  
      await new Promise(res => setTimeout(res, delay));
    }
  
    return null;
  };
  

function convertToRawAddress(base64Address: string): string {
  try {
      const address = Address.parse(base64Address);
      return address.toString(); // Возвращает адрес в формате Hex
  } catch (error) {
      console.error('Ошибка преобразования адреса:', error);
      return '';
  }
}

const handlePurchase = async (courseId: number, price: number) => {
  if (!userAddress) {
      telegram.showAlert('Пожалуйста, подключите кошелек');
      return;
  }

  try {
      addLog(`Начало покупки курса ${courseId} за ${price} TON`);
      const amount = price * 1_000_000_000; // Сумма в нанотонах
      const rawSender = convertToRawAddress(userAddress);
      const rawRecipient = convertToRawAddress(PROJECT_WALLET);

      addLog(`Адрес отправителя (Hex): ${rawSender}`);
      addLog(`Адрес получателя (Hex): ${rawRecipient}`);

      // Отправляем транзакцию
      const result = await tonConnectUI.sendTransaction({
          validUntil: Math.floor(Date.now() / 1000) + 60 * 20,
          messages: [
              {
                  address: PROJECT_WALLET,
                  amount: amount.toString(),
              },
          ],
      }) as TransactionResponse;

      addLog(`Транзакция отправлена, BOC: ${result.boc}`);

      // Ожидаем подтверждения транзакции
      addLog('Ожидаем подтверждения транзакции...');
      const transaction = await waitForTransactionConfirmation(rawRecipient, rawSender, amount.toString());

      if (!transaction) {
          addLog('Не удалось найти подтверждённую транзакцию');
          telegram.showAlert('Ошибка обработки транзакции. Попробуйте позже.');
          return;
      }

      // Здесь мы можем вывести хэш транзакции
      addLog(`Подтверждённая транзакция найдена!`);
      addLog(`Хэш транзакции: ${transaction.transaction_id.hash}`);
      addLog(`Подробности транзакции: ${JSON.stringify(transaction)}`);

      // Отправляем данные на сервер для верификации
      const verifyResponse = await fetch('http://localhost:3001/api/wallet/verify-purchase', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
              transactionHash: transaction.transaction_id.hash,
              userWallet: userAddress,
              amount: price,
              telegramId: telegram.initDataUnsafe?.user?.id,
          }),
      });

      const verifyData = await verifyResponse.json();
      addLog(`Ответ от сервера верификации: ${JSON.stringify(verifyData)}`);

      if (verifyData.success) {
          setPaidCourses(prev => ({
              ...prev,
              [courseId]: transaction.transaction_id.hash,
          }));
          telegram.showAlert('Оплата прошла успешно! Нажмите "Завершить" для получения возврата.');
      } else {
          addLog(`Ошибка проверки: ${verifyData.error}`);
          telegram.showAlert('Ошибка при проверке платежа');
      }
  } catch (error: unknown) {
      const err = error as Error;
      addLog(`Ошибка при отправке транзакции: ${err.message}`);
      telegram.showAlert('Ошибка при обработке платежа');
  }
};








  const handleComplete = async (courseId: number) => {
    if (!userAddress) {
      telegram.showAlert('Пожалуйста, подключите кошелек');
      return;
    }

    const transactionHash = paidCourses[courseId];
    if (!transactionHash) {
      telegram.showAlert('Транзакция не найдена');
      return;
    }

    try {
      addLog(`Запрос возврата для курса ${courseId}`);
      
      const response = await fetch('http://localhost:3001/api/wallet/process-refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionHash,
          userWallet: userAddress,
          courseId,
          telegramId: telegram.initDataUnsafe?.user?.id,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Удаляем курс из оплаченных
        setPaidCourses(prev => {
          const newState = { ...prev };
          delete newState[courseId];
          return newState;
        });
        addLog(`Возврат выполнен успешно для курса ${courseId}`);
        telegram.showAlert('Возврат средств выполнен успешно!');
      } else {
        addLog(`Ошибка возврата: ${data.error}`);
        telegram.showAlert('Ошибка при возврате средств');
      }
    } catch (error: unknown) {
      const err = error as Error;
      addLog(`Ошибка возврата: ${err.message}`);
      telegram.showAlert('Ошибка при обработке возврата');
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
            isPaid={Boolean(paidCourses[course.id])}
            onBuy={() => handlePurchase(course.id, course.price)}
            onComplete={() => handleComplete(course.id)}
          />
        ))}
      </div>
      
      {userAddress && <WalletStatus address={userAddress} />
      }
              <ProjectTransactions />

      {userAddress && (
  <TransactionsViewer 
    projectAddress={process.env.NEXT_PUBLIC_PROJECT_WALLET || ''}
    userAddress={userAddress}
  />
)}
      <div className="mt-8 w-full max-w-2xl p-4 bg-gray-100 rounded-lg">
        <h2 className="font-bold mb-2">Логи:</h2>
        <pre className="text-sm whitespace-pre-wrap">
          {logs.join('\n')}
        </pre>
      </div>
    </div>
  );
}

export default function TonConnect() {
  return (
    <TonConnectUIProvider manifestUrl="https://ec-raleigh-willow-cent.trycloudflare.com/tonconnect-manifest.json">
      <WalletConnection />
    </TonConnectUIProvider>
  );
}