import { Request, Response } from 'express';
import { WalletService } from '../services/walletService';
import { PurchaseService } from '../services/purchaseService';
import { TonClient, Address, fromNano } from '@ton/ton';

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
  outMessages: Map<number, TransactionMessage>;
  totalFees: bigint;
  storageFee?: bigint;
  otherFee?: bigint;
  description?: string;
}

export class WalletController {
  private client: TonClient;

  constructor(
    private walletService: WalletService,
    private purchaseService: PurchaseService
  ) {
    this.client = new TonClient({
      endpoint: 'https://testnet.toncenter.com/api/v2/jsonRPC',
      apiKey: process.env.TON_API_KEY || ''
    });
  }

  getProjectBalance = async (req: Request, res: Response) => {
    try {
      const balance = await this.walletService.getBalance(process.env.PROJECT_WALLET_ADDRESS || '');
      res.json({ balance });
    } catch (error) {
      console.error('Error getting balance:', error);
      res.status(500).json({ error: 'Failed to get balance' });
    }
  };

  getProjectTransactions = async (req: Request, res: Response) => {
    try {
        console.log('Starting to get project transactions');
        const transactions = await this.walletService.getProjectTransactions();
        console.log('Successfully got transactions');
        res.json(transactions);
    } catch (error) {
        console.error('Error in controller getting project transactions:', error);
        res.status(500).json({ 
            error: 'Failed to get project transactions',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

  verifyPurchase = async (req: Request, res: Response) => {
    const telegramId = '786669040';


    try {
      const { transactionHash, userWallet, amount } = req.body;

      console.log('Received verify purchase request:', {
        transactionHash,
        userWallet,
        amount,
        telegramId
      });

      const isPaymentReceived = await this.walletService.verifyIncomingTransaction(
        transactionHash,
        amount.toString(),
        userWallet
      );

      if (!isPaymentReceived) {
        return res.status(400).json({ error: 'Payment not found' });
      }

      const existingPurchase = await this.purchaseService.getPurchaseByTransactionHash(transactionHash);
      if (existingPurchase) {
        return res.status(400).json({ error: 'Transaction already processed' });
      }

      const purchase = await this.purchaseService.createPurchase({
        telegramId,
        walletAddress: userWallet,
        transactionHash,
        amount: parseFloat(amount)
      });

      console.log('Purchase created:', purchase);
      res.json({ success: true, purchase });
    } catch (error) {
      console.error('Error verifying purchase:', error);
      res.status(500).json({ error: 'Failed to verify purchase' });
    }
  };

  processRefund = async (req: Request, res: Response) => {
    try {
      const { purchaseId } = req.body;
      const purchase = await this.purchaseService.getPurchaseById(purchaseId);
      
      if (!purchase) {
        return res.status(404).json({ error: 'Purchase not found' });
      }

      if (purchase.refunded) {
        return res.status(400).json({ error: 'Refund already processed' });
      }

      const refundAmount = (purchase.amount * 0.7).toString();
      const refundSuccess = await this.walletService.sendRefund(
        purchase.walletAddress,
        refundAmount
      );

      if (!refundSuccess) {
        return res.status(500).json({ error: 'Failed to process refund' });
      }

      const updatedPurchase = await this.purchaseService.completePurchase(purchaseId);
      res.json({ success: true, purchase: updatedPurchase });
    } catch (error) {
      console.error('Error processing refund:', error);
      res.status(500).json({ error: 'Failed to process refund' });
    }
  };

  getTransactions = async (req: Request, res: Response) => {
    try {
      const { address } = req.params;
      console.log('Getting transactions for address:', address);

      const transactions = await this.client.getTransactions(
        Address.parse(address),
        { limit: 1 }
      );

      const formattedTransactions = transactions.map((tx: any) => {
        try {
          return {
            hash: tx.hash || 'unknown',
            time: tx.utime || 0,
            value: tx.inMessage?.value ? fromNano(tx.inMessage.value) : '0',
            from: tx.inMessage?.source?.toString(),
            to: tx.outMessages?.values().next().value?.destination?.toString(),
            lt: tx.lt?.toString(),
            totalFees: tx.totalFees ? fromNano(tx.totalFees) : '0',
            storageFee: tx.storageFee ? fromNano(tx.storageFee) : '0',
            otherFee: tx.otherFee ? fromNano(tx.otherFee) : '0',
            description: tx.description || ''
          };
        } catch (error) {
          console.error('Error processing transaction:', error);
          return null;
        }
      }).filter(Boolean);

      console.log('Processed transactions:', formattedTransactions);
      res.json(formattedTransactions);
    } catch (error) {
      console.error('Failed to get transactions:', error);
      res.status(500).json({ error: 'Failed to get transactions' });
    }
  };
}