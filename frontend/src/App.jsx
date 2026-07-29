import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

const BACKEND_URL = 'https://smartcollab-backend-idh4.onrender.com';

const socket = io(BACKEND_URL, {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
});

export default function App() {
  // Always default user to null on initial load so login screen appears
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('smartcollab_token') || '');
  const [isRegistering, setIsRegistering] = useState(false);
  const [authError, setAuthError] = useState('');
  
  // Auth Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('ADMIN');

  // Workspace State
  const [tasks, setTasks] = useState([
    { id: '1', title: 'Design Database Schema for RBAC', status: 'TODO', assignee: 'Manikya' },
    { id: '2', title: 'Integrate Socket.io WebSocket Events', status: 'IN_PROGRESS', assignee: 'Alex' },
    { id: '3', title: 'Build Sunset Beach Pastel Theme', status: 'DONE', assignee: 'Manikya' }
  ]);
  const [toast, setToast] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newAssignee, setNewAssignee] = useState('Manikya');

  // Load saved session on mount if available
  useEffect(() => {
    const saved = localStorage.getItem('smartcollab_user');
    if (saved) {
      try {
        setUser(JSON.parse(saved));
      } catch (e) {
        localStorage.removeItem('smartcollab_user');
      }
    }
  }, []);

  // Fetch initial tasks & subscribe to Socket events
  useEffect(() => {
    socket.emit('join_workspace', 'main-ws');

    fetch(`${BACKEND_URL}/api/tasks`)
      .then(res => res.json())
      .then(data => {
        if (data && data.length > 0) setTasks(data);
      })
      .catch(() => console.log("Using default preset tasks"));

    socket.on('task_updated', (data) => {
      const { taskId, newStatus, updatedBy } = data;
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
      setToast(`${updatedBy || 'Someone'} moved a task to ${newStatus.replace('_', ' ')}!`);
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

  // Auth Handlers
  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError('');

    const endpoint = isRegistering ? '/api/auth/register' : '/api/auth/login';
    const payload = isRegistering 
      ? { name, email, password, role }
      : { email, password };

    try {
      const res = await fetch(`${BACKEND_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Authentication failed');

      setUser(data.user);
      setToken(data.token);
      localStorage.setItem('smartcollab_user', JSON.stringify(data.user));
      localStorage.setItem('smartcollab_token', data.token);
      setToast(`Welcome, ${data.user.name}! (${data.user.role})`);
      setTimeout(() => setToast(null), 3000);
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setToken('');
    localStorage.removeItem('smartcollab_user');
    localStorage.removeItem('smartcollab_token');
  };

  // Drag and Drop Handler
  const onDragEnd = (result) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    if (user?.role === 'VIEWER') {
      setToast('⚠️ Viewers cannot move tasks.');
      setTimeout(() => setToast(null), 3000);
      return;
    }

    const newStatus = destination.droppableId;

    setTasks(prev => prev.map(t => t.id === draggableId ? { ...t, status: newStatus } : t));
    setToast(`Task moved to ${newStatus.replace('_', ' ')}!`);
    setTimeout(() => setToast(null), 3000);

    fetch(`${BACKEND_URL}/api/tasks/${draggableId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    }).catch(err => console.error("Error updating task status:", err));

    socket.emit('task_moved', { 
      workspaceId: 'main-ws', 
      taskId: draggableId, 
      newStatus, 
      updatedBy: user?.name || 'User' 
    });
  };

  const handleAddTask = (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    if (user?.role === 'VIEWER') {
      setToast('⚠️ Viewers cannot create tasks.');
      setTimeout(() => setToast(null), 3000);
      return;
    }

    const newTask = {
      id: Date.now().toString(),
      title: newTitle,
      status: 'TODO',
      assignee: newAssignee
    };

    setTasks(prev => [...prev, newTask]);
    setShowModal(false);
    setNewTitle('');
    setToast(`Added task: "${newTask.title}"`);
    setTimeout(() => setToast(null), 3000);

    fetch(`${BACKEND_URL}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newTask)
    }).catch(err => console.error("Error creating task:", err));

    socket.emit('task_added', { workspaceId: 'main-ws', task: newTask });
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#FDF6EE',
      color: '#2D3748',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      position: 'relative',
      overflow: 'hidden',
      padding: '24px'
    }}>
      <style>{`
        @keyframes floatSlow {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        @keyframes floatReverse {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(10px); }
        }
        .float-card-1 { animation: floatSlow 6s ease-in-out infinite; }
        .float-card-2 { animation: floatReverse 7s ease-in-out infinite; }
      `}</style>

      {/* Ambient Glows */}
      <div style={{
        position: 'absolute', top: '-100px', left: '-100px', width: '500px', height: '500px',
        backgroundColor: '#FCE7F3', borderRadius: '50%', filter: 'blur(100px)', opacity: 0.8, pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute', bottom: '-100px', right: '-100px', width: '600px', height: '600px',
        backgroundColor: '#E0F2FE', borderRadius: '50%', filter: 'blur(110px)', opacity: 0.8, pointerEvents: 'none'
      }} />

      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed', top: '24px', right: '24px', zIndex: 100,
          backgroundColor: '#D1FAE5', border: '1px solid #A7F3D0', color: '#065F46',
          padding: '12px 20px', borderRadius: '16px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)',
          display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', fontSize: '14px'
        }}>
          🔔 {toast}
        </div>
      )}

      {/* Add Task Modal */}
      {showModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200
        }}>
          <div style={{
            backgroundColor: '#FFFDF9', padding: '32px', borderRadius: '28px',
            border: '1px solid #F5EBE0', width: '100%', maxWidth: '400px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '20px', color: '#1E293B' }}>✨ Add New Task</h3>
            <form onSubmit={handleAddTask}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#64748B', marginBottom: '6px' }}>Task Title</label>
              <input 
                type="text"
                placeholder="e.g., Implement JWT Auth Middleware"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                style={{
                  width: '100%', padding: '12px 16px', borderRadius: '14px',
                  border: '1px solid #E2E8F0', outline: 'none', marginBottom: '16px',
                  fontSize: '14px', backgroundColor: '#FFFFFF'
                }}
                autoFocus
              />

              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#64748B', marginBottom: '6px' }}>Assignee</label>
              <select 
                value={newAssignee}
                onChange={(e) => setNewAssignee(e.target.value)}
                style={{
                  width: '100%', padding: '12px 16px', borderRadius: '14px',
                  border: '1px solid #E2E8F0', outline: 'none', marginBottom: '24px',
                  fontSize: '14px', backgroundColor: '#FFFFFF'
                }}
              >
                <option value="Manikya">Manikya</option>
                <option value="Alex">Alex</option>
                <option value="Team Member">Team Member</option>
              </select>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{
                    padding: '10px 18px', border: 'none', backgroundColor: '#F1F5F9',
                    color: '#64748B', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '10px 20px', border: 'none',
                    background: 'linear-gradient(90deg, #A78BFA, #F472B6)',
                    color: 'white', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold',
                    boxShadow: '0 4px 12px rgba(167, 139, 250, 0.3)'
                  }}
                >
                  Create Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {!user ? (
        /* ==================== ENTRANCE PORTAL & AUTH FORM ==================== */
        <div style={{
          minHeight: '88vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative', maxWidth: '1280px', margin: '0 auto'
        }}>
          {/* FLOATING DECORATIONS */}
          <div className="float-card-1" style={{
            position: 'absolute', left: '20px', top: '20%', width: '260px',
            backgroundColor: 'rgba(255, 253, 249, 0.85)', border: '1px solid #F5EBE0',
            padding: '20px', borderRadius: '24px', boxShadow: '0 10px 30px rgba(0,0,0,0.03)',
            backdropFilter: 'blur(12px)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '20px', padding: '8px', backgroundColor: '#E0F2FE', borderRadius: '12px' }}>⚡</span>
              <div>
                <h4 style={{ margin: 0, fontSize: '14px', color: '#1E293B', fontWeight: 'bold' }}>Real-Time Engine</h4>
                <p style={{ margin: 0, fontSize: '12px', color: '#64748B' }}>Socket.io Event Bus</p>
              </div>
            </div>
          </div>

          <div className="float-card-2" style={{
            position: 'absolute', right: '20px', top: '22%', width: '250px',
            backgroundColor: 'rgba(255, 253, 249, 0.85)', border: '1px solid #F5EBE0',
            padding: '20px', borderRadius: '24px', boxShadow: '0 10px 30px rgba(0,0,0,0.03)',
            backdropFilter: 'blur(12px)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '20px', padding: '8px', backgroundColor: '#D1FAE5', borderRadius: '12px' }}>🛡️</span>
              <div>
                <h4 style={{ margin: 0, fontSize: '14px', color: '#1E293B', fontWeight: 'bold' }}>RBAC Security</h4>
                <p style={{ margin: 0, fontSize: '12px', color: '#64748B' }}>JWT Protected</p>
              </div>
            </div>
          </div>

          {/* MAIN AUTH CARD */}
          <div style={{
            backgroundColor: 'rgba(255, 253, 249, 0.95)', backdropFilter: 'blur(20px)',
            border: '1px solid #F5EBE0', padding: '40px 36px', borderRadius: '36px',
            boxShadow: '0 25px 50px rgba(0,0,0,0.05)', textAlign: 'center',
            maxWidth: '420px', width: '100%', position: 'relative', zIndex: 10
          }}>
            <div style={{
              width: '60px', height: '60px', background: 'linear-gradient(135deg, #FCE7F3, #E0F2FE)',
              borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px auto', fontSize: '28px', boxShadow: '0 8px 16px rgba(0,0,0,0.04)'
            }}>
              ✨
            </div>

            <h1 style={{ fontSize: '28px', fontWeight: '800', marginBottom: '6px', color: '#1E293B' }}>
              SmartCollab
            </h1>
            <p style={{ fontSize: '13px', color: '#64748B', marginBottom: '24px' }}>
              {isRegistering ? 'Create your collaborative account' : 'Log in to access your workspace'}
            </p>

            {authError && (
              <div style={{
                padding: '10px 14px', backgroundColor: '#FEE2E2', color: '#991B1B',
                borderRadius: '12px', fontSize: '12px', fontWeight: 'bold', marginBottom: '16px'
              }}>
                ⚠️ {authError}
              </div>
            )}

            <form onSubmit={handleAuth} style={{ textAlign: 'left' }}>
              {isRegistering && (
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#64748B', marginBottom: '4px' }}>Full Name</label>
                  <input 
                    type="text" 
                    placeholder="Manikya Uppar"
                    value={name} 
                    onChange={e => setName(e.target.value)}
                    required
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid #CBD5E1', outline: 'none', fontSize: '13px' }}
                  />
                </div>
              )}

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#64748B', marginBottom: '4px' }}>Email Address</label>
                <input 
                  type="email" 
                  placeholder="manikya@example.com"
                  value={email} 
                  onChange={e => setEmail(e.target.value)}
                  required
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid #CBD5E1', outline: 'none', fontSize: '13px' }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#64748B', marginBottom: '4px' }}>Password</label>
                <input 
                  type="password" 
                  placeholder="••••••••"
                  value={password} 
                  onChange={e => setPassword(e.target.value)}
                  required
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid #CBD5E1', outline: 'none', fontSize: '13px' }}
                />
              </div>

              {isRegistering && (
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#64748B', marginBottom: '4px' }}>Select Role</label>
                  <select 
                    value={role} 
                    onChange={e => setRole(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid #CBD5E1', outline: 'none', fontSize: '13px', backgroundColor: '#FFFFFF' }}
                  >
                    <option value="ADMIN">ADMIN (Full Access)</option>
                    <option value="EDITOR">EDITOR (Move & Add Tasks)</option>
                    <option value="VIEWER">VIEWER (Read Only)</option>
                  </select>
                </div>
              )}

              <button
                type="submit"
                style={{
                  width: '100%', padding: '14px', background: 'linear-gradient(90deg, #A78BFA, #F472B6, #38BDF8)',
                  color: 'white', border: 'none', borderRadius: '16px', fontWeight: 'bold', fontSize: '14px',
                  cursor: 'pointer', boxShadow: '0 8px 20px rgba(167, 139, 250, 0.35)', marginBottom: '16px'
                }}
              >
                {isRegistering ? 'Create Account 🚀' : 'Unlock Workspace 🗝️'}
              </button>
            </form>

            <button
              onClick={() => { setIsRegistering(!isRegistering); setAuthError(''); }}
              style={{ background: 'none', border: 'none', color: '#8B5CF6', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              {isRegistering ? 'Already have an account? Log In' : "Don't have an account? Sign Up"}
            </button>
          </div>
        </div>
      ) : (
        /* ==================== MAIN WORKSPACE DASHBOARD ==================== */
        <div style={{ maxWidth: '1100px', margin: '0 auto', position: 'relative', zIndex: 10 }}>
          {/* Header */}
          <header style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            backgroundColor: 'rgba(255, 253, 249, 0.85)', padding: '20px 28px',
            borderRadius: '24px', border: '1px solid #F5EBE0', marginBottom: '32px',
            boxShadow: '0 4px 15px rgba(0,0,0,0.02)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ padding: '12px', backgroundColor: '#FCE7F3', borderRadius: '16px', fontSize: '22px' }}>
                📋
              </div>
              <div>
                <h1 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0, color: '#1E293B' }}>Main Engineering Workspace</h1>
                <span style={{ fontSize: '12px', color: '#64748B' }}>
                  User: <strong>{user.name}</strong> | Role: <strong style={{ color: user.role === 'ADMIN' ? '#8B5CF6' : user.role === 'EDITOR' ? '#0284C7' : '#D97706' }}>{user.role}</strong>
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {user.role !== 'VIEWER' ? (
                <button
                  onClick={() => setShowModal(true)}
                  style={{
                    border: 'none', background: 'linear-gradient(90deg, #A78BFA, #F472B6)',
                    color: 'white', padding: '8px 16px', borderRadius: '16px',
                    cursor: 'pointer', fontWeight: 'bold', fontSize: '13px',
                    boxShadow: '0 4px 12px rgba(167, 139, 250, 0.3)'
                  }}
                >
                  + Add Task
                </button>
              ) : (
                <span style={{ fontSize: '12px', padding: '6px 12px', backgroundColor: '#FEF3C7', color: '#92400E', borderRadius: '12px', fontWeight: 'bold' }}>
                  🔒 Read Only Mode
                </span>
              )}

              <button
                onClick={handleLogout}
                style={{
                  border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', color: '#64748B',
                  padding: '8px 14px', borderRadius: '16px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold'
                }}
              >
                🚪 Log Out
              </button>
            </div>
          </header>

          {/* Drag and Drop Kanban Context */}
          <DragDropContext onDragEnd={onDragEnd}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
              {[
                { title: 'To Do', status: 'TODO', bg: '#FEF3C7', color: '#92400E' },
                { title: 'In Progress', status: 'IN_PROGRESS', bg: '#E0F2FE', color: '#075985' },
                { title: 'Completed', status: 'DONE', bg: '#D1FAE5', color: '#065F46' }
              ].map(col => {
                const colTasks = tasks.filter(t => t.status === col.status);

                return (
                  <Droppable key={col.status} droppableId={col.status}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        style={{
                          backgroundColor: snapshot.isDraggingOver ? '#F1F5F9' : 'rgba(255, 253, 249, 0.75)',
                          border: '1px solid #F5EBE0',
                          padding: '24px', borderRadius: '28px', minHeight: '450px',
                          transition: 'background-color 0.2s ease'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                          <span style={{
                            padding: '6px 14px', borderRadius: '14px', backgroundColor: col.bg, color: col.color,
                            fontSize: '12px', fontWeight: 'bold'
                          }}>
                            {col.title}
                          </span>
                          <span style={{ fontSize: '12px', color: '#94A3B8', fontWeight: '600' }}>
                            {colTasks.length} tasks
                          </span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', minHeight: '350px' }}>
                          {colTasks.map((task, index) => (
                            <Draggable key={task.id} draggableId={task.id} index={index} isDragDisabled={user.role === 'VIEWER'}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  style={{
                                    backgroundColor: '#FFFFFF',
                                    border: '1px solid #F5EBE0',
                                    padding: '18px',
                                    borderRadius: '20px',
                                    boxShadow: snapshot.isDragging 
                                      ? '0 15px 30px rgba(0,0,0,0.15)' 
                                      : '0 4px 12px rgba(0,0,0,0.02)',
                                    cursor: user.role === 'VIEWER' ? 'not-allowed' : 'grab',
                                    ...provided.draggableProps.style
                                  }}
                                >
                                  <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#1E293B', fontWeight: '600' }}>
                                    {task.title}
                                  </h4>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#64748B' }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                      👤 {task.assignee}
                                    </span>
                                    <span style={{ fontSize: '10px', backgroundColor: '#F1F5F9', padding: '4px 8px', borderRadius: '8px', color: '#64748B' }}>
                                      ⋮⋮ Drag
                                    </span>
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      </div>
                    )}
                  </Droppable>
                );
              })}
            </div>
          </DragDropContext>
        </div>
      )}
    </div>
  );
}