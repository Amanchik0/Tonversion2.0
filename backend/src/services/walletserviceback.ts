import { TonClient, Address, fromNano, toNano, WalletContractV4, Message, Dictionary } from '@ton/ton';
import { mnemonicToPrivateKey } from 'ton-crypto';
interface MessageInfo {
    type: string;
    src: Address;
    dest: Address;
    value: {
      coins: bigint;
    };
    createdAt: number;
  }
  
  interface InMessage {
    info: MessageInfo;
    value?: bigint;
    source?: Address;
  }
  
  interface ExtendedTransaction {
    hash: string;
    utime: number;
    lt: string;
    inMessage?: InMessage;
    outMessages: Map<number, {
      value: bigint;
      destination?: Address;
    }>;
    totalFees: {
      coins: bigint;
    };
    description: {
      createdAt: number;
      type: string;
    };
    storageFee?: bigint;
    otherFee?: bigint;
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

  private parseAddress(address: string): Address {
    try {
        // Попытка 1: Парсинг как friendly адреса (0Q... или EQ...)
        if (address.startsWith('0Q') || address.startsWith('EQ')) {
            return Address.parseFriendly(address).address;
        }
        
        // Попытка 2: Парсинг как raw адреса с воркчейном (0:...)
        if (address.includes(':')) {
            return Address.parse(address);
        }
        
        // Попытка 3: Добавление воркчейна и парсинг
        return Address.parse(`0:${address}`);
    } catch (error) {
        console.error('Error parsing address:', address, error);
        throw new Error(`Failed to parse address: ${address}`);
    }
}

private base64ToHex(base64: string): string {
  try {
      // Извлекаем только хеш транзакции из base64 строки
      const match = base64.match(/te6ccgEBAwEAqwABRYgA(.*?)AAAA/);
      if (!match || !match[1]) {
          throw new Error('Invalid transaction hash format');
      }
      return match[1];
  } catch (error) {
      console.error('Error extracting transaction hash:', error);
      return ''; // Возвращаем пустую строку, чтобы искать без хеша
  }
}

async verifyIncomingTransaction(
  transactionHash: string,
  expectedAmount: string,
  senderAddress: string
): Promise<boolean> {
  const maxAttempts = 5;
  const delayBetweenAttempts = 5000; // Увеличили до 5 секунд

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
          console.log(`Verification attempt ${attempt}/${maxAttempts}`);

          if (attempt > 1) {
              await new Promise(resolve => setTimeout(resolve, delayBetweenAttempts));
          }

          const projectAddress = process.env.PROJECT_WALLET_ADDRESS;
          if (!projectAddress) {
              throw new Error('Project wallet address not configured');
          }

          const parsedProjectAddress = this.parseAddress(projectAddress);
          const parsedSenderAddress = this.parseAddress(senderAddress);

          console.log('Parsed addresses:', {
              project: parsedProjectAddress.toString(),
              sender: parsedSenderAddress.toString()
          });

          // Получаем транзакции без использования хеша
          const transactions = await this.client.getTransactions(
              parsedProjectAddress,
              { limit: 20} // Увеличили лимит для большего охвата
          );

          console.log(`Got ${transactions.length} transactions`);

          const parsedTransactions = transactions as unknown as ExtendedTransaction[];
          const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 300;

          const foundTransaction = parsedTransactions.find(tx => {
              const inMessageValue = tx.inMessage?.info?.value?.coins;
              const sender = tx.inMessage?.info?.src;
              
              if (!inMessageValue || !sender) {
                  return false;
              }

              const transactionAmount = fromNano(inMessageValue);
              const isAmountMatch = transactionAmount === expectedAmount;
              const isSenderMatch = sender.equals(parsedSenderAddress);
              const isRecent = (tx.description?.createdAt || 0) > fiveMinutesAgo;

              console.log('Checking transaction:', {
                  amount: transactionAmount,
                  expectedAmount,
                  from: sender.toString(),
                  expectedSender: parsedSenderAddress.toString(),
                  isAmountMatch,
                  isSenderMatch,
                  isRecent,
                  time: new Date((tx.description?.createdAt || 0) * 1000).toISOString()
              });

              return isAmountMatch && isSenderMatch && isRecent;
          });

          if (foundTransaction) {
              console.log('Found matching transaction!');
              return true;
          }

          console.log('No matching transaction found in this attempt');

      } catch (error: any) {
          if (error.response?.status === 503) {
              console.log('TON Center temporarily unavailable, will retry...');
              continue;
          }
          console.error(`Error in verification attempt ${attempt}:`, error);
      }
  }

  return false;
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


  async getProjectTransactions(limit: number = 1) {
    try {
        console.log('Getting project wallet transactions');
        const address = process.env.PROJECT_WALLET_ADDRESS;
        
        if (!address) {
            throw new Error('Project wallet address not configured');
        }

        // Добавляем проверку и форматирование адреса
        let formattedAddress = address;
        if (!address.includes(':')) {
            formattedAddress = `0:${address}`; // Добавляем воркчейн, если его нет
        }

        // Теперь парсим отформатированный адрес
        const parsedAddress = Address.parse(formattedAddress);

        const transactions = await this.client.getTransactions(
            parsedAddress,
            { limit }
        );

        console.log(`Got ${transactions.length} transactions`);
        const parsedTransactions = transactions as unknown as ExtendedTransaction[];

        return parsedTransactions.map(tx => {
            try {
                const inMessageValue = tx.inMessage?.info?.value?.coins;
                const totalFees = tx.totalFees?.coins;

                console.log('Transaction values:', {
                    inMessageValue,
                    totalFees,
                    hasInMessage: !!tx.inMessage,
                    hasInfo: !!tx.inMessage?.info,
                    hasValue: !!tx.inMessage?.info?.value,
                });

                return {
                    hash: tx.hash || 'unknown',
                    time: tx.description?.createdAt ? 
                        new Date(tx.description.createdAt * 1000).toISOString() : 
                        new Date().toISOString(),
                    value: inMessageValue ? fromNano(inMessageValue) : '0',
                    from: tx.inMessage?.info?.src?.toString() || 'unknown',
                    to: tx.inMessage?.info?.dest?.toString() || 'unknown',
                    totalFees: totalFees ? fromNano(totalFees) : '0'
                };
            } catch (error) {
                console.error('Error processing transaction:', error);
                return {
                    hash: tx.hash || 'unknown',
                    time: new Date().toISOString(),
                    value: '0',
                    from: 'error',
                    to: 'error',
                    totalFees: '0'
                };
            }
        });

    } catch (error) {
        console.error('Failed to get project transactions:', error);
        throw error;
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

      return true;
    } catch (error) {
      console.error('Failed to send refund:', error);
      return false;
    }
  }
}






