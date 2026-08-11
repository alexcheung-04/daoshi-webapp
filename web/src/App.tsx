import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import TaskList from './pages/TaskList';
import TaskEditor from './pages/TaskEditor';
import Conflicts from './pages/Conflicts';
import Chat from './pages/Chat';
import FocusTimer from './pages/FocusTimer';
import Settings from './pages/Settings';
import LoginModal from './components/LoginModal';
import { useTaskStore, useAppStateStore } from './store/taskStore';
import { useAuthStore } from './store/authStore';

export default function App() {
  const loadTasks = useTaskStore((s) => s.loadTasks);
  const loadAppState = useAppStateStore((s) => s.loadAppState);
  const appearance = useAppStateStore((s) => s.appState.appearance);
  const init = useAuthStore((s) => s.init);
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);

  // Restore session on mount
  useEffect(() => {
    init();
  }, [init]);

  // Load (or reload) tasks & app state whenever auth state changes
  useEffect(() => {
    loadAppState();
    loadTasks();
  }, [isLoggedIn, loadTasks, loadAppState]);

  // Apply dark mode
  useEffect(() => {
    const isDark =
      appearance === 'dark' ||
      (appearance === 'system' &&
        window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', isDark);
  }, [appearance]);

  return (
    <HashRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/tasks" element={<TaskList />} />
          <Route path="/tasks/new" element={<TaskEditor />} />
          <Route path="/tasks/:id" element={<TaskEditor />} />
          <Route path="/conflicts" element={<Conflicts />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/timer" element={<FocusTimer />} />
          <Route path="/timer/:taskId" element={<FocusTimer />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
      <LoginModal />
    </HashRouter>
  );
}
