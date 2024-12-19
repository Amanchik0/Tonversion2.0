// services/walletService.ts
import { TonClient, Address, fromNano, WalletContractV4, SendMode } from '@ton/ton';
import { mnemonicToPrivateKey } from 'ton-crypto';
import { Cell } from '@ton/core'; // Если понадобится пустой Cell для body/stateInit

interface TransactionInfo {
  hash: string;
  timestamp: number;
  amount: string;
  sender: string;
  recipient: string;
  fees: string;
}

// НЕ определяем свой MessageRelaxed, используем из библиотеки
// import { MessageRelaxed } from '@ton/ton'; // Если понадобится, но обычно не нужно
type Wallet4Message = {
  to: Address;
  value: bigint;
  stateInit?: Cell;
  body?: Cell;
  sendMode?: SendMode;

};

interface ExtendedMessage {
  info: {
    value: {
      coins: bigint;
    };
    src: Address;
    dest: Address;
  };
}

interface ExtendedTransaction {
  hash: () => Buffer;
  description: {
    type: string;
    time: number;
  };
  inMessage?: ExtendedMessage;
  totalFees: {
    coins: bigint;
  };
}

export class WalletService {
  private client: TonClient;
  private walletContract: WalletContractV4 | null = null;
  private readonly projectAddress: Address;
  private keyPair: { publicKey: Uint8Array; secretKey: Uint8Array } | null = null;

  constructor() {
    if (!process.env.PROJECT_WALLET_ADDRESS) {
      throw new Error('PROJECT_WALLET_ADDRESS is not configured');
    }
    this.projectAddress = Address.parse(process.env.PROJECT_WALLET_ADDRESS);
    this.client = new TonClient({
      endpoint: 'https://testnet.toncenter.com/api/v2/jsonRPC',
      apiKey: process.env.TON_API_KEY || '',
      timeout: 30000
    });
  }

  async verifyIncomingTransaction(
    transactionHash: string,
    expectedAmount: string,
    senderAddress: string
  ): Promise<boolean> {
    try {
      const parsedSenderAddress = Address.parse(senderAddress);
      const transactions = await this.client.getTransactions(this.projectAddress, { limit: 20 });

      const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 600;

      return transactions.some(tx => {
        const transaction = tx as unknown as ExtendedTransaction;
        const inMessageValue = transaction.inMessage?.info?.value?.coins;
        const sender = transaction.inMessage?.info?.src;

        if (!inMessageValue || !sender) return false;

        const isAmountMatch = fromNano(inMessageValue) === expectedAmount;
        const isSenderMatch = sender.toString() === parsedSenderAddress.toString();
        const isRecent = transaction.description.time > fiveMinutesAgo;

        return isAmountMatch && isSenderMatch && isRecent;
      });
    } catch (error) {
      console.error('Transaction verification error:', error);
      return false;
    }
  }

  async getProjectTransactions(limit: number = 10): Promise<TransactionInfo[]> {
    try {
      const transactions = await this.client.getTransactions(this.projectAddress, { limit });

      return transactions.map(tx => {
        const transaction = tx as unknown as ExtendedTransaction;
        return {
          hash: transaction.hash().toString('hex'),
          timestamp: transaction.description.time,
          amount: transaction.inMessage?.info?.value?.coins ?
            fromNano(transaction.inMessage.info.value.coins) : '0',
          sender: transaction.inMessage?.info?.src?.toString() || 'unknown',
          recipient: transaction.inMessage?.info?.dest?.toString() || 'unknown',
          fees: transaction.totalFees?.coins ? fromNano(transaction.totalFees.coins) : '0'
        };
      });
    } catch (error) {
      console.error('Failed to get project transactions:', error);
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

  async initializeWallet(): Promise<void> {
    if (!process.env.MNEMONIC_WORDS) {
      throw new Error('MNEMONIC_WORDS is not configured');
    }

    const mnemonic = process.env.MNEMONIC_WORDS.split(' ');
    const keyPair = await mnemonicToPrivateKey(mnemonic);
    this.keyPair = keyPair;

    this.walletContract = WalletContractV4.create({
      publicKey: keyPair.publicKey,
      workchain: 0
    });
  }

  async sendRefund(toAddress: string, amount: string): Promise<boolean> {
    try {
      if (!this.walletContract) {
        await this.initializeWallet();
      }
  
      if (!this.keyPair) {
        throw new Error('Key pair not initialized');
      }
  
      const openedWallet = this.client.open(this.walletContract!);
      const nanoAmount = BigInt(Math.floor(parseFloat(amount) * 1_000_000_000));
      const seqno = await openedWallet.getSeqno();
  
      const messages: Wallet4Message[] = [{
        to: Address.parse(toAddress),
        value: nanoAmount
      }];
  
      await openedWallet.sendTransfer({
        secretKey: Buffer.from(this.keyPair.secretKey),
        seqno,
        sendMode: SendMode.PAY_GAS_SEPARATELY,
        messages: [{
          info: {
            type: 'internal',
            dest: Address.parse(toAddress),
            value: { coins: nanoAmount },
            ihrDisabled: true,
            bounce: false,
            bounced: false,
            ihrFee: nanoAmount,
            forwardFee: nanoAmount,
            createdLt: nanoAmount,
            createdAt: 0
          },
          // body и stateInit не обязательно указывать
          body: new Cell() // добавляем пустой Cell, чтобы удовлетворить обязательное поле

        }]
      });
      
      
      
      console.log(`Refund of ${amount} TON sent to ${toAddress}`);
      return true;
    } catch (error) {
      console.error('Failed to send refund:', error);
      return false;
    }
  
}
}