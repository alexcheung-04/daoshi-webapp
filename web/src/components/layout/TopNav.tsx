import { Settings, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { APP_MODE_LABELS } from '@/types';
import { useAppStateStore, useTaskStore } from '@/store/taskStore';

interface TopNavProps {
  onToggleSettings: () => void;
  onToggleModePicker: () => void;
}

export default function TopNav({ onToggleSettings, onToggleModePicker }: TopNavProps) {
  const appMode = useAppStateStore((s) => s.appState.appMode);
  const conflicts = useTaskStore((s) => s.conflicts);

  const modeBadgeClass = cn(
    'px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer',
    appMode === 'daily' && 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
    appMode === 'examPrep' && 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
    appMode === 'emergency' && 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'
  );

  return (
    <header className="lg:hidden fixed top-0 left-0 right-0 z-20 h-16 px-4 flex items-center justify-between">
      {/* Left: gear button with glass circle */}
      <button
        onClick={onToggleSettings}
        className="glass-circle flex items-center justify-center w-10 h-10 rounded-full text-gray-600 dark:text-gray-300"
        aria-label="设置"
      >
        <Settings size={20} />
      </button>

      {/* Center: title */}
      <h1 className="text-[30px] font-bold text-gray-800 dark:text-gray-100 tracking-wide select-none">
        倒时 · 日程
      </h1>

      {/* Right: mode badge + add button */}
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleModePicker}
          className={modeBadgeClass}
        >
          {APP_MODE_LABELS[appMode]}
        </button>

        {/* Conflict badge */}
        {conflicts.length > 0 && (
          <span className="w-2 h-2 rounded-full bg-red-500" />
        )}

        {/* Add task + with glass circle */}
        <a
          href="#/tasks/new"
          className="glass-circle flex items-center justify-center w-10 h-10 rounded-full text-gray-600 dark:text-gray-300"
          aria-label="添加任务"
        >
          <Plus size={20} />
        </a>
      </div>
    </header>
  );
}
