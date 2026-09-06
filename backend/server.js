import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import authRoutes from './routes/auth.js';
import taskRoutes from './routes/tasks.js';
import friendRoutes from './routes/friends.js';
import roomRoutes from './routes/rooms.js';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*", // Adjust in production
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/rooms', roomRoutes);

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    console.log(`Socket ${socket.id} joined room ${roomId}`);
  });

  socket.on('cursor-move', (data) => {
    // data: { roomId, x, y, user: { name, avatar }, socketId }
    socket.to(data.roomId).emit('cursor-move', data);
  });

  // WebRTC Signaling
  socket.on('webrtc-join', (roomId, user) => {
    socket.join(roomId);
    socket.to(roomId).emit('webrtc-user-joined', { socketId: socket.id, user });
  });

  socket.on('webrtc-offer', (data) => {
    socket.to(data.to).emit('webrtc-offer', {
      offer: data.offer,
      from: socket.id,
      user: data.user
    });
  });

  socket.on('webrtc-answer', (data) => {
    socket.to(data.to).emit('webrtc-answer', {
      answer: data.answer,
      from: socket.id
    });
  });

  socket.on('webrtc-ice-candidate', (data) => {
    socket.to(data.to).emit('webrtc-ice-candidate', {
      candidate: data.candidate,
      from: socket.id
    });
  });

  socket.on('webrtc-leave', (roomId) => {
    socket.to(roomId).emit('webrtc-user-left', socket.id);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    // Broadcast leave to all rooms this socket was in (Socket.io does this automatically partially, but we can emit a global leave)
    socket.broadcast.emit('webrtc-user-left', socket.id);
  });
});

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
