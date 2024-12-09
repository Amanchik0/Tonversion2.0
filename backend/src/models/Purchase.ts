// import mongoose from 'mongoose';

// const purchaseSchema = new mongoose.Schema({
//   telegramId: { type: String, required: true },
//   walletAddress: { type: String, required: true },
//   transactionHash: { type: String, required: true },
//   amount: { type: Number, required: true },
//   completed: { type: Boolean, default: false },
//   refunded: { type: Boolean, default: false },
//   createdAt: { type: Date, default: Date.now }
// });

// export const Purchase = mongoose.model('Purchase', purchaseSchema);

// src/models/Purchase.ts
import mongoose, { Schema, Document } from 'mongoose';

export interface IPurchase extends Document {
  telegramId: string;
  walletAddress: string;
  transactionHash: string;
  amount: number;
  completed: boolean;
  refunded: boolean;
  createdAt: Date;
}

const purchaseSchema = new Schema({
  telegramId: { 
    type: String, 
    required: true,
    index: true 
  },
  walletAddress: { 
    type: String, 
    required: true,
    index: true 
  },
  transactionHash: { 
    type: String, 
    required: true,
    unique: true
  },
  amount: { 
    type: Number, 
    required: true 
  },
  completed: { 
    type: Boolean, 
    default: false 
  },
  refunded: { 
    type: Boolean, 
    default: false 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

export const Purchase = mongoose.model<IPurchase>('Purchase', purchaseSchema);


