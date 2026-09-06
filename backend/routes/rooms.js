import express from 'express';
import Room from '../models/Room.js';
import User from '../models/User.js';
import Task from '../models/Task.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

// Create a new room
router.post('/create', verifyToken, async (req, res) => {
  try {
    const { name, description } = req.body;
    
    const room = new Room({
      name,
      description,
      owner: req.user._id,
      members: [{ user: req.user._id, role: 'owner' }] // Owner is automatically a member
    });

    await room.save();
    res.status(201).json(room);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get user's rooms
router.get('/', verifyToken, async (req, res) => {
  try {
    const rooms = await Room.find({ 
      $or: [
        { 'members.user': req.user._id }, 
        { members: req.user._id }
      ] 
    }).populate('members.user', 'name email avatar').populate('members', 'name email avatar');
    res.json(rooms);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get single room by ID
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const room = await Room.findById(req.params.id).populate('members.user', 'name email avatar').populate('members', 'name email avatar');
    if (!room) return res.status(404).json({ message: "Room not found" });
    
    // Check if user is a member
    if (!room.members.some(m => {
      if (m.user && m.user._id) return m.user._id.toString() === req.user._id;
      return m._id ? m._id.toString() === req.user._id : m.toString() === req.user._id;
    })) {
      return res.status(403).json({ message: "Access denied" });
    }

    res.json(room);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update room columns
router.put('/:id/columns', verifyToken, async (req, res) => {
  try {
    const { columns } = req.body;
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ message: "Room not found" });
    
    // Check if user is a member
    const myMembership = room.members.find(m => {
      if (m.user) return m.user.toString() === req.user._id;
      return m._id ? m._id.toString() === req.user._id : m.toString() === req.user._id;
    });
    
    if (!myMembership) {
      return res.status(403).json({ message: "Access denied" });
    }
    
    // Only owner or editor can update columns
    if (myMembership.role === 'viewer') {
      return res.status(403).json({ message: "Viewers cannot update columns" });
    }

    room.columns = columns;
    await room.save();

    res.json({ message: "Columns updated successfully", columns: room.columns });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Invite friend to room
router.post('/:id/invite', verifyToken, async (req, res) => {
  try {
    const { targetUserId } = req.body;
    const room = await Room.findById(req.params.id);
    
    if (!room) return res.status(404).json({ message: "Room not found" });
    
    const myMembership = room.members.find(m => {
      if (m.user) return m.user.toString() === req.user._id;
      return m._id ? m._id.toString() === req.user._id : m.toString() === req.user._id;
    });
    if (!myMembership) {
      return res.status(403).json({ message: "Not a member of this room" });
    }
    
    // Only owner or editors can invite
    if (myMembership.role === 'viewer') {
      return res.status(403).json({ message: "Viewers cannot invite members" });
    }

    if (room.members.some(m => {
      if (m.user) return m.user.toString() === targetUserId;
      return m._id ? m._id.toString() === targetUserId : m.toString() === targetUserId;
    })) {
      return res.status(400).json({ message: "User already in room" });
    }

    room.members.push({ user: targetUserId, role: 'editor' }); // default invite role
    await room.save();
    
    res.json({ message: "User invited successfully", room });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

import Message from '../models/Message.js';

// Get room messages
router.get('/:id/messages', verifyToken, async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room || !room.members.some(m => {
      if (m.user) return m.user.toString() === req.user._id;
      return m._id ? m._id.toString() === req.user._id : m.toString() === req.user._id;
    })) {
      return res.status(403).json({ message: "Access denied" });
    }

    const messages = await Message.find({ room: req.params.id })
      .populate('sender', 'name avatar')
      .sort({ createdAt: 1 })
      .limit(100);

    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Post a message
router.post('/:id/messages', verifyToken, async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room || !room.members.some(m => {
      if (m.user) return m.user.toString() === req.user._id;
      return m._id ? m._id.toString() === req.user._id : m.toString() === req.user._id;
    })) {
      return res.status(403).json({ message: "Access denied" });
    }

    const message = new Message({
      room: req.params.id,
      sender: req.user._id,
      content: req.body.content
    });

    await message.save();
    
    // Populate sender before broadcasting
    await message.populate('sender', 'name avatar');
    
    const io = req.app.get('io');
    if (io) {
      io.to(req.params.id.toString()).emit('receive-message', message);
    }

    res.status(201).json(message);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
