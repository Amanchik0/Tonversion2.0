// src/test/dbTest.ts
import { connectDB } from '../config/database';
import { Purchase } from '../models/Purchase';
import mongoose from 'mongoose';

async function testDatabaseConnection() {
  try {
    await connectDB();
    console.log('Connected to MongoDB Atlas');

    const testPurchase = {
      telegramId: '123456789',
      walletAddress: 'EQD4FPq-PRE...',
      transactionHash: 'test_hash_' + Date.now(),
      amount: 10.0
    };

    const newPurchase = new Purchase(testPurchase);
    const savedPurchase = await newPurchase.save();
    console.log('Created purchase:', savedPurchase);

    const foundPurchase = await Purchase.findOne({ telegramId: '123456789' });
    console.log('Found purchase:', foundPurchase);

    await Purchase.findByIdAndDelete(savedPurchase._id);
    console.log('Test purchase deleted');

  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await mongoose.connection.close();
  }
}

testDatabaseConnection();