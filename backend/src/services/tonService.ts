// src/services/tonService.ts
import { TonClient, Address } from '@ton/ton';
import { ContractData } from '../types';

interface MessageInfo {
    value: {
        coins: bigint;
    };
    src?: Address;
    dest?: Address;
}

interface ExtendedMessage {
    info: MessageInfo;
}

interface ExtendedTransaction {
    inMessage?: ExtendedMessage;
    hash: string;
}

export class TonService {
    private client: TonClient;
    private contractAddress: Address;
    private price: string;

    constructor(contractData: ContractData) {
        if (!contractData.address || contractData.address.trim() === '') {
            throw new Error('Contract address is not configured');
        }

        this.contractAddress = Address.parse(contractData.address);
        this.price = contractData.price;
        
        this.client = new TonClient({
            endpoint: 'https://testnet.toncenter.com/api/v2/jsonRPC',
            apiKey: process.env.TON_API_KEY || ''
        });
    }

    async verifyPurchase(transactionHash: string, amount: string): Promise<boolean> {



        try {
            console.log('Verifying purchase:', { transactionHash, amount });
            
            const transactions = await this.client.getTransactions(
                this.contractAddress,
                {
                    limit: 1,
                    hash: transactionHash
                }
            );

            if (transactions.length === 0) {
                console.log('No transaction found with hash:', transactionHash);
                return false;
            }

            const tx = transactions[0] as unknown as ExtendedTransaction;
            if (!tx.inMessage?.info?.value?.coins) {
                console.log('Transaction has no input value');
                return false;
            }

            const txAmount = tx.inMessage.info.value.coins.toString();
            console.log('Transaction amount:', txAmount, 'Expected:', amount);

            return txAmount === amount;
        } catch (error) {
            console.error('Purchase verification error:', error);
            return false;
        }
    }

    async getContractStatus(): Promise<boolean> {
        try {
            const balance = await this.client.getBalance(this.contractAddress);
            return balance > BigInt(0);
        } catch (error) {
            console.error('Contract status check error:', error);
            return false;
        }
    }
}