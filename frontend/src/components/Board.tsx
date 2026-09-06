import {
  DndContext,
  DragOverlay,
  PointerSensor,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
  useSensor,
  useSensors,
  defaultDropAnimationSideEffects,
  type DropAnimation,
} from '@dnd-kit/core';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, AlertCircle, MapPin, Edit2, Trash2, LogOut, Search, Bell, ArrowLeft } from 'lucide-react';
import { Moon, Sun, MessageSquare, Calendar as CalendarIcon, Phone } from 'lucide-react';
import { useEffect, useMemo, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useTasks } from '../hooks/useTasks';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useTheme } from '../context/ThemeContext';
import type { NoteColor, Task, TaskStatus } from '../types';
import { COLUMNS } from '../types';
import Column from './Column';
import ConfirmDialog from './ConfirmDialog';
import DragGhost from './DragGhost';
import TaskModal from './TaskModal';
import ChatPanel from './ChatPanel';
import VoiceChat from './VoiceChat';
import CalendarView from './CalendarView';

interface Activity {
  id: string;
  message: string;
  time: Date;
}

export default function Board() {
  const { id: roomId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isPersonal = !roomId || roomId === 'personal';
  const actualRoomId = isPersonal ? undefined : roomId;

  const { user, token } = useAuth();
  const { socket, isConnected } = useSocket();
  const { theme, toggleTheme } = useTheme();
  const { tasks, setTasks, addTask, updateTask, deleteTask, moveTask } = useTasks(actualRoomId);

  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Task | null>(null);
  const [shakeColumn, setShakeColumn] = useState<TaskStatus | null>(null);
  const [dragDeltaX, setDragDeltaX] = useState(0);

  // Live cursors state
  const [cursors, setCursors] = useState<{ [id: string]: { x: number, y: number, user: any } }>({});

  // Pro Features State
  const [searchQuery, setSearchQuery] = useState('');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [activityLog, setActivityLog] = useState<Activity[]>([]);
  const [hasUnread, setHasUnread] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [isCalendarView, setIsCalendarView] = useState(false);
  const [userRole, setUserRole] = useState<'owner' | 'editor' | 'viewer'>('editor'); // default editor for personal

  // Fetch Room Role
  useEffect(() => {
    if (actualRoomId && token) {
      fetch(`${import.meta.env.VITE_API_URL || ''}/api/rooms/${actualRoomId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => {
        if (data.members) {
          const myMembership = data.members.find((m: any) => {
            // Handle new schema (object with user) or old schema (string/ObjectId)
            if (m.user && m.user._id) return m.user._id === user?.id;
            return m === user?.id || (m._id && m._id === user?.id);
          });
          if (myMembership && myMembership.role) {
            setUserRole(myMembership.role);
          } else {
            // Fallback for old rooms
            setUserRole('editor');
          }
        }
      })
      .catch(err => console.error(err));
    } else {
      setUserRole('editor');
    }
  }, [actualRoomId, token, user]);

  // Room Join and Socket Events
  useEffect(() => {
    if (socket && isConnected && actualRoomId) {
      socket.emit('join-room', actualRoomId);

      const onTaskAdded = (newTask: any) => {
        const task = { ...newTask, id: newTask._id || newTask.id };
        setTasks(prev => {
          if (prev.find(t => t.id === task.id)) return prev;
          return [...prev, task];
        });
      };

      const onTaskUpdated = (updatedTask: any) => {
        const task = { ...updatedTask, id: updatedTask._id || updatedTask.id };
        setTasks(prev => prev.map(t => t.id === task.id ? task : t));
      };

      const onTaskDeleted = (taskId: string) => {
        setTasks(prev => prev.filter(t => t.id !== taskId));
      };

      const onCursorMove = (data: any) => {
        setCursors(prev => ({
          ...prev,
          [data.socketId]: data
        }));
        // Remove cursor after inactivity
        setTimeout(() => {
          setCursors(p => {
            const copy = { ...p };
            delete copy[data.socketId];
            return copy;
          });
        }, 5000);
      };

      socket.on('task-added', onTaskAdded);
      socket.on('task-updated', onTaskUpdated);
      socket.on('task-deleted', onTaskDeleted);
      socket.on('cursor-move', onCursorMove);

      return () => {
        socket.off('task-added', onTaskAdded);
        socket.off('task-updated', onTaskUpdated);
        socket.off('task-deleted', onTaskDeleted);
        socket.off('cursor-move', onCursorMove);
      };
    }
  }, [socket, isConnected, actualRoomId, setTasks]);

  // Track mouse move for cursor syncing
  useEffect(() => {
    if (socket && isConnected && actualRoomId && user) {
      const handleMouseMove = (e: MouseEvent) => {
        // Send normalized coordinates
        const x = e.clientX / window.innerWidth;
        const y = e.clientY / window.innerHeight;
        socket.emit('cursor-move', {
          roomId: actualRoomId,
          x,
          y,
          socketId: socket.id,
          user: { name: user.name || user.email, avatar: user.avatar }
        });
      };
      
      // Throttle mouse moves (very naive implementation for demo)
      let timeout: any;
      const throttledMove = (e: MouseEvent) => {
        if (timeout) return;
        timeout = setTimeout(() => {
          handleMouseMove(e);
          timeout = null;
        }, 50);
      };

      window.addEventListener('mousemove', throttledMove);
      return () => window.removeEventListener('mousemove', throttledMove);
    }
  }, [socket, isConnected, actualRoomId, user]);

  
  const notifRef = useRef<HTMLDivElement>(null);
  const notifiedTasks = useRef<Set<string>>(new Set());

  // Deadline notifications
  useEffect(() => {
    const now = new Date().getTime();
    const fortyEightHours = 48 * 60 * 60 * 1000;

    tasks.forEach(task => {
      if (task.status === 'done' || !task.dueDate) return;
      
      const dueTime = new Date(task.dueDate).getTime();
      const timeUntilDue = dueTime - now;

      // Notify if due within 48 hours OR overdue
      if (timeUntilDue <= fortyEightHours) {
        if (!notifiedTasks.current.has(task.id)) {
          notifiedTasks.current.add(task.id);
          const isOverdue = timeUntilDue < 0;
          toast(
            isOverdue 
              ? `Task "${task.title}" is OVERDUE!` 
              : `Task "${task.title}" is due soon!`, 
            {
              icon: isOverdue ? '🚨' : '⚠️',
              style: { 
                border: `1px solid ${isOverdue ? '#dc2626' : '#f59e0b'}`, 
                padding: '16px', 
                color: isOverdue ? '#991b1b' : '#92400e' 
              },
              duration: 6000,
            }
          );
          addActivity(isOverdue ? `Overdue alert for "${task.title}"` : `Deadline warning for "${task.title}"`);
        }
      }
    });
  }, [tasks]);

  // Close notifications on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const addActivity = (message: string) => {
    setActivityLog(prev => [{ id: Math.random().toString(), message, time: new Date() }, ...prev]);
    setHasUnread(true);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const tasksByStatus = useMemo(() => {
    const map: Record<TaskStatus, Task[]> = { todo: [], 'in-progress': [], done: [] };
    const lowerQuery = searchQuery.toLowerCase();
    
    for (const t of tasks) {
      if (
        lowerQuery === '' || 
        t.title.toLowerCase().includes(lowerQuery) || 
        t.description.toLowerCase().includes(lowerQuery)
      ) {
        map[t.status].push(t);
      }
    }
    return map;
  }, [tasks, searchQuery]);

  function handleDragStart(event: DragStartEvent) {
    if (userRole === 'viewer') return;
    const task = tasks.find((t) => t.id === event.active.id);
    setActiveTask(task ?? null);
    setDragDeltaX(0);
  }

  function handleDragMove(event: DragMoveEvent) {
    setDragDeltaX(event.delta.x);
  }

  function handleDragEnd(event: DragEndEvent) {
    if (userRole === 'viewer') return;
    const { active, over } = event;
    setActiveTask(null);
    setDragDeltaX(0);
    if (!over) return;

    const task = tasks.find((t) => t.id === active.id);
    if (!task) return;
    const target = over.id as TaskStatus;
    if (target === task.status) {
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10);
      return;
    }

    const result = moveTask(task.id, target);
    if (result.ok === false && 'reason' in result) {
      setShakeColumn(target);
      setTimeout(() => setShakeColumn(null), 420);
      const message =
        result.reason === 'terminal'
          ? 'Done is final — this task can\'t move back.'
          : 'Must pass through "In Progress" first.';
      toast.error(message, { icon: <AlertCircle size={18} color="#EF4444" /> });
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([10, 30, 10]);
      return;
    }

    const label = COLUMNS.find((c) => c.id === target)?.title;
    toast.success(`Moved to ${label}`, { icon: <MapPin size={18} color="#10B981" /> });
    addActivity(`Moved "${task.title}" to ${label}`);
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(15);
  }

  function openAddModal() {
    if (userRole === 'viewer') {
      toast.error("Viewers cannot add tasks");
      return;
    }
    setModalMode('add');
    setEditingTask(null);
    setModalOpen(true);
  }

  function openEditModal(task: Task) {
    if (userRole === 'viewer') {
      toast.error("Viewers cannot edit tasks");
      return;
    }
    setModalMode('edit');
    setEditingTask(task);
    setModalOpen(true);
  }

  async function handleModalSubmit(title: string, description: string, color: NoteColor, dueDate?: string | null) {
    if (modalMode === 'add') {
      await addTask(title, description, color, dueDate);
      toast.success('Task pinned to the board');
      addActivity(`Created task "${title}"`);
    } else if (editingTask) {
      await updateTask(editingTask.id, { title, description, color, dueDate });
      toast.success('Task updated', { icon: <Edit2 size={18} color="#F59E0B" /> });
      addActivity(`Updated task "${title}"`);
    }
    setModalOpen(false);
  }

  function handleConfirmDelete() {
    if (pendingDelete) {
      deleteTask(pendingDelete.id);
      toast('Note removed', { icon: <Trash2 size={18} color="#6B7280" /> });
      addActivity(`Deleted task "${pendingDelete.title}"`);
      setPendingDelete(null);
    }
  }

  const dropAnimationConfig: DropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: {
        active: {
          opacity: '0.95',
        },
      },
    }),
    duration: 250,
    easing: 'cubic-bezier(0.18, 0.89, 0.32, 1.28)',
  };

  const toggleNotifications = () => {
    setNotificationsOpen(!notificationsOpen);
    if (!notificationsOpen) setHasUnread(false);
  };

  return (
    <div className="board-page">
      <header className="board-header">
        <div className="board-brand">
          <button 
            className="btn-back" 
            onClick={() => navigate('/dashboard')}
            title="Back to Dashboard"
          >
            <ArrowLeft size={20} strokeWidth={2.5} />
          </button>
          <div className="brand-title">
            <h1>SynchBoard</h1>
            <span className="board-badge">{actualRoomId ? 'Team Board' : 'Personal Board'}</span>
          </div>
        </div>
        
        <div className="board-tools">
          <button
            className="btn btn-ghost"
            title="Toggle Dark Mode"
            onClick={toggleTheme}
          >
            {theme === 'dark' ? <Sun size={18} color="var(--ink-soft)" /> : <Moon size={18} color="var(--ink-soft)" />}
          </button>
          
          <div className="search-bar">
            <Search size={16} color="var(--ink-soft)" />
            <input 
              type="text" 
              placeholder="Search tasks..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <button 
            className="btn btn-ghost" 
            title="Toggle Calendar View"
            onClick={() => setIsCalendarView(!isCalendarView)}
          >
            <CalendarIcon size={18} color={isCalendarView ? "#3B82F6" : "var(--ink-soft)"} />
          </button>

          {actualRoomId && (
            <>
              <button 
                className="btn btn-ghost" 
                title="Toggle Room Chat"
                onClick={() => setIsChatOpen(!isChatOpen)}
              >
                <MessageSquare size={18} color={isChatOpen ? "#3B82F6" : "var(--ink-soft)"} />
              </button>

              <button 
                className="btn btn-ghost" 
                title="Join Voice Channel"
                onClick={() => setIsVoiceOpen(true)}
              >
                <Phone size={18} color="var(--ink-soft)" />
              </button>
            </>
          )}

          <div className="notification-wrapper" ref={notifRef}>
            <button className="notification-bell" onClick={toggleNotifications}>
              <Bell size={20} strokeWidth={2.4} />
              {hasUnread && <span className="notification-dot" />}
            </button>
            
            <AnimatePresence>
              {notificationsOpen && (
                <motion.div 
                  className="notification-dropdown"
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="notification-header">
                    <span>Activity Log</span>
                    {activityLog.length > 0 && (
                      <button className="notification-clear" onClick={() => setActivityLog([])}>
                        Clear all
                      </button>
                    )}
                  </div>
                  <div className="notification-list">
                    {activityLog.length === 0 ? (
                      <div className="notification-empty">No recent activity.</div>
                    ) : (
                      activityLog.map(act => (
                        <div key={act.id} className="notification-item">
                          <span>{act.message}</span>
                          <span className="notification-time">
                            {act.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink-soft)', marginLeft: '8px', display: 'none' }} className="user-email-display">
            {user?.email}
          </span>
          
          {userRole !== 'viewer' && (
            <motion.button
              type="button"
              className="btn btn-add"
              onClick={openAddModal}
              whileHover={{ scale: 1.04, y: -2 }}
              whileTap={{ scale: 0.96 }}
            >
              <Plus size={18} strokeWidth={2.6} />
              Add task
            </motion.button>
          )}
          

        </div>
      </header>

      <main className="board-frame relative flex">
        {isCalendarView ? (
          <div className="w-full h-full p-4">
             <CalendarView tasks={tasks} />
          </div>
        ) : (
          <div className="board-frame-inner flex-1">
            <DndContext
              sensors={sensors}
              onDragStart={handleDragStart}
              onDragMove={handleDragMove}
              onDragEnd={handleDragEnd}
            >
              <div className="board-columns">
                {COLUMNS.map((col) => (
                  <div key={col.id} className={shakeColumn === col.id ? 'shake-wrap' : ''}>
                    <Column
                      config={col}
                      tasks={tasksByStatus[col.id]}
                      activeTask={activeTask}
                      onEdit={openEditModal}
                      onRequestDelete={setPendingDelete}
                    />
                  </div>
                ))}
              </div>
              <DragOverlay dropAnimation={dropAnimationConfig}>
                {activeTask ? <DragGhost task={activeTask} tiltDelta={dragDeltaX} /> : null}
              </DragOverlay>
            </DndContext>
          </div>
        )}
        <div className="board-tray" aria-hidden="true" />
      </main>

      {actualRoomId && (
        <ChatPanel 
          roomId={actualRoomId} 
          isOpen={isChatOpen} 
          onClose={() => setIsChatOpen(false)} 
        />
      )}

      {isVoiceOpen && actualRoomId && (
        <div className="fixed bottom-4 left-4 z-50">
          <VoiceChat roomId={actualRoomId} onLeave={() => setIsVoiceOpen(false)} />
        </div>
      )}

      <TaskModal
        open={modalOpen}
        mode={modalMode}
        initial={editingTask}
        onClose={() => setModalOpen(false)}
        onSubmit={handleModalSubmit}
      />

      <ConfirmDialog task={pendingDelete} onCancel={() => setPendingDelete(null)} onConfirm={handleConfirmDelete} />

      {/* Live Cursors */}
      {Object.values(cursors).map((cursor, i) => (
        <div
          key={i}
          className="pointer-events-none fixed z-50 flex items-center gap-2 transition-all duration-100 ease-linear"
          style={{
            left: `${cursor.x * 100}vw`,
            top: `${cursor.y * 100}vh`,
          }}
        >
          <div className="w-4 h-4 rounded-full bg-indigo-500 shadow-md border-2 border-white flex items-center justify-center overflow-hidden">
             {cursor.user.avatar ? <img src={cursor.user.avatar} className="w-full h-full object-cover" /> : <span className="text-[8px] text-white font-bold">{cursor.user.name[0]}</span>}
          </div>
          <span className="bg-indigo-500 text-white text-xs px-2 py-0.5 rounded shadow-sm">
            {cursor.user.name}
          </span>
        </div>
      ))}
    </div>
  );
}
