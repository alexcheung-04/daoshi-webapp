import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTaskStore } from '@/store/taskStore';
import { useAuthStore } from '@/store/authStore';
import TaskCard from '@/components/TaskCard';

export default function TaskList() {
  const navigate = useNavigate();
  const { tasks, conflicts, toggleTaskCompletion, deleteTask } = useTaskStore();
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const openLoginModal = useAuthStore((s) => s.openLoginModal);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTasks = useMemo(() => {
    if (!searchQuery.trim()) return tasks;
    const q = searchQuery.toLowerCase();
    return tasks.filter((t) => t.title.toLowerCase().includes(q));
  }, [tasks, searchQuery]);

  const sortedTasks = useMemo(() => {
    return [...filteredTasks].sort(
      (a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
    );
  }, [filteredTasks]);

  const incompleteTasks = sortedTasks.filter((t) => !t.isCompleted);
  const completedTasks = sortedTasks.filter((t) => t.isCompleted);

  const conflictCount = conflicts.length;
  const conflictSummaryText =
    conflictCount > 0
      ? `检测到 ${conflictCount} 个时间冲突，点击查看详情`
      : '当前暂无时间冲突';

  // Auth-guarded wrappers
  const guardedToggleCompletion = useCallback(
    (id: string) => {
      if (!isLoggedIn) { openLoginModal(); return; }
      toggleTaskCompletion(id);
    },
    [isLoggedIn, openLoginModal, toggleTaskCompletion]
  );

  const guardedDelete = useCallback(
    (id: string) => {
      if (!isLoggedIn) { openLoginModal(); return; }
      deleteTask(id);
    },
    [isLoggedIn, openLoginModal, deleteTask]
  );

  const handleAddTask = () => {
    if (!isLoggedIn) {
      openLoginModal();
      return;
    }
    navigate('/tasks/new');
  };

  return (
    <div className="max-w-[920px] mx-auto px-6" style={{ padding: '24px' }}>
      <div className="space-y-[18px]">
        {/* ===== Header Section ===== */}
        <div className="bg-[var(--surface)] rounded-3xl shadow-lg p-6">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            已录入任务
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            已录入 {tasks.length} 项任务
          </p>
        </div>

        {/* ===== Conflict Summary Row ===== */}
        <div
          onClick={() => navigate('/conflicts')}
          className={cn(
            'flex items-center gap-3 px-5 py-4 rounded-2xl cursor-pointer transition-all hover:shadow-md',
            conflictCount > 0
              ? 'bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50'
              : 'bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800/50'
          )}
        >
          {conflictCount > 0 ? (
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
          ) : (
            <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
          )}
          <span
            className={cn(
              'flex-1 text-sm font-medium',
              conflictCount > 0
                ? 'text-red-700 dark:text-red-400'
                : 'text-green-700 dark:text-green-400'
            )}
          >
            {conflictSummaryText}
          </span>
          <ChevronRight
            className={cn(
              'w-4 h-4 flex-shrink-0',
              conflictCount > 0
                ? 'text-red-400'
                : 'text-green-400'
            )}
          />
        </div>

        {/* ===== Task List ===== */}
        <div className="bg-[var(--surface)] rounded-3xl shadow-lg p-6">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">
            任务清单
          </h2>

          {/* Search bar */}
          <div
            className="relative mb-4"
            style={{ backgroundColor: 'var(--card)' }}
          >
            <div className="relative rounded-2xl overflow-hidden">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索已录入任务…"
                className="w-full pl-10 pr-10 py-3 bg-[var(--card)] text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Task list */}
          {tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-sm text-gray-400 dark:text-gray-500">
                还没有录入任务，点击右下角 + 按钮创建
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {incompleteTasks.length > 0 && (
                <div className="space-y-2">
                  {incompleteTasks.map((task) => (
                    <div
                      key={task.id}
                      className="transition-shadow hover:shadow-md rounded-xl"
                    >
                      <TaskCard
                        task={task}
                        onToggleComplete={guardedToggleCompletion}
                        onDelete={guardedDelete}
                        onTimer={(id) => navigate(`/timer/${id}`)}
                      />
                    </div>
                  ))}
                </div>
              )}

              {completedTasks.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                  <div className="space-y-2">
                    {completedTasks.map((task) => (
                      <div
                        key={task.id}
                        className="transition-shadow hover:shadow-md rounded-xl"
                      >
                        <TaskCard
                          task={task}
                          onToggleComplete={guardedToggleCompletion}
                          onDelete={guardedDelete}
                          onTimer={(id) => navigate(`/timer/${id}`)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {sortedTasks.length === 0 && searchQuery && (
                <div className="text-center py-16 text-gray-400 dark:text-gray-500">
                  <p className="text-sm">没有找到匹配的任务</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ===== FAB ===== */}
      <button
        onClick={handleAddTask}
        className="fixed bottom-28 right-6 w-14 h-14 rounded-full text-white shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-transform z-20"
        style={{ backgroundColor: 'rgb(0.01, 0.16, 0.47)' }}
      >
        <Plus className="w-7 h-7" />
      </button>
    </div>
  );
}
