// src/config/database.ts
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

export const connectDB = async (): Promise<void> => {
  try {
    const uri = process.env.MONGODB_URI;
    
    if (!uri) {
      throw new Error('MONGODB_URI is not defined');
    }

    await mongoose.connect(uri);
    console.log('Successfully connected to MongoDB Atlas');
  } catch (error) {
    console.error('Database connection error:', error);
    throw error;
  }
};