// src/services/tonService.ts
import { TonClient, Address, Message, Dictionary, ContractProvider } from 'ton';
import { ContractData } from '../types';

interface ExtendedMessage extends Message {
  value: bigint;
  source?: Address;
  destination?: Address;
}

interface ExtendedTransaction {
  inMessage?: ExtendedMessage;
  outMessages: Dictionary<number, ExtendedMessage>;
  hash: string;
}

interface ContractState {
  balance: bigint;
  isDeployed: boolean;
}

export class TonService {
  private client: TonClient;
  private contractAddress: string;

  constructor(contractData: ContractData) {
    this.client = new TonClient({
      endpoint: 'https://toncenter.com/api/v2/jsonRPC',
      apiKey: process.env.TON_API_KEY
    });
    this.contractAddress = contractData.address;
  }

// Мы получаем hash транзакции и проверяем:
async verifyPurchase(transactionHash: string, amount: string): Promise<boolean> {
  try {
    const transactions = await this.client.getTransactions(
      Address.parse(this.contractAddress), 
      {
        limit: 1,
        hash: transactionHash
      }
    );

    if (transactions.length === 0) {
      return false;
    }

    const tx = transactions[0] as unknown as ExtendedTransaction;
    
    if (!tx.inMessage?.value) {
      return false;
    }

    // Здесь нужно добавить проверки:
    // 1. Правильный адрес отправителя
    // 2. Правильный адрес получателя (наш кошелек)
    
    return tx.inMessage.value.toString() === amount;
    
  } catch (error) {
    console.error('Verify purchase error:', error);
    return false;
  }
}

  async getContractStatus(): Promise<boolean> {
    try {
      const balance = await this.client.getBalance(
        Address.parse(this.contractAddress)
      );
      return balance > BigInt(0);
    } catch (error) {
      console.error('Get contract status error:', error);
      return false;
    }
  }

  private async getContractState(): Promise<ContractState> {
    const address = Address.parse(this.contractAddress);
    const balance = await this.client.getBalance(address);
    const isDeployed = await this.client.isContractDeployed(address);
    
    return {
      balance,
      isDeployed
    };
  }
}