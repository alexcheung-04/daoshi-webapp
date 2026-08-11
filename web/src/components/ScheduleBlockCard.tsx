import { cn } from '@/lib/utils';
import {
  CheckCircle2,
  Circle,
  AlertTriangle,
  Play,
  SlidersHorizontal,
  BookOpen,
  Music,
  Pencil,
  Timer,
  Leaf,
} from 'lucide-react';
import type { ScheduleBlock } from '@/types';
import { CATEGORY_CONFIG } from '@/types';

const STYLE_LABELS: Record<string, string> = {
  fixed: '固定',
  flexible: '弹性',
  focus: '专注',
};

const STYLE_COLORS: Record<string, string> = {
  fixed: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  flexible: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
  focus: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
};

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  study: BookOpen,
  entertainment: Music,
  exam: Pencil,
  focus: Timer,
  life: Leaf,
};

interface Props {
  block: ScheduleBlock;
  onToggleComplete?: (id: string) => void;
  onPlay?: (id: string) => void;
  onAdjust?: (id: string) => void;
}

export default function ScheduleBlockCard({ block, onToggleComplete, onPlay, onAdjust }: Props) {
  const config = CATEGORY_CONFIG[block.taskCategory];
  const CategoryIcon = CATEGORY_ICONS[block.taskCategory] || BookOpen;
  const hasActions = onToggleComplete || onPlay || onAdjust;

  return (
    <div
      className={cn(
        'bg-[var(--card)] rounded-3xl p-[18px] transition-all hover:shadow-md',
        block.hasConflict && 'bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800',
        block.isBlockCompleted && 'opacity-60'
      )}
    >
      <div className="flex items-start gap-3">
        {/* Left: rounded rect icon area (72x72) */}
        <div
          className={cn(
            'w-[72px] h-[72px] rounded-2xl flex items-center justify-center flex-shrink-0',
            block.hasConflict
              ? 'bg-red-100 dark:bg-red-900/40'
              : ''
          )}
          style={!block.hasConflict ? { backgroundColor: config?.lightBg } : undefined}
        >
          {block.hasConflict ? (
            <AlertTriangle className="w-8 h-8 text-red-500" />
          ) : (
            <CategoryIcon
              className="w-7 h-7"
              style={{ color: config?.color }}
            />
          )}
        </div>

        {/* Right VStack content */}
        <div className="flex-1 min-w-0">
          {/* Title */}
          <h3 className="font-semibold text-base text-gray-900 dark:text-gray-100 truncate">
            {block.title}
          </h3>

          {/* Style tag */}
          <span
            className={cn(
              'inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full mt-1',
              STYLE_COLORS[block.style] || STYLE_COLORS.flexible
            )}
          >
            {STYLE_LABELS[block.style] || block.style}
          </span>

          {/* TimeRange */}
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {block.timeRange}
          </p>

          {/* Detail */}
          {block.detail && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 line-clamp-2">
              {block.detail}
            </p>
          )}
        </div>
      </div>

      {/* Bottom HStack action row */}
      {hasActions && (block.taskCategory === 'study' || block.taskCategory === 'focus') && (
        <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
          {/* Checkmark toggle */}
          {onToggleComplete && (
            <button
              onClick={() => onToggleComplete(block.id)}
              className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              {block.isBlockCompleted ? (
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              ) : (
                <Circle className="w-5 h-5 text-gray-300 dark:text-gray-600" />
              )}
            </button>
          )}

          {/* Play button */}
          {onPlay && (
            <button
              onClick={() => onPlay(block.id)}
              className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors"
            >
              <Play className="w-5 h-5" />
            </button>
          )}

          {/* Adjust button（对应 iOS：仅弹性学习块与专注块显示） */}
          {onAdjust &&
            block.taskID &&
            (block.taskCategory === 'focus' ||
              (block.taskCategory === 'study' && block.style !== 'fixed')) && (
              <button
                onClick={() => onAdjust(block.id)}
                className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors"
              >
                <SlidersHorizontal className="w-5 h-5" />
              </button>
            )}
        </div>
      )}
    </div>
  );
}
