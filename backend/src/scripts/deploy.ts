// src/scripts/deploy.ts
import { 
    TonClient, 
    WalletContractV4,
    WalletContractV3R2,
    internal, 
    Contract, 
    Cell,
    beginCell,
    Address,
    toNano
} from '@ton/ton';
import { mnemonicToPrivateKey } from 'ton-crypto';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

class PurchaseContract implements Contract {
    constructor(
        readonly address: Address,
        readonly init?: { code: Cell; data: Cell }
    ) {}
}

function createContractCode(): Cell {
    return beginCell()
        .storeUint(0, 32) // version
        .storeUint(0, 64) // timestamp
        .storeRef(
            beginCell()
                .storeUint(1, 32) // op code for purchase
                .endCell()
        )
        .endCell();
}

function createContractData(ownerAddress: Address): Cell {
    return beginCell()
        .storeCoins(toNano('10')) // price in TON
        .storeAddress(ownerAddress) // owner address
        .storeUint(0, 1) // state
        .endCell();
}

async function deploy() {
    try {
        const apiKey = process.env.TON_API_KEY?.trim();
        const mnemonic = process.env.MNEMONIC_WORDS?.trim().replace(/'/g, '').split(' ');

        if (!apiKey || !mnemonic) {
            throw new Error('Missing API key or mnemonic words');
        }

        console.log('Initializing deployment...');
        
        const client = new TonClient({
            endpoint: 'https://testnet.toncenter.com/api/v2/jsonRPC',
            apiKey: apiKey
        });

        console.log('Generating keys from mnemonic...');
        const keyPair = await mnemonicToPrivateKey(mnemonic);
        
        // Создаем кошельки разных версий
        const walletV4 = WalletContractV4.create({
            publicKey: keyPair.publicKey,
            workchain: 0
        });
        
        const walletV3R2 = WalletContractV3R2.create({
            publicKey: keyPair.publicKey,
            workchain: 0
        });

        console.log('Wallet V4 address:', walletV4.address.toString());
        console.log('Wallet V3R2 address:', walletV3R2.address.toString());
        
        // Проверяем балансы
        const balanceV4 = await client.getBalance(walletV4.address);
        const balanceV3R2 = await client.getBalance(walletV3R2.address);
        
        console.log('V4 Wallet balance:', balanceV4.toString());
        console.log('V3R2 Wallet balance:', balanceV3R2.toString());

        // Выбираем кошелек с балансом
        const wallet = balanceV4 > 0 ? walletV4 : balanceV3R2 > 0 ? walletV3R2 : walletV4;
        const balance = balanceV4 > 0 ? balanceV4 : balanceV3R2;

        console.log('Selected wallet address:', wallet.address.toString());
        console.log('Selected wallet balance:', balance.toString());

        if (balance < toNano('0.5')) {
            throw new Error('Insufficient balance for deployment (need at least 0.5 TON)');
        }

        console.log('Creating contract...');
        const contractCode = createContractCode();
        const contractData = createContractData(wallet.address);

        const contract = new PurchaseContract(
            wallet.address,
            {
                code: contractCode,
                data: contractData
            }
        );

        const walletContract = client.open(wallet);
        
        console.log('Deploying contract...');
        const seqno = await walletContract.getSeqno();
        
        await walletContract.sendTransfer({
            seqno,
            secretKey: keyPair.secretKey,
            messages: [
                internal({
                    to: contract.address,
                    value: toNano('0.1'),
                    init: contract.init,
                    bounce: false,
                })
            ],
        });

        console.log('Waiting for deployment confirmation...');
        let attempts = 0;
        const maxAttempts = 10;
        
        while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            const isDeployed = await client.isContractDeployed(contract.address);
            
            if (isDeployed) {
                console.log('Contract deployed successfully!');
                console.log('Contract address:', contract.address.toString());

                const envPath = path.join(__dirname, '../../.env');
                let envContent = fs.readFileSync(envPath, 'utf8');
                const contractAddressLine = `CONTRACT_ADDRESS=${contract.address.toString()}\n`;
                
                if (envContent.includes('CONTRACT_ADDRESS=')) {
                    envContent = envContent.replace(/CONTRACT_ADDRESS=.*\n/, contractAddressLine);
                } else {
                    envContent += contractAddressLine;
                }
                
                fs.writeFileSync(envPath, envContent);
                console.log('Contract address saved to .env file');
                return contract.address.toString();
            }
            
            attempts++;
            console.log(`Waiting for deployment... Attempt ${attempts}/${maxAttempts}`);
        }

        throw new Error('Contract deployment timeout');

    } catch (error) {
        console.error('Deployment error:', error instanceof Error ? error.message : error);
        process.exit(1);
    }
}

// Запускаем деплой
deploy().then(() => {
    console.log('Deployment completed');
    process.exit(0);
}).catch(error => {
    console.error('Deployment failed:', error);
    process.exit(1);
});