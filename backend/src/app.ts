import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { purchaseRoutes } from './routes/purchaseRoutes';
import { walletRoutes } from './routes/walletRoutes';
import { errorHandler } from './middleware/errorHandler';
import { connectDB } from './config/database';

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
console.log('Loaded ENV:', {
    CONTRACT_ADDRESS: process.env.CONTRACT_ADDRESS,
    CONTRACT_PRICE: process.env.CONTRACT_PRICE,
    TON_API_KEY: process.env.TON_API_KEY
});

// Routes
app.use('/api/purchases', purchaseRoutes);
app.use('/api/wallet', walletRoutes);

// Error handler
app.use(errorHandler);

const PORT = process.env.PORT || 3001;

const start = async () => {
  try {
    await connectDB();
    console.log('Connected to database');
    
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Error starting server:', error);
    process.exit(1);
  }
};

start();

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Closing HTTP server...');
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.close();
  }
  process.exit(0);
});