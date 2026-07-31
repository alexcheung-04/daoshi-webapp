import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Trash2, CheckCircle2, Circle, Timer, AlertTriangle } from 'lucide-react';
import type { PlannedTask } from '@/types';
import { CATEGORY_CONFIG, DAILY_PLAN_LABELS } from '@/types';
import { useTaskStore } from '@/store/taskStore';

interface Props {
  task: PlannedTask;
  onToggleComplete?: (id: string) => void;
  onDelete?: (id: string) => void;
  onTimer?: (id: string) => void;
}

function formatDeadline(iso: string): string {
  const d = new Date(iso);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${month}月${day}日 ${hours}:${minutes}`;
}

export default function TaskCard({ task, onToggleComplete, onDelete, onTimer }: Props) {
  const [showDelete, setShowDelete] = useState(false);
  const navigate = useNavigate();
  const config = CATEGORY_CONFIG[task.category];
  const { conflicts } = useTaskStore();

  // Check if any conflict involves blocks from this task
  const hasOverdueConflict = conflicts.some((c) =>
    c.involvedBlocks.some((b) => {
      // We check if any conflict block's title matches the task title
      return b.title === task.title;
    })
  );

  const handleClick = () => {
    navigate(`/tasks/${task.id}`);
  };

  return (
    <div
      onClick={handleClick}
      className={cn(
        'bg-[var(--card)] rounded-2xl p-4 transition-all cursor-pointer hover:shadow-md',
        task.isCompleted && 'opacity-60',
        'group relative'
      )}
      onMouseEnter={() => setShowDelete(true)}
      onMouseLeave={() => setShowDelete(false)}
    >
      <div className="flex gap-3">
        {/* Left colored vertical bar */}
        <div
          className="w-[5px] rounded-l flex-shrink-0"
          style={{ backgroundColor: config?.color }}
        />

        {/* Right VStack content */}
        <div className="flex-1 min-w-0">
          {/* Title */}
          <h3
            className={cn(
              'font-semibold text-base text-gray-900 dark:text-gray-100 truncate',
              task.isCompleted && 'line-through text-gray-400 dark:text-gray-500'
            )}
          >
            {task.title}
          </h3>

          {/* Time display: show date + start time for fixed-time tasks, deadline otherwise */}
          <p className="font-semibold text-base text-gray-800 dark:text-gray-200 mt-0.5">
            {task.isFixedTime && task.fixedStart
              ? formatDeadline(task.fixedStart)
              : formatDeadline(task.deadline)}
          </p>

          {/* Type + plan summary */}
          <p className="text-footnote text-gray-500 dark:text-gray-400 mt-0.5">
            {config?.label} · {DAILY_PLAN_LABELS[task.dailyPlan] || '稳步推进'}
          </p>

          {/* Location */}
          {task.locationText && (
            <p className="text-footnote text-gray-400 dark:text-gray-500 mt-0.5">
              {task.locationText}
            </p>
          )}
        </div>

        {/* Top-right action area */}
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          {/* Conflict tag */}
          {hasOverdueConflict && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
              <AlertTriangle className="w-3 h-3" />
              冲突
            </span>
          )}

          {/* Category badge */}
          {config && (
            <span
              className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
              style={{ backgroundColor: config.lightBg, color: config.color }}
            >
              {config.label}
            </span>
          )}

          {/* Checkmark or Timer button */}
          {task.category === 'study' || task.category === 'focus' ? (
            <div className="flex items-center gap-1">
              {onTimer && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onTimer(task.id);
                  }}
                  className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-amber-500 transition-colors"
                >
                  <Timer className="w-4 h-4" />
                </button>
              )}
              {onToggleComplete && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleComplete(task.id);
                  }}
                  className="p-1 rounded-full"
                >
                  {task.isCompleted ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  ) : (
                    <Circle className="w-5 h-5 text-gray-300 dark:text-gray-600 hover:text-amber-400 transition-colors" />
                  )}
                </button>
              )}
            </div>
          ) : (
            onToggleComplete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleComplete(task.id);
                }}
                className="p-1 rounded-full"
              >
                {task.isCompleted ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                ) : (
                  <Circle className="w-5 h-5 text-gray-300 dark:text-gray-600" />
                )}
              </button>
            )
          )}
        </div>
      </div>

      {/* Delete button on hover */}
      {showDelete && !task.isCompleted && onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(task.id);
          }}
          className="absolute top-2 left-2 p-1.5 rounded-full bg-white/90 dark:bg-gray-800/90 shadow-sm text-gray-400 hover:text-red-500 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
