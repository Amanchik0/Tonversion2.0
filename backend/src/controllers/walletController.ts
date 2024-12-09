// src/controllers/walletController.ts
import { Request, Response } from 'express';
import { WalletService } from '../services/walletService';
import { PurchaseService } from '../services/purchaseService';

export class WalletController {
  constructor(
    private walletService: WalletService,
    private purchaseService: PurchaseService
  ) {}

  // Получить баланс кошелька проекта
  getProjectBalance = async (req: Request, res: Response) => {
    try {
      const balance = await this.walletService.getBalance(process.env.PROJECT_WALLET_ADDRESS || '');
      res.json({ balance });
    } catch (error) {
      console.error('Error getting balance:', error);
      res.status(500).json({ error: 'Failed to get balance' });
    }
  };

  // Проверить транзакцию покупки
  verifyPurchase = async (req: Request, res: Response) => {
    try {
      const { transactionHash, userWallet, amount } = req.body;

      // Проверяем поступление оплаты
      const isPaymentReceived = await this.walletService.verifyIncomingTransaction(
        transactionHash,
        amount.toString(),
        userWallet
      );

      if (!isPaymentReceived) {
        return res.status(400).json({ error: 'Payment not found' });
      }

      // Проверяем, нет ли уже активной покупки
      const existingPurchase = await this.purchaseService.getPurchaseByTransactionHash(transactionHash);
      if (existingPurchase) {
        return res.status(400).json({ error: 'Transaction already processed' });
      }

      // Создаем запись о покупке
      const purchase = await this.purchaseService.createPurchase({
        telegramId: req.body.telegramId,
        walletAddress: userWallet,
        transactionHash,
        amount: parseFloat(amount)
      });

      res.json({ success: true, purchase });
    } catch (error) {
      console.error('Error verifying purchase:', error);
      res.status(500).json({ error: 'Failed to verify purchase' });
    }
  };

  // Отправить возврат средств
  processRefund = async (req: Request, res: Response) => {
    try {
      const { purchaseId } = req.body;

      // Получаем информацию о покупке
      const purchase = await this.purchaseService.getPurchaseById(purchaseId);
      if (!purchase) {
        return res.status(404).json({ error: 'Purchase not found' });
      }

      if (purchase.refunded) {
        return res.status(400).json({ error: 'Refund already processed' });
      }

      // Вычисляем сумму возврата (70%)
      const refundAmount = (purchase.amount * 0.7).toString();

      // Отправляем возврат
      const refundSuccess = await this.walletService.sendRefund(
        purchase.walletAddress,
        refundAmount,
      );

      if (!refundSuccess) {
        return res.status(500).json({ error: 'Failed to process refund' });
      }

      // Обновляем статус покупки
      const updatedPurchase = await this.purchaseService.completePurchase(purchaseId);

      res.json({ success: true, purchase: updatedPurchase });
    } catch (error) {
      console.error('Error processing refund:', error);
      res.status(500).json({ error: 'Failed to process refund' });
    }
  };

  // Получить историю транзакций
  getTransactionHistory = async (req: Request, res: Response) => {
    try {
      const { address } = req.params;
      const history = await this.walletService.getTransactionHistory(address);
      res.json(history);
    } catch (error) {
      console.error('Error getting transaction history:', error);
      res.status(500).json({ error: 'Failed to get transaction history' });
    }
  };
}