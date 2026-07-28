useEffect(() => {
  // Join default workspace room
  socket.emit('join_workspace', 'main-ws');

  // Fetch initial persistent tasks from backend API
  fetch('http://localhost:5000/api/tasks')
    .then(res => res.json())
    .then(data => {
      if (data && data.length > 0) setTasks(data);
    })
    .catch(() => console.log("Using default preset tasks"));

  // Listen for real-time WebSocket updates
  socket.on('task_updated', (data) => {
    const { taskId, newStatus, updatedBy } = data;
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
    setToast(`${updatedBy} moved a task to ${newStatus.replace('_', ' ')}!`);
    setTimeout(() => setToast(null), 3500);
  });

  socket.on('task_created', (newTask) => {
    setTasks(prev => [...prev, newTask]);
    setToast(`New task added: "${newTask.title}"`);
    setTimeout(() => setToast(null), 3500);
  });

  return () => {
    socket.off('task_updated');
    socket.off('task_created');
  };
}, []);