import { AlertTriangle, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface Props {
  conflictCount: number;
  onDismiss?: () => void;
}

export default function ConflictBanner({ conflictCount, onDismiss }: Props) {
  const navigate = useNavigate();

  if (conflictCount === 0) return null;

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-3 rounded-xl mb-4 cursor-pointer',
        'bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800'
      )}
      onClick={() => navigate('/conflicts')}
    >
      <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-red-700 dark:text-red-400">
          检测到 {conflictCount} 个时间冲突
        </p>
        <p className="text-xs text-red-500 dark:text-red-500 mt-0.5">
          点击查看详情及解决方案
        </p>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onDismiss?.(); }}
        className="p-1 rounded-full hover:bg-red-100 dark:hover:bg-red-900/50 flex-shrink-0"
      >
        <X className="w-4 h-4 text-red-400" />
      </button>
    </div>
  );
}
