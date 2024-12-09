import { Request, Response, NextFunction } from 'express';

export const validatePurchase = (req: Request, res: Response, next: NextFunction) => {
  const { telegramId, walletAddress, transactionHash, amount } = req.body;

  if (!telegramId || !walletAddress || !transactionHash || !amount) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  next();
};