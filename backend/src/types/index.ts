// src/types/index.ts
export interface Purchase {
  id: string;
  telegramId: string;
  walletAddress: string;
  transactionHash: string;
  amount: number;
  completed: boolean;
  refunded: boolean;
  createdAt: Date;
}

export interface CreatePurchaseDto {
  telegramId: string;
  walletAddress: string;
  transactionHash: string;
  amount: number;
}

export interface ContractData {
  address: string;
  price: string;
}

export interface TransactionData {
  hash: string;
  amount: string;
  sender: string;
}