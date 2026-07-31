import { Sun, Book, AlertTriangle, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStateStore } from '@/store/taskStore';
import type { AppMode } from '@/types';
import { APP_MODE_LABELS } from '@/types';

interface ModeOption {
  value: AppMode;
  icon: typeof Sun;
  description: string;
}

const modes: ModeOption[] = [
  { value: 'daily', icon: Sun, description: '常规日程，可添加任意类型任务' },
  { value: 'examPrep', icon: Book, description: '专注备考，屏蔽娱乐类任务' },
  { value: 'emergency', icon: AlertTriangle, description: '高效处理异常，屏蔽娱乐类任务' },
];

interface ModePickerPopoverProps {
  open: boolean;
  onClose: () => void;
}

export default function ModePickerPopover({ open, onClose }: ModePickerPopoverProps) {
  const appMode = useAppStateStore((s) => s.appState.appMode);
  const setAppState = useAppStateStore((s) => s.setAppState);

  const handleSelect = (mode: AppMode) => {
    setAppState({ appMode: mode });
    onClose();
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* Popover - positioned near top-right */}
      <div
        className="fixed top-20 right-4 z-50 w-[280px] bg-white dark:bg-[var(--surface)] rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title */}
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100">切换模式</h3>
        </div>

        {/* Mode options */}
        <div className="py-1">
          {modes.map((mode) => {
            const isActive = appMode === mode.value;
            return (
              <button
                key={mode.value}
                onClick={() => handleSelect(mode.value)}
                className="w-full flex items-start gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-left"
              >
                {/* Icon circle */}
                <div
                  className={cn(
                    'flex items-center justify-center w-8 h-8 rounded-full shrink-0 mt-0.5',
                    isActive
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400'
                  )}
                >
                  <mode.icon size={16} />
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'text-sm font-semibold',
                        isActive
                          ? 'text-orange-600 dark:text-orange-400'
                          : 'text-gray-800 dark:text-gray-200'
                      )}
                    >
                      {APP_MODE_LABELS[mode.value]}
                    </span>
                    {isActive && (
                      <Check size={14} className="text-orange-500 shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                    {mode.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Bottom hint */}
        <div className="px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border-t border-amber-100 dark:border-amber-800/30">
          <p className="text-xs text-amber-600 dark:text-amber-400 leading-relaxed">
            复习考试周模式和紧急异常模式下无法添加娱乐类任务
          </p>
        </div>
      </div>
    </>
  );
}
