// src/routes/purchaseRoutes.ts
import { Router, RequestHandler } from 'express';
import { PurchaseController } from '../controllers/purchaseController';
import { PurchaseService } from '../services/purchaseService';
import { TonService } from '../services/tonService';
import dotenv from 'dotenv';

dotenv.config();

const router = Router();
dotenv.config();
console.log('Loaded ENV:', {
    CONTRACT_ADDRESS: process.env.CONTRACT_ADDRESS,
    CONTRACT_PRICE: process.env.CONTRACT_PRICE,
    TON_API_KEY: process.env.TON_API_KEY
});

if (!process.env.CONTRACT_ADDRESS) {
    console.error('CONTRACT_ADDRESS not found in environment variables');
    process.exit(1);
}

const tonService = new TonService({
    address: process.env.CONTRACT_ADDRESS,
    price: process.env.CONTRACT_PRICE || '10000000000'
});

const purchaseService = new PurchaseService();
const purchaseController = new PurchaseController(purchaseService, tonService);

router.post('/', (purchaseController.createPurchase as RequestHandler));
router.post('/complete', (purchaseController.completePurchase as RequestHandler));
router.get('/user/:telegramId', (purchaseController.getUserPurchases as RequestHandler));

export const purchaseRoutes = router;