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
        console.log('Verifying transaction:', {
            expectedAmount,
            senderAddress
        });

        // Нормализуем адрес отправителя в формат EQ...
        const normalizedSender = Address.parse(senderAddress).toString();
        
        const transactions = await this.client.getTransactions(
            Address.parse(process.env.PROJECT_WALLET_ADDRESS!),
            { limit: 20 }
        );

        const parsedTransactions = transactions as unknown as ExtendedTransaction[];
        const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 300;
        
        const foundTransaction = parsedTransactions.find(tx => {
            const inMessageValue = tx.inMessage?.info?.value?.coins;
            const sender = tx.inMessage?.info?.src?.toString();
            
            if (!inMessageValue || !sender) return false;

            const transactionAmount = fromNano(inMessageValue);
            
            // Теперь сравниваем с нормализованным адресом
            const isAmountMatch = transactionAmount === expectedAmount;
            const isSenderMatch = sender === normalizedSender;
            const isRecent = (tx.description?.createdAt || 0) > fiveMinutesAgo;

            console.log('Checking transaction:', {
                transactionAmount,
                expectedAmount,
                sender,
                expectedSender: normalizedSender, // используем нормализованный адрес
                isAmountMatch,
                isSenderMatch,
                isRecent,
                txTime: new Date((tx.description?.createdAt || 0) * 1000).toISOString(),
                currentTime: new Date().toISOString()
            });

            return isAmountMatch && isSenderMatch && isRecent;
        });

        return !!foundTransaction;
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


  async getProjectTransactions(limit: number = 1) {
    try {
        console.log('Getting project wallet transactions');
        const address = process.env.PROJECT_WALLET_ADDRESS;
        
        if (!address) {
            throw new Error('Project wallet address not configured');
        }

        const transactions = await this.client.getTransactions(
            Address.parse(address),
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