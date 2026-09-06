import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';

import authRoutes from './routes/auth.js';
import taskRoutes from './routes/tasks.js';
import friendRoutes from './routes/friends.js';
import roomRoutes from './routes/rooms.js';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from backend directory (works both locally and on Vercel)
dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
const httpServer = createServer(app);
// socket.io disabled on Vercel Serverless
const io = null;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection with caching for serverless
let isConnected = false;

async function connectDB() {
  if (isConnected) return;
  
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('CRITICAL: MONGODB_URI is not defined!');
    return;
  }

  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(uri);
      isConnected = true;
      console.log('Connected to MongoDB successfully!');
    } else {
      isConnected = true;
    }
  } catch (err) {
    console.error('Failed to connect to MongoDB:', err);
    throw err;
  }
}

// Ensure DB is connected before any route handler runs
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    res.status(500).json({ message: 'Database connection failed', error: err.message });
  }
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/rooms', roomRoutes);

// Make io accessible in routes
app.set('io', io);

// Serve frontend static files only in local dev (Monolith mode)
if (process.env.NODE_ENV !== 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
  });
}

// Start server locally (Vercel handles the export automatically)
if (process.env.NODE_ENV !== 'production') {
  connectDB().then(() => {
    const PORT = process.env.PORT || 5000;
    httpServer.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  });
}

export default app;
