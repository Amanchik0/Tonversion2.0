// scripts/deploy.ts
import { 
    TonClient, 
    WalletContractV4, 
    internal,
    Cell,
    beginCell,
    toNano 
} from "ton";
import { mnemonicToPrivateKey } from "ton-crypto";
import * as fs from 'fs';

async function deploy() {
    // Подключаемся к TON
    const client = new TonClient({
        endpoint: 'https://toncenter.com/api/v2/jsonRPC',
        apiKey: process.env.TON_API_KEY
    });

    // Загружаем код контракта
    const purchaseCode = Cell.fromBoc(fs.readFileSync('./contracts/purchase.cell'))[0];

    // Инициализируем кошелек деплоера
    const mnemonic = process.env.DEPLOYER_MNEMONIC!.split(' ');
    const keyPair = await mnemonicToPrivateKey(mnemonic);
    const wallet = WalletContractV4.create({ 
        workchain: 0,
        publicKey: keyPair.publicKey 
    });

    // Создаем данные для инициализации контракта
    const data = beginCell()
        .storeAddress(wallet.address) // owner address
        .storeDict(null) // empty purchases
        .endCell();

    // Создаем сообщение для деплоя
    const deployMessage = beginCell()
        .store(purchaseCode)
        .store(data)
        .endCell();

    // Отправляем транзакцию деплоя
    const seqno = await wallet.getSeqno();
    await wallet.sendTransfer({
        secretKey: keyPair.secretKey,
        seqno: seqno,
        messages: [
            internal({
                to: wallet.address,
                value: toNano('0.1'),
                init: {
                    code: purchaseCode,
                    data: data
                },
                body: deployMessage
            })
        ],
    });

    console.log('Contract deployed at:', wallet.address.toString());
}

deploy().catch(console.error);