//backend\src\routes\purchaseRoutes.ts
import { Router } from 'express';
import { PurchaseController } from '../controllers/purchaseController';
import { PurchaseService } from '../services/purchaseService';
import { TonService } from '../services/tonService';

const router = Router();

const tonService = new TonService({
  address: process.env.CONTRACT_ADDRESS || '',
  price: '10000000000' // 10 TON в наноTON
});
const purchaseService = new PurchaseService();
const purchaseController = new PurchaseController(purchaseService, tonService);

router.post('/', purchaseController.createPurchase);
router.post('/complete', purchaseController.completePurchase);
router.get('/user/:telegramId', purchaseController.getUserPurchases);

export const purchaseRoutes = router;