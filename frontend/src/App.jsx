import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';

const BACKEND_URL = 'https://smartcollab-backend-idh4.onrender.com';

const socket = io(BACKEND_URL, {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
});

export default function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState('');
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
      setToast(`Welcome, ${data.user.name}! (${data.user.role})`);
      setTimeout(() => setToast(null), 3000);
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setToken('');
  };

  const moveTask = (taskId, newStatus) => {
    if (user?.role === 'VIEWER') {
      setToast('⚠️ Viewers cannot modify tasks.');
      setTimeout(() => setToast(null), 3000);
      return;
    }

    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
    setToast(`You moved task to ${newStatus.replace('_', ' ')}!`);
    setTimeout(() => setToast(null), 3000);

    fetch(`${BACKEND_URL}/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    }).catch(err => console.error("Error updating task status:", err));

    socket.emit('task_moved', { 
      workspaceId: 'main-ws', 
      taskId, 
      newStatus, 
      updatedBy: user?.name || 'Manikya' 
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
                    color: 'white', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold'
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
          maxWidth: '1280px', margin: '0 auto'
        }}>
          <div style={{
            backgroundColor: 'rgba(255, 253, 249, 0.95)',
            border: '1px solid #F5EBE0', padding: '40px 36px', borderRadius: '36px',
            boxShadow: '0 25px 50px rgba(0,0,0,0.05)', textAlign: 'center',
            maxWidth: '420px', width: '100%'
          }}>
            <div style={{
              width: '60px', height: '60px', background: 'linear-gradient(135deg, #FCE7F3, #E0F2FE)',
              borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px auto', fontSize: '28px'
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
                  cursor: 'pointer', marginBottom: '16px'
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
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          {/* Header */}
          <header style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            backgroundColor: 'rgba(255, 253, 249, 0.85)', padding: '20px 28px',
            borderRadius: '24px', border: '1px solid #F5EBE0', marginBottom: '32px'
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
                    cursor: 'pointer', fontWeight: 'bold', fontSize: '13px'
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

          {/* Kanban Columns */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
            {[
              { title: 'To Do', status: 'TODO', bg: '#FEF3C7', color: '#92400E' },
              { title: 'In Progress', status: 'IN_PROGRESS', bg: '#E0F2FE', color: '#075985' },
              { title: 'Completed', status: 'DONE', bg: '#D1FAE5', color: '#065F46' }
            ].map(col => (
              <div key={col.status} style={{
                backgroundColor: 'rgba(255, 253, 249, 0.75)', border: '1px solid #F5EBE0',
                padding: '24px', borderRadius: '28px', minHeight: '450px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <span style={{
                    padding: '6px 14px', borderRadius: '14px', backgroundColor: col.bg, color: col.color,
                    fontSize: '12px', fontWeight: 'bold'
                  }}>
                    {col.title}
                  </span>
                  <span style={{ fontSize: '12px', color: '#94A3B8', fontWeight: '600' }}>
                    {tasks.filter(t => t.status === col.status).length} tasks
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {tasks.filter(t => t.status === col.status).map(task => (
                    <div 
                      key={task.id}
                      style={{
                        backgroundColor: '#FFFFFF', border: '1px solid #F5EBE0', padding: '18px',
                        borderRadius: '20px', boxShadow: '0 4px 12px rgba(0,0,0,0.02)'
                      }}
                    >
                      <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#1E293B', fontWeight: '600' }}>{task.title}</h4>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#64748B' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          👤 {task.assignee}
                        </span>
                        {col.status !== 'DONE' && user.role !== 'VIEWER' && (
                          <button 
                            onClick={() => moveTask(task.id, col.status === 'TODO' ? 'IN_PROGRESS' : 'DONE')}
                            style={{
                              border: 'none', backgroundColor: '#F3E8FF', color: '#6B21A8',
                              padding: '6px 14px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold'
                            }}
                          >
                            Move ➔
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}