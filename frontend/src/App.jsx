import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';

// Live Production Backend Server on Render
const BACKEND_URL = 'https://smartcollab-backend-idh4.onrender.com';

// Socket connection with explicit transports and reconnection policy
const socket = io(BACKEND_URL, {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
});

export default function App() {
  const [hasEntered, setHasEntered] = useState(false);
  const [tasks, setTasks] = useState([
    { id: '1', title: 'Design Database Schema for RBAC', status: 'TODO', assignee: 'Manikya' },
    { id: '2', title: 'Integrate Socket.io WebSocket Events', status: 'IN_PROGRESS', assignee: 'Alex' },
    { id: '3', title: 'Build Sunset Beach Pastel Theme', status: 'DONE', assignee: 'Manikya' }
  ]);
  const [toast, setToast] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newAssignee, setNewAssignee] = useState('Manikya');

  // Fetch initial tasks from Render PostgreSQL API & listen for WebSocket events
  useEffect(() => {
    socket.emit('join_workspace', 'main-ws');

    // Fetch stored tasks from production backend
    fetch(`${BACKEND_URL}/api/tasks`)
      .then(res => res.json())
      .then(data => {
        if (data && data.length > 0) setTasks(data);
      })
      .catch(() => console.log("Using default preset tasks"));

    // Real-Time Event: Task Moved by another user
    socket.on('task_updated', (data) => {
      const { taskId, newStatus, updatedBy } = data;
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
      setToast(`${updatedBy || 'Someone'} moved a task to ${newStatus.replace('_', ' ')}!`);
      setTimeout(() => setToast(null), 3500);
    });

    // Real-Time Event: New Task Added by another user
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

  const moveTask = (taskId, newStatus) => {
    // 1. Optimistic local UI update
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
    setToast(`You moved task to ${newStatus.replace('_', ' ')}!`);
    setTimeout(() => setToast(null), 3000);

    // 2. Persist update in database via API
    fetch(`${BACKEND_URL}/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    }).catch(err => console.error("Error updating task status:", err));

    // 3. Broadcast real-time change via WebSocket
    socket.emit('task_moved', { 
      workspaceId: 'main-ws', 
      taskId, 
      newStatus, 
      updatedBy: 'Manikya' 
    });
  };

  const handleAddTask = (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newTask = {
      id: Date.now().toString(),
      title: newTitle,
      status: 'TODO',
      assignee: newAssignee
    };

    // 1. Local state update
    setTasks(prev => [...prev, newTask]);
    setShowModal(false);
    setNewTitle('');
    setToast(`Added task: "${newTask.title}"`);
    setTimeout(() => setToast(null), 3000);

    // 2. Persist task to database via API
    fetch(`${BACKEND_URL}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newTask)
    }).catch(err => console.error("Error creating task:", err));

    // 3. Broadcast new task to connected peers
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
      {/* CSS Keyframe Animation for Floating Effect */}
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

      {/* Ambient Sunset Glow Backdrops */}
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
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#64748B', marginBottom: '6px' }}>
                Task Title
              </label>
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

              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#64748B', marginBottom: '6px' }}>
                Assignee
              </label>
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

      {!hasEntered ? (
        /* ==================== THE GATEWAY PORTAL ENTRANCE ==================== */
        <div style={{
          minHeight: '88vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative', maxWidth: '1280px', margin: '0 auto'
        }}>
          
          {/* LEFT SIDE FLOATING CARDS */}
          <div className="float-card-1" style={{
            position: 'absolute', left: '20px', top: '20%', width: '260px',
            backgroundColor: 'rgba(255, 253, 249, 0.85)', border: '1px solid #F5EBE0',
            padding: '20px', borderRadius: '24px', boxShadow: '0 10px 30px rgba(0,0,0,0.03)',
            backdropFilter: 'blur(12px)', display: 'flex', flexDirection: 'column', gap: '10px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '20px', padding: '8px', backgroundColor: '#E0F2FE', borderRadius: '12px' }}>⚡</span>
              <div>
                <h4 style={{ margin: 0, fontSize: '14px', color: '#1E293B', fontWeight: 'bold' }}>Real-Time Engine</h4>
                <p style={{ margin: 0, fontSize: '12px', color: '#64748B' }}>Socket.io Event Bus</p>
              </div>
            </div>
            <div style={{ fontSize: '11px', color: '#0369A1', backgroundColor: '#F0F9FF', padding: '8px 12px', borderRadius: '10px', fontWeight: '600' }}>
              ● Low Latency Broadcasts Active
            </div>
          </div>

          <div className="float-card-2" style={{
            position: 'absolute', left: '50px', bottom: '18%', width: '240px',
            backgroundColor: 'rgba(255, 253, 249, 0.85)', border: '1px solid #F5EBE0',
            padding: '18px', borderRadius: '24px', boxShadow: '0 10px 30px rgba(0,0,0,0.03)',
            backdropFilter: 'blur(12px)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <span style={{ fontSize: '18px' }}>👥</span>
              <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#1E293B' }}>Active Collaborators</span>
            </div>
            <div style={{ display: 'flex', gap: '6px', fontSize: '12px' }}>
              <span style={{ padding: '4px 10px', backgroundColor: '#FCE7F3', borderRadius: '8px', color: '#9D174D', fontWeight: '600' }}>Manikya</span>
              <span style={{ padding: '4px 10px', backgroundColor: '#FEF3C7', borderRadius: '8px', color: '#92400E', fontWeight: '600' }}>Alex</span>
            </div>
          </div>

          {/* CENTER PORTAL CARD */}
          <div style={{
            backgroundColor: 'rgba(255, 253, 249, 0.92)', backdropFilter: 'blur(20px)',
            border: '1px solid #F5EBE0', padding: '48px 36px', borderRadius: '36px',
            boxShadow: '0 25px 50px rgba(0,0,0,0.05)', textAlign: 'center',
            maxWidth: '440px', width: '100%', position: 'relative', zIndex: 10
          }}>
            <div style={{
              width: '68px', height: '68px', background: 'linear-gradient(135deg, #FCE7F3, #E0F2FE)',
              borderRadius: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 24px auto', fontSize: '32px', boxShadow: '0 8px 16px rgba(0,0,0,0.04)'
            }}>
              ✨
            </div>

            <h1 style={{ fontSize: '32px', fontWeight: '800', marginBottom: '8px', color: '#1E293B', letterSpacing: '-0.5px' }}>
              SmartCollab
            </h1>
            <p style={{ fontSize: '14px', color: '#64748B', marginBottom: '32px', lineHeight: '1.6' }}>
              Enterprise Real-Time Collaborative Workspace with Role-Based Access Control & WebSockets.
            </p>

            <button
              onClick={() => setHasEntered(true)}
              style={{
                width: '100%', padding: '18px 24px', background: 'linear-gradient(90deg, #A78BFA, #F472B6, #38BDF8)',
                color: 'white', border: 'none', borderRadius: '22px', fontWeight: 'bold', fontSize: '16px',
                cursor: 'pointer', boxShadow: '0 12px 28px rgba(167, 139, 250, 0.35)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px'
              }}
            >
              <span>Unlock Workspace</span>
              <span style={{ fontSize: '20px' }}>🗝️</span>
            </button>

            <div style={{ marginTop: '24px', fontSize: '12px', color: '#94A3B8', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', backgroundColor: '#34D399', borderRadius: '50%' }}></span>
              PostgreSQL + WebSockets Engine Online
            </div>
          </div>

          {/* RIGHT SIDE FLOATING CARDS */}
          <div className="float-card-2" style={{
            position: 'absolute', right: '20px', top: '22%', width: '250px',
            backgroundColor: 'rgba(255, 253, 249, 0.85)', border: '1px solid #F5EBE0',
            padding: '20px', borderRadius: '24px', boxShadow: '0 10px 30px rgba(0,0,0,0.03)',
            backdropFilter: 'blur(12px)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <span style={{ fontSize: '20px', padding: '8px', backgroundColor: '#D1FAE5', borderRadius: '12px' }}>🛡️</span>
              <div>
                <h4 style={{ margin: 0, fontSize: '14px', color: '#1E293B', fontWeight: 'bold' }}>RBAC Security</h4>
                <p style={{ margin: 0, fontSize: '12px', color: '#64748B' }}>JWT Protected</p>
              </div>
            </div>
            <p style={{ margin: 0, fontSize: '11px', color: '#047857', backgroundColor: '#ECFDF5', padding: '6px 10px', borderRadius: '8px', fontWeight: '500' }}>
              Admin / Editor / Viewer Roles
            </p>
          </div>

          <div className="float-card-1" style={{
            position: 'absolute', right: '50px', bottom: '16%', width: '260px',
            backgroundColor: 'rgba(255, 253, 249, 0.85)', border: '1px solid #F5EBE0',
            padding: '20px', borderRadius: '24px', boxShadow: '0 10px 30px rgba(0,0,0,0.03)',
            backdropFilter: 'blur(12px)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <span style={{ fontSize: '20px', padding: '8px', backgroundColor: '#FCE7F3', borderRadius: '12px' }}>🗄️</span>
              <div>
                <h4 style={{ margin: 0, fontSize: '14px', color: '#1E293B', fontWeight: 'bold' }}>PostgreSQL</h4>
                <p style={{ margin: 0, fontSize: '12px', color: '#64748B' }}>Prisma ORM Layer</p>
              </div>
            </div>
            <p style={{ margin: 0, fontSize: '11px', color: '#BE185D', backgroundColor: '#FDF2F8', padding: '6px 10px', borderRadius: '8px', fontWeight: '500' }}>
              Relational Schema & Indexing
            </p>
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
                <span style={{ fontSize: '12px', color: '#64748B' }}>Role: <strong style={{ color: '#8B5CF6' }}>Workspace Admin</strong></span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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

              <span style={{
                padding: '8px 16px', backgroundColor: '#E0F2FE', color: '#0369A1', borderRadius: '20px',
                fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px'
              }}>
                <span style={{ display: 'inline-block', width: '8px', height: '8px', backgroundColor: '#0284C7', borderRadius: '50%' }}></span>
                Live Sync Active
              </span>

              <button
                onClick={() => setHasEntered(false)}
                title="Exit Workspace"
                style={{
                  border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', color: '#64748B',
                  padding: '8px 14px', borderRadius: '16px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold'
                }}
              >
                🚪 Exit
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
                        {col.status !== 'DONE' && (
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