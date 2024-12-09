// src/app.ts
import express from 'express';
import cors from 'cors';
import { purchaseRoutes } from './routes/purchaseRoutes';
import { errorHandler } from './middleware/errorHandler';
import { connectDB } from './config/database';

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/purchases', purchaseRoutes);

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

process.on('SIGTERM', async () => {
  await mongoose.connection.close();
  process.exit(0);
});