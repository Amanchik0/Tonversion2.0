// src/services/walletService.ts
import { TonClient, Address, fromNano, toNano, WalletContractV4, Message, Dictionary } from '@ton/ton';
import { mnemonicToPrivateKey } from 'ton-crypto';

// Расширяем тип Message теми полями, которые нам нужны
interface ExtendedMessage extends Message {
  value: bigint;
  source?: Address;
  destination?: Address;
}

// Расширяем тип Transaction
interface ExtendedTransaction {
  hash: string;
  lt: string;
  utime: number;
  inMessage?: ExtendedMessage;
  outMessages: Dictionary<number, ExtendedMessage>;
  exitStatus?: number;
}

export class WalletService {
  private client: TonClient;
  private walletContract: WalletContractV4 | null = null;

  constructor() {
    this.client = new TonClient({
      endpoint: 'https://toncenter.com/api/v2/jsonRPC',
      apiKey: process.env.TON_API_KEY
    });
  }

  async initProjectWallet() {
    try {
      if (!process.env.WALLET_MNEMONIC) {
        throw new Error('Wallet mnemonic not found in environment variables');
      }

      const mnemonic = process.env.WALLET_MNEMONIC.split(' ');
      const keyPair = await mnemonicToPrivateKey(mnemonic);
      
      // Здесь нужно инициализировать WalletContractV4
      // Код зависит от типа используемого кошелька
      
      console.log('Project wallet initialized');
    } catch (error) {
      console.error('Failed to initialize project wallet:', error);
      throw error;
    }
  }

  async getBalance(address: string): Promise<string> {
    try {
      const balance = await this.client.getBalance(Address.parse(address));
      return fromNano(balance);
    } catch (error) {
      console.error('Failed to get balance:', error);
      throw error;
    }
  }

  async verifyIncomingTransaction(
    transactionHash: string,
    expectedAmount: string,
    senderAddress: string
  ): Promise<boolean> {
    try {
      const transactions = await this.client.getTransactions(
        Address.parse(process.env.PROJECT_WALLET_ADDRESS || ''),
        {
          limit: 1,
          hash: transactionHash
        }
      );

      const tx = transactions[0] as unknown as ExtendedTransaction;

      if (!tx || !tx.inMessage?.value) {
        return false;
      }

      return (
        tx.inMessage.value.toString() === toNano(expectedAmount).toString() &&
        tx.inMessage.source?.toString() === senderAddress
      );
    } catch (error) {
      console.error('Failed to verify transaction:', error);
      return false;
    }
  }

  async getTransactionHistory(
    address: string,
    limit: number = 10
  ): Promise<any[]> {
    try {
      const transactions = await this.client.getTransactions(
        Address.parse(address),
        { limit }
      );

      return (transactions as unknown as ExtendedTransaction[]).map(tx => ({
        hash: tx.hash,
        time: tx.utime,
        value: tx.inMessage?.value ? fromNano(tx.inMessage.value) : '0',
        from: tx.inMessage?.source?.toString(),
        to: tx.outMessages.get(0)?.destination?.toString()
      }));
    } catch (error) {
      console.error('Failed to get transaction history:', error);
      return [];
    }
  }

  async checkTransactionStatus(hash: string): Promise<'completed' | 'pending' | 'failed'> {
    try {
      const tx = await this.client.getTransactions(
        Address.parse(process.env.PROJECT_WALLET_ADDRESS || ''),
        { limit: 1, hash }
      );

      if (!tx || tx.length === 0) {
        return 'pending';
      }

      const transaction = tx[0] as unknown as ExtendedTransaction;
      return transaction.exitStatus === 0 ? 'completed' : 'failed';
    } catch (error) {
      console.error('Failed to check transaction status:', error);
      return 'failed';
    }
  }

  async sendRefund(toAddress: string, amount: string): Promise<boolean> {
    try {
      if (!this.walletContract) {
        throw new Error('Wallet contract not initialized');
      }

      // Здесь будет логика отправки транзакции через WalletContractV4
      // Это зависит от конкретной реализации кошелька

      return true;
    } catch (error) {
      console.error('Failed to send refund:', error);
      return false;
    }
  }
}