// import { TonClient, fromNano, toNano, Cell, beginCell } from '@ton/ton';
// import { WalletContractV4 } from '@ton/ton-wallets'; // Если используете версию с отдельным пакетом для кошельков
// import { mnemonicToPrivateKey } from 'ton-crypto';
// import * as fs from 'fs';

// async function deploy() {
//   try {
//     // Создаем TonClient для взаимодействия с сетью
//     const client = new TonClient({
//       endpoint: 'https://testnet.toncenter.com/api/v2/jsonRPC',
//       apiKey: process.env.TON_API_KEY,
//     });

//     // Получаем ключи из мнемоника
//     const keyPair = await mnemonicToPrivateKey(process.env.DEPLOYER_MNEMONIC!.split(' '));

//     console.log('Public Key:', keyPair.publicKey.toString('hex'));

//     // Создаем кошелек (WalletContractV4 использует ContractProvider)
//     const wallet = await WalletContractV4.create({
//       publicKey: keyPair.publicKey,
//       workchain: 0,
//     });

//     console.log('Wallet address:', wallet.address.toString());

//     // Проверяем баланс кошелька
//     const balance = await client.getBalance(wallet.address);
//     console.log('Wallet balance:', fromNano(balance));

//     // Загружаем код контракта из файла (например, purchase.cell)
//     const contractCode = Cell.fromBoc(fs.readFileSync('./contracts/purchase.cell'))[0];
//     console.log('Contract code loaded');

//     // Создаем начальные данные контракта
//     const initialData = beginCell()
//       .storeAddress(wallet.address)  // Сохраняем адрес кошелька
//       .storeDict(null)  // Пустой словарь для покупок
//       .endCell();

//     // Формируем сообщение для деплоя контракта
//     const deployMessage = {
//       code: contractCode,      // Загруженный код контракта
//       data: initialData,       // Данные для контракта (например, пустой словарь)
//       value: toNano('0.1'),    // Сумма для деплоя контракта
//     };

//     // Получаем seqno для транзакции
//     const seqno = await wallet.getSeqno();  // Получаем seqno из кошелька
//     console.log('Seqno:', seqno);

//     // Формируем параметры для транзакции
//     const transferParams = {
//       secretKey: keyPair.secretKey,  // Секретный ключ для подписания транзакции
//       seqno: seqno, // Номер последовательности
//       messages: [
//         {
//           init: deployMessage,  // Инициализация контракта
//           body: new Cell(),     // Пустое тело сообщения
//           bounce: false,        // Не отскакиваем (не возобновляем)
//         },
//       ],
//     };

//     // Отправляем транзакцию с помощью sendTransfer
//     const result = await wallet.sendTransfer(transferParams);
//     console.log('Deployment transaction sent', result);

//   } catch (error) {
//     console.error('Deploy error:', error);
//   }
// }

// deploy().catch(console.error);
