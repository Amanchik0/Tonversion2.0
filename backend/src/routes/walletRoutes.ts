// src/routes/walletRoutes.ts
import { Router, RequestHandler } from 'express';
import { WalletController } from '../controllers/walletController';
import { WalletService } from '../services/walletService';
import { PurchaseService } from '../services/purchaseService';

const router = Router();

const walletService = new WalletService();
const purchaseService = new PurchaseService();
const walletController = new WalletController(walletService, purchaseService);

// Приводим методы контроллера к типу RequestHandler
router.get('/balance', (walletController.getProjectBalance as RequestHandler));
router.post('/verify-purchase', (walletController.verifyPurchase as RequestHandler));
router.post('/process-refund', (walletController.processRefund as RequestHandler));
router.get('/transactions/:address', (walletController.getTransactions as RequestHandler));

export const walletRoutes = router; 