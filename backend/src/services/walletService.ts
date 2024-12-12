import { TonClient, Address, fromNano, toNano, WalletContractV4, Message, Dictionary } from '@ton/ton';
import { mnemonicToPrivateKey } from 'ton-crypto';

interface ExtendedMessage extends Message {
  value: bigint;
  source?: Address;
  destination?: Address;
}

interface TransactionMessage {
  value: bigint;
  source?: Address;
  destination?: Address;
  hash?: () => Buffer;
}

interface ExtendedTransaction {
  hash: string;
  lt: string;
  utime: number;
  inMessage?: TransactionMessage;
  outMessages: Dictionary<number, TransactionMessage>;
  exitStatus?: number;
}

export class WalletService {
  private client: TonClient;
  private walletContract: WalletContractV4 | null = null;
  private retryDelay = 2000;
  private maxRetries = 5;

  constructor() {
    this.client = new TonClient({
      endpoint: 'https://testnet.toncenter.com/api/v2/jsonRPC',
      apiKey: process.env.TON_API_KEY || '',
      timeout: 30000
    });
  }

  // Правильная обработка base64 хеша
  private base64ToHex(base64: string): string {
    try {
      const cleanBase64 = base64.replace(/^te6ccg[A-Za-z0-9+/]*={0,3}/, '');
      return Buffer.from(base64, 'base64').toString('hex');
    } catch (error) {
      console.error('Error converting base64 to hex:', error);
      throw error;
    }
  }

  private async waitForTransaction(hash: string): Promise<ExtendedTransaction | null> {
    const projectAddress = process.env.PROJECT_WALLET_ADDRESS;
    if (!projectAddress) {
      throw new Error('Project wallet address not configured');
    }

    for (let i = 0; i < this.maxRetries; i++) {
      try {
        console.log(`Attempt ${i + 1} to find transaction...`);
        
        const transactions = await this.client.getTransactions(
          Address.parse(projectAddress),
          { limit: 20 }
        );

        const parsedTransactions = transactions as unknown as ExtendedTransaction[];
        for (const tx of parsedTransactions) {
          if (tx.hash && tx.hash.toLowerCase() === hash.toLowerCase()) {
            return tx;
          }
        }

        if (i < this.maxRetries - 1) {
          console.log(`Transaction not found, waiting ${this.retryDelay}ms...`);
          await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        }
      } catch (error: any) {
        console.error(`Error in attempt ${i + 1}:`, error.message);
        if (error.response?.status === 503) {
          console.log('TON Center temporarily unavailable, retrying...');
          await new Promise(resolve => setTimeout(resolve, this.retryDelay * 2));
        } else {
          throw error;
        }
      }
    }

    return null;
  }

  private async findTransaction(
    expectedAmount: string,
    senderAddress: string,
    startTime: number
  ): Promise<boolean> {
    try {
      console.log('Looking for transaction with params:', {
        expectedAmount,
        senderAddress,
        startTime
      });

      const transactions = await this.client.getTransactions(
        Address.parse(process.env.PROJECT_WALLET_ADDRESS!),
        { limit: 50 }
      );

      console.log(`Found ${transactions.length} recent transactions`);
      const parsedTransactions = transactions as unknown as ExtendedTransaction[];
      for (const tx of parsedTransactions) {
        // Пропускаем транзакции, которые старше времени начала проверки
        if (tx.utime < startTime) {
          continue;
        }

        if (!tx.inMessage?.value || !tx.inMessage?.source) {
          continue;
        }

        const txAmount = tx.inMessage.value.toString();
        const txSender = tx.inMessage.source.toString();

        console.log('Checking transaction:', {
          txAmount,
          txSender,
          txTime: tx.utime,
          expectedAmount,
          expectedSender: senderAddress
        });

        if (txAmount === expectedAmount && 
            txSender.toLowerCase() === senderAddress.toLowerCase()) {
          console.log('Found matching transaction!');
          return true;
        }
      }

      return false;
    } catch (error: any) {
      if (error.response?.status === 500) {
        // Если ошибка 500, просто логируем и продолжаем
        console.log('Got 500 error, will retry');
        return false;
      }
      throw error;
    }
  }

