// src/services/purchaseService.ts
import { Purchase, IPurchase } from '../models/Purchase';

export class PurchaseService {
  async createPurchase(data: {
    telegramId: string;
    walletAddress: string;
    transactionHash: string;
    amount: number;
  }): Promise<IPurchase> {
    const purchase = new Purchase(data);
    return await purchase.save();
  }

  async getPurchasesByTelegramId(telegramId: string): Promise<IPurchase[]> {
    return await Purchase.find({ telegramId }).sort({ createdAt: -1 });
  }
  
  async getActivePurchase(telegramId: string): Promise<IPurchase | null> {
    return await Purchase.findOne({
      telegramId,
      completed: false,
      refunded: false
    });
  }

  async getPurchaseById(purchaseId: string): Promise<IPurchase | null> {
    return await Purchase.findById(purchaseId);
  }

  async completePurchase(purchaseId: string): Promise<IPurchase | null> {
    return await Purchase.findByIdAndUpdate(
      purchaseId,
      {
        completed: true,
        refunded: true
      },
      { new: true }
    );
  }

  //  метод для поиска по хешу транзакции
  async getPurchaseByTransactionHash(hash: string): Promise<IPurchase | null> {
    return await Purchase.findOne({ transactionHash: hash });
  }
}