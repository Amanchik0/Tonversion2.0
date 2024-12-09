import { TonClient, Address, Transaction } from 'ton';
import { ContractData } from '../types';

export class TonService {
  private client: TonClient;
  private contractAddress: string;

  constructor(contractData: ContractData) {
    this.client = new TonClient({
      endpoint: 'https://toncenter.com/api/v2/jsonRPC',
      apiKey: process.env.TON_API_KEY // Добавим API ключ для toncenter
    });
    this.contractAddress = contractData.address;
  }

  async verifyPurchase(transactionHash: string, amount: string): Promise<boolean> {
    try {
      // Получаем транзакцию по хешу
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

      const tx = transactions[0];
      
      // Проверяем сумму транзакции
      if (!tx.inMessage?.value) {
        return false;
      }

      // Сравниваем сумму (в нанотонах)
      return tx.inMessage.value === amount;
      
    } catch (error) {
      console.error('Verify purchase error:', error);
      return false;
    }
  }

  // Добавим метод для проверки статуса контракта
  async getContractStatus(): Promise<boolean> {
    try {
      const balance = await this.client.getBalance(
        Address.parse(this.contractAddress)
      );
      return balance > 0; // Проверяем что контракт существует и имеет баланс
    } catch (error) {
      console.error('Get contract status error:', error);
      return false;
    }
  }
}