// src/routes/purchaseRoutes.ts
import { Router, RequestHandler } from 'express';
import { PurchaseController } from '../controllers/purchaseController';
import { PurchaseService } from '../services/purchaseService';
import { TonService } from '../services/tonService';

const router = Router();

const tonService = new TonService({
  address: process.env.CONTRACT_ADDRESS || '',
  price: '10000000000'
});

const purchaseService = new PurchaseService();
const purchaseController = new PurchaseController(purchaseService, tonService);

// Приводим методы контроллера к типу RequestHandler
router.post('/', (purchaseController.createPurchase as RequestHandler));
router.post('/complete', (purchaseController.completePurchase as RequestHandler));
router.get('/user/:telegramId', (purchaseController.getUserPurchases as RequestHandler));

export const purchaseRoutes = router;