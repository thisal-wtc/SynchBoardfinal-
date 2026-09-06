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

dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
const httpServer = createServer(app);
// socket.io disabled on Vercel Serverless
const io = null;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/rooms', roomRoutes);

// Socket.io connection handling
// Socket.io connection handling disabled for Vercel
// Moving this to a dedicated backend server (Render/Railway) later

// Make io accessible in routes
app.set('io', io);

// Serve frontend static files only in local dev (Monolith mode)
if (process.env.NODE_ENV !== 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
  });
}

// Connect to MongoDB
if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
      console.log('Connected to MongoDB successfully!');
      // Only start the server locally, Vercel handles the export automatically
      if (process.env.NODE_ENV !== 'production') {
        const PORT = process.env.PORT || 5000;
        httpServer.listen(PORT, () => {
          console.log(`Server is running on port ${PORT}`);
        });
      }
    })
    .catch((err) => {
      console.error('Failed to connect to MongoDB:', err);
    });
} else {
  console.error('CRITICAL ERROR: MONGODB_URI is not defined! Please add it to Vercel Environment Variables.');
}

export default app;