////////////////////////////////////////////////
////////////////////////////////////////////////
////////////////////////////////////////////////
////////////////////////////////////////////////
////////////////////////////////////////////////
////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////
////////////////////////////////////////////////
////////////////////////////////////////////////
////////////////////////////////////////////////
////////////////////////////////////////////////
////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////
////////////////////////////////////////////////
////////////////////////////////////////////////
////////////////////////////////////////////////
////////////////////////////////////////////////
////////////////////////////////////////////////
////////////////////////////////////////////////
////////////////////////////////////////////////
////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////

// // src/services/tonService.ts
// import { TonClient, Address, Message, Dictionary, ContractProvider } from '@ton/ton';
// import { ContractData } from '../types';

// interface ExtendedMessage extends Message {
//   value: bigint;
//   source?: Address;
//   destination?: Address;
// }

// interface ExtendedTransaction {
//   inMessage?: ExtendedMessage;
//   outMessages: Dictionary<number, ExtendedMessage>;
//   hash: string;
// }

// interface ContractState {
//   balance: bigint;
//   isDeployed: boolean;
// }

// export class TonService {
//   private client: TonClient;
//   private contractAddress: string;

//   constructor(contractData: ContractData) {
//     this.client = new TonClient({
//       endpoint: 'https://testnet.toncenter.com/api/v2/jsonRPC',
//       apiKey: process.env.TON_API_KEY
//     });
//     this.contractAddress = contractData.address;
//   }

// // Мы получаем hash транзакции и проверяем:
// async verifyPurchase(transactionHash: string, amount: string): Promise<boolean> {
//   try {
//     const transactions = await this.client.getTransactions(
//       Address.parse(this.contractAddress), 
//       {
//         limit: 1,
//         hash: transactionHash
//       }
//     );

//     if (transactions.length === 0) {
//       return false;
//     }

//     const tx = transactions[0] as unknown as ExtendedTransaction;
    
//     if (!tx.inMessage?.value) {
//       return false;
//     }

//     // Здесь нужно добавить проверки:
//     // 1. Правильный адрес отправителя
//     // 2. Правильный адрес получателя (наш кошелек)
    
//     return tx.inMessage.value.toString() === amount;
    
//   } catch (error) {
//     console.error('Verify purchase error:', error);
//     return false;
//   }
// }

//   async getContractStatus(): Promise<boolean> {
//     try {
//       const balance = await this.client.getBalance(
//         Address.parse(this.contractAddress)
//       );
//       return balance > BigInt(0);
//     } catch (error) {
//       console.error('Get contract status error:', error);
//       return false;
//     }
//   }

//   private async getContractState(): Promise<ContractState> {
//     const address = Address.parse(this.contractAddress);
//     const balance = await this.client.getBalance(address);
//     const isDeployed = await this.client.isContractDeployed(address);
    
//     return {
//       balance,
//       isDeployed
//     };
//   }
// }