  async verifyIncomingTransaction(
    transactionHash: string,
    expectedAmount: string,
    senderAddress: string
  ): Promise<boolean> {
    try {
      const startTime = Math.floor(Date.now() / 1000) - 60; // Начинаем поиск с минуту назад
      const expectedNano = toNano(expectedAmount).toString();

      console.log('Starting transaction verification:', {
        hash: transactionHash,
        expectedNano,
        sender: senderAddress,
        startTime
      });

      // Делаем несколько попыток найти транзакцию
      for (let i = 0; i < this.maxRetries; i++) {
        console.log(`Verification attempt ${i + 1}/${this.maxRetries}`);

        const found = await this.findTransaction(
          expectedNano,
          senderAddress,
          startTime
        );

        if (found) {
          return true;
        }

        if (i < this.maxRetries - 1) {
          console.log(`Waiting ${this.retryDelay}ms before next attempt...`);
          await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        }
      }

      console.log('Transaction not found after all attempts');
      return false;

    } catch (error) {
      console.error('Verification failed:', error);
      return false;
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

  async initProjectWallet() {
    try {
      if (!process.env.MNEMONIC_WORDS) {
        throw new Error('Wallet mnemonic not found');
      }

      const mnemonic = process.env.MNEMONIC_WORDS.split(' ');
      const keyPair = await mnemonicToPrivateKey(mnemonic);
      
      this.walletContract = WalletContractV4.create({
        publicKey: keyPair.publicKey,
        workchain: 0
      });
      
      console.log('Project wallet initialized');
    } catch (error) {
      console.error('Failed to initialize project wallet:', error);
      throw error;
    }
  }



//   async verifyIncomingTransaction(
//     transactionHash: string,
//     expectedAmount: string,
//     senderAddress: string
//   ): Promise<boolean> {
//     try {
//       console.log('Starting verification:', {
//         hash: transactionHash,
//         amount: expectedAmount,
//         sender: senderAddress,
//         projectAddress: process.env.PROJECT_WALLET_ADDRESS
//       });

//       // Конвертируем base64 в hex если нужно
//       const hash = transactionHash.startsWith('te6ccg') 
//         ? Buffer.from(transactionHash, 'base64').toString('hex')
//         : transactionHash;

//       const checkOnce = async () => {
//         try {
//           console.log('Checking transaction with hash:', hash);
          
//           // Получаем транзакции
//           const transactions = await this.client.getTransactions(
//             Address.parse(process.env.PROJECT_WALLET_ADDRESS!),
//             {
//               limit: 20,
//               hash: hash
//             }
//           );

//           console.log('Founconst tx of transactionsd transactions:', transactions.length);
//           const parsedTransactions = transactions as unknown as ExtendedTransaction[];
//           for (const tx of parsedTransactions) {
//             // Проверяем входящее сообщение
//             if (!tx.inMessage?.value || !tx.inMessage?.source) {
//               console.log('Transaction missing required fields');
//               continue;
//             }

//             // Конвертируем адрес отправителя в нормальный формат
//             const txSender = tx.inMessage.source.toString();
            
//             // Сравниваем значения
//             const expectedNano = toNano(expectedAmount).toString();
//             const actualValue = tx.inMessage.value.toString();

//             console.log('Comparing values:', {
//               expectedAmount: expectedNano,
//               actualAmount: actualValue,
//               expectedSender: senderAddress,
//               actualSender: txSender
//             });

//             const isAmountMatch = expectedNano === actualValue;
//             const isSenderMatch = txSender === senderAddress;

//             if (isAmountMatch && isSenderMatch) {
//               console.log('Transaction verified successfully');
//               return true;
//             }
//           }

//           return false;
//         } catch (error) {
//           console.error('Error in checkOnce:', error);
//           return false;
//         }
//       };

//       // Делаем три попытки проверки
//       for (let i = 0; i < 3; i++) {
//         console.log(`Verification attempt ${i + 1}`);
        
//         const found = await checkOnce();
//         if (found) {
//           return true;
//         }

//         if (i < 2) {
//           console.log('Waiting before next attempt...');
//           await new Promise(resolve => setTimeout(resolve, 5000));
//         }
//       }

//       console.log('All verification attempts failed');
//       return false;

//     } catch (error) {
//       console.error('Verification failed:', error);
//       return false;
//     }
//   }



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