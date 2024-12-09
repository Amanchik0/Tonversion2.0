//backend\src\controllers\purchaseController.ts
import { Request, Response } from 'express';
import { PurchaseService } from '../services/purchaseService';
import { TonService } from '../services/tonService';

export class PurchaseController {
  constructor(
    private purchaseService: PurchaseService,
    private tonService: TonService
  ) {}

  createPurchase = async (req: Request, res: Response) => {
    try {
      const { telegramId, walletAddress, transactionHash, amount } = req.body;

      // Проверяем транзакцию
      const isValid = await this.tonService.verifyPurchase(transactionHash, amount.toString());
      if (!isValid) {
        return res.status(400).json({ error: 'Invalid transaction' });
      }

      // Проверяем, нет ли уже активной покупки
      const existingPurchase = await this.purchaseService.getActivePurchase(telegramId);
      if (existingPurchase) {
        return res.status(400).json({ error: 'User already has active purchase' });
      }

      const purchase = await this.purchaseService.createPurchase({
        telegramId,
        walletAddress,
        transactionHash,
        amount
      });

      res.status(201).json(purchase);
    } catch (error) {
      console.error('Purchase creation error:', error);
      res.status(500).json({ error: 'Error creating purchase' });
    }
  };

  getUserPurchases = async (req: Request, res: Response) => {
    try {
      const { telegramId } = req.params;
      const purchases = await this.purchaseService.getPurchasesByTelegramId(telegramId);
      res.json(purchases);
    } catch (error) {
      console.error('Get purchases error:', error);
      res.status(500).json({ error: 'Error getting purchases' });
    }
  };

  completePurchase = async (req: Request, res: Response) => {
    try {
      const { purchaseId, telegramId } = req.body;

      // Проверяем существование покупки
      const purchase = await this.purchaseService.getPurchaseById(purchaseId);
      if (!purchase || purchase.telegramId !== telegramId) {
        return res.status(404).json({ error: 'Purchase not found' });
      }

      // Проверяем, что покупка еще не завершена
      if (purchase.completed || purchase.refunded) {
        return res.status(400).json({ error: 'Purchase already completed' });
      }

      // Отмечаем как выполненную
      const completedPurchase = await this.purchaseService.completePurchase(purchaseId);
      
      res.json(completedPurchase);
    } catch (error) {
      console.error('Complete purchase error:', error);
      res.status(500).json({ error: 'Error completing purchase' });
    }
  };
}