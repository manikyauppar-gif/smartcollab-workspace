const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

// Configure Socket.io with explicit CORS and transports
const io = new Server(server, {
  cors: {
    origin: '*', // Allows Vercel and local connections
    methods: ['GET', 'POST']
  },
  transports: ['websocket', 'polling']
});

io.on('connection', (socket) => {
  console.log('⚡ User connected:', socket.id);

  socket.on('join_workspace', (room) => {
    socket.join(room);
    console.log(`User ${socket.id} joined room ${room}`);
  });

  socket.on('task_moved', (data) => {
    // Broadcast to everyone else in the workspace room
    socket.to(data.workspaceId || 'main-ws').emit('task_updated', data);
  });

  socket.on('task_added', (data) => {
    // Broadcast new task to everyone else in the workspace room
    socket.to(data.workspaceId || 'main-ws').emit('task_created', data.task);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));