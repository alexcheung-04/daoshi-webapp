import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Circle, Trash2, Timer } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CATEGORY_CONFIG, DAILY_PLAN_LABELS, REPEAT_MODE_LABELS, WEEKDAY_LABELS } from '@/types';
import type { PlannedTask } from '@/types';
import { useTaskStore } from '@/store/taskStore';

interface Props {
  task: PlannedTask;
  onToggleComplete?: (id: string) => void;
  onDelete?: (id: string) => void;
  onTimer?: (id: string) => void;
}

export default function TaskCard({ task, onToggleComplete, onDelete, onTimer }: Props) {
  const navigate = useNavigate();
  const config = CATEGORY_CONFIG[task.category];
  const { conflicts } = useTaskStore();
  // 使用自定义颜色或类别默认颜色
  const taskColor = task.color || config?.color;

  const handleClick = () => {
    navigate(`/tasks/${task.id}`);
  };

  const hasConflict = conflicts.some((c) =>
    c.involvedBlocks.some((b) => b.blockID === task.id)
  );

  return (
    <div
      onClick={handleClick}
      className={cn(
        'bg-[var(--card)] rounded-2xl p-4 transition-all cursor-pointer hover:shadow-md',
        task.isCompleted && 'opacity-60',
        'relative'
      )}
    >
      <div className="flex gap-3">
        {/* Left colored vertical bar */}
        <div
          className="w-[5px] rounded-l flex-shrink-0"
          style={{ backgroundColor: taskColor }}
        />

        {/* Right VStack */}
        <div className="flex-1 min-w-0">
          {/* Title row */}
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-[15px] font-semibold text-gray-900 dark:text-gray-100 truncate">
              {task.title}
            </h3>
          </div>

          {/* Type + repeat + plan summary */}
          <p className="text-footnote text-gray-500 dark:text-gray-400 mt-0.5">
            {config?.label}
            {task.repeatMode && task.repeatMode !== 'once' && (
              <>
                {' · '}
                {REPEAT_MODE_LABELS[task.repeatMode]}
                {task.repeatMode === 'weekly' && (task.weeklyDays || []).length > 0
                  ? `（${(task.weeklyDays || []).map((d) => WEEKDAY_LABELS[d]).join('、')}）`
                  : ''}
              </>
            )}
            {' · '}
            {DAILY_PLAN_LABELS[task.dailyPlan] || '稳步推进'}
          </p>

          {/* Deadline / time range */}
          <p className="text-footnote text-gray-400 dark:text-gray-500 mt-1">
            {task.isFixedTime && task.fixedStart && task.fixedEnd
              ? `${new Date(task.fixedStart).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} - ${new Date(task.fixedEnd).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
              : `截止：${new Date(task.deadline).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
            }
          </p>

          {/* Conflict warning */}
          {hasConflict && (
            <p className="text-footnote text-red-500 dark:text-red-400 mt-1 font-medium">
              ⚠ 存在时间冲突，请查看「冲突提醒」
            </p>
          )}

          {/* Location (exam tasks) */}
          {task.locationText && (
            <p className="text-footnote text-gray-400 dark:text-gray-500 mt-1">
              📍 {task.locationText}
            </p>
          )}
        </div>

        {/* Checkmark / Timer / Delete buttons */}
        <div className="flex items-center gap-1">
          {(task.category === 'study' || task.category === 'focus') && onTimer && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTimer(task.id);
              }}
              className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-amber-500 transition-colors"
              title="进入专注"
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
              title="标记完成"
            >
              {task.isCompleted ? (
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              ) : (
                <Circle className="w-5 h-5 text-gray-300 dark:text-gray-600 hover:text-amber-400 transition-colors" />
              )}
            </button>
          )}
          {onDelete && !task.isCompleted && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(task.id);
              }}
              className="p-1 rounded-full text-gray-300 dark:text-gray-600 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title="删除任务"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
