import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const server = createServer(app);

// Configure Socket.io for WebSockets and HTTP polling
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PATCH']
  },
  transports: ['websocket', 'polling']
});

io.on('connection', (socket) => {
  console.log('⚡ Client connected:', socket.id);

  socket.on('join_workspace', (room) => {
    socket.join(room);
    console.log(`Socket ${socket.id} joined room ${room}`);
  });

  socket.on('task_moved', (data) => {
    socket.to(data.workspaceId || 'main-ws').emit('task_updated', data);
  });

  socket.on('task_added', (data) => {
    socket.to(data.workspaceId || 'main-ws').emit('task_created', data.task);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Basic route check
app.get('/api/tasks', (req, res) => {
  res.json([
    { id: '1', title: 'Design Database Schema for RBAC', status: 'TODO', assignee: 'Manikya' },
    { id: '2', title: 'Integrate Socket.io WebSocket Events', status: 'IN_PROGRESS', assignee: 'Alex' },
    { id: '3', title: 'Build Sunset Beach Pastel Theme', status: 'DONE', assignee: 'Manikya' }
  ]);
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server listening on port ${PORT}`));