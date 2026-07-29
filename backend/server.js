import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const app = express();

app.use(cors());
app.use(express.json());

const server = createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PATCH', 'DELETE']
  },
  transports: ['websocket', 'polling']
});

// Socket.io Real-Time Synchronization
io.on('connection', (socket) => {
  console.log('⚡ Client connected:', socket.id);

  socket.on('join_workspace', (room) => {
    socket.join(room);
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

// --- REST API ROUTES CONNECTED TO NEON POSTGRESQL ---

// 1. Fetch All Tasks
app.get('/api/tasks', async (req, res) => {
  try {
    const tasks = await prisma.task.findMany({
      orderBy: { createdAt: 'asc' }
    });

    // If database is empty, seed initial tasks so screen isn't blank
    if (tasks.length === 0) {
      await prisma.task.createMany({
        data: [
          { title: 'Design Database Schema for RBAC', status: 'TODO', assignee: 'Manikya' },
          { title: 'Integrate Socket.io WebSocket Events', status: 'IN_PROGRESS', assignee: 'Alex' },
          { title: 'Build Sunset Beach Pastel Theme', status: 'DONE', assignee: 'Manikya' }
        ]
      });
      const newTasks = await prisma.task.findMany({ orderBy: { createdAt: 'asc' } });
      return res.json(newTasks);
    }

    res.json(tasks);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: 'Database fetch failed' });
  }
});

// 2. Create New Task
app.post('/api/tasks', async (req, res) => {
  try {
    const { title, status, assignee } = req.body;
    const newTask = await prisma.task.create({
      data: {
        title,
        status: status || 'TODO',
        assignee: assignee || 'Manikya'
      }
    });
    res.status(201).json(newTask);
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ error: 'Failed to save task' });
  }
});

// 3. Update Task Status
app.patch('/api/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const updatedTask = await prisma.task.update({
      where: { id },
      data: { status }
    });

    res.json(updatedTask);
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server listening on port ${PORT}`));