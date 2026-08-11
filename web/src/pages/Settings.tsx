import { cn } from '@/lib/utils';
import { useAppStateStore } from '@/store/taskStore';
import { APP_MODE_LABELS } from '@/types';
import type { AppMode, AppAppearance } from '@/types';
import { Sun, Moon, Monitor } from 'lucide-react';

const appearanceOptions: { value: AppAppearance; icon: React.ElementType; label: string }[] = [
  { value: 'system', icon: Monitor, label: '跟随系统' },
  { value: 'light', icon: Sun, label: '浅色模式' },
  { value: 'dark', icon: Moon, label: '深色模式' },
];

const soundOptions: { value: string; label: string }[] = [
  { value: 'bell', label: '铃声' },
  { value: 'chime', label: '钟琴' },
  { value: 'electronic', label: '电子音' },
  { value: 'alert', label: '警报' },
];

const appModeOptions: { value: AppMode; label: string; desc: string }[] = [
  { value: 'daily', label: '日常生活', desc: '所有任务正常显示' },
  { value: 'examPrep', label: '复习考试周', desc: '考试/紧急模式下娱乐类任务将被隐藏' },
  { value: 'emergency', label: '紧急异常', desc: '仅显示学习和工作任务' },
];

export default function Settings() {
  const { appState, setAppState } = useAppStateStore();

  const handleAppearanceChange = (value: AppAppearance) => {
    setAppState({ appearance: value });
    // Apply dark mode class
    if (value === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (value === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.classList.toggle('dark', prefersDark);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
        设置
      </h1>

      {/* App Mode */}
      <section>
        <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
          应用模式
        </h2>
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
          {appModeOptions.map((option, i) => (
            <button
              key={option.value}
              onClick={() => setAppState({ appMode: option.value })}
              className={cn(
                'w-full flex items-center justify-between px-4 py-3.5 text-left transition-colors',
                i < appModeOptions.length - 1 && 'border-b border-gray-100 dark:border-gray-800',
                'hover:bg-gray-50 dark:hover:bg-gray-800/50'
              )}
            >
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {option.label}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  {option.desc}
                </p>
              </div>
              <div
                className={cn(
                  'w-5 h-5 rounded-full border-2 flex items-center justify-center',
                  appState.appMode === option.value
                    ? 'border-blue-600'
                    : 'border-gray-300 dark:border-gray-600'
                )}
              >
                {appState.appMode === option.value && (
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                )}
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Divider */}
      <div className="border-t border-gray-100 dark:border-gray-800" />

      {/* Appearance */}
      <section>
        <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
          外观
        </h2>
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-1.5 flex">
          {appearanceOptions.map((option) => {
            const Icon = option.icon;
            const isActive = appState.appearance === option.value;
            return (
              <button
                key={option.value}
                onClick={() => handleAppearanceChange(option.value)}
                className={cn(
                  'flex-1 flex flex-col items-center gap-1 py-3 rounded-lg text-xs font-medium transition-all',
                  isActive
                    ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm'
                    : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
                )}
              >
                <Icon className="w-5 h-5" />
                {option.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* Divider */}
      <div className="border-t border-gray-100 dark:border-gray-800" />

      {/* Completion Sound */}
      <section>
        <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
          专注完成提示音
        </h2>
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
          {soundOptions.map((option, i) => (
            <button
              key={option.value}
              onClick={() => setAppState({ completionSound: option.value as any })}
              className={cn(
                'w-full flex items-center justify-between px-4 py-3.5 transition-colors',
                i < soundOptions.length - 1 && 'border-b border-gray-100 dark:border-gray-800',
                'hover:bg-gray-50 dark:hover:bg-gray-800/50'
              )}
            >
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {option.label}
              </span>
              <div
                className={cn(
                  'w-5 h-5 rounded-full border-2 flex items-center justify-center',
                  appState.completionSound === option.value
                    ? 'border-blue-600'
                    : 'border-gray-300 dark:border-gray-600'
                )}
              >
                {appState.completionSound === option.value && (
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                )}
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
