import { useState } from 'react';
import { X } from 'lucide-react';
import type { ScheduleBlock } from '@/types';
import { useTaskStore } from '@/store/taskStore';

/** 把 ISO 时间转成 <input type="datetime-local"> 所需的本地格式 */
function toLocalInputValue(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 把 datetime-local 值转成 ISO 字符串 */
function toISO(localValue: string): string {
  return new Date(localValue).toISOString();
}

interface Props {
  block: ScheduleBlock;
  onClose: () => void;
}

/** 调整专注/子任务时间弹窗（对应 iOS FocusBlockEditorSheet） */
export default function FocusBlockEditorModal({ block, onClose }: Props) {
  const { updateScheduleBlock, renameFocusBlock, toggleBlockCompletion } = useTaskStore();

  const [customTitle, setCustomTitle] = useState(block.title);
  const [start, setStart] = useState(toLocalInputValue(block.startDate));
  const [end, setEnd] = useState(toLocalInputValue(block.endDate));
  const [isCompleted, setIsCompleted] = useState(block.isBlockCompleted);

  const handleSave = () => {
    if (!start) return;
    const normalizedEnd =
      new Date(end).getTime() > new Date(start).getTime()
        ? end
        : new Date(new Date(start).getTime() + 30 * 60000).toISOString();

    // 更新时间（对应 iOS updateScheduleBlock）
    updateScheduleBlock(block.id, toISO(start), normalizedEnd);

    // 更新名称（对应 iOS renameFocusBlock）
    if (customTitle.trim() && customTitle.trim() !== block.title) {
      renameFocusBlock(block.id, customTitle.trim());
    }

    // 更新完成状态（对应 iOS toggleFocusBlockCompletion）
    if (isCompleted !== block.isBlockCompleted) {
      toggleBlockCompletion(block.id);
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 dark:bg-black/50 p-4">
      <div
        className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-[480px] p-6 space-y-5"
        style={{ maxHeight: '90vh', overflowY: 'auto' }}
      >
        {/* 标题行 */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            调整专注时间段
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 transition-colors"
            aria-label="关闭"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 专注块名称 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            专注块名称
          </label>
          <input
            value={customTitle}
            onChange={(e) => setCustomTitle(e.target.value)}
            placeholder="输入自定义名称"
            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* 开始时间 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            开始时间
          </label>
          <input
            type="datetime-local"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* 结束时间 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            结束时间
          </label>
          <input
            type="datetime-local"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* 完成状态切换 */}
        <button
          onClick={() => setIsCompleted(!isCompleted)}
          className={`w-full flex items-center justify-between rounded-2xl px-4 py-3 transition-colors ${
            isCompleted
              ? 'bg-green-50 dark:bg-green-900/20'
              : 'bg-gray-50 dark:bg-gray-700/40'
          }`}
        >
          <span className="text-left">
            <span className="block text-sm font-semibold text-gray-900 dark:text-gray-100">
              标记为已完成
            </span>
            <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              勾选后该专注块在时间轴中会显示为完成状态
            </span>
          </span>
          <span
            className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
              isCompleted ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                isCompleted ? 'translate-x-[22px]' : 'translate-x-[2px]'
              }`}
            />
          </span>
        </button>

        {/* 说明文字 */}
        <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
          保存后，这个任务的专注块会按你手动修改后的时间继续保留。你也可以为每个专注块自定义名称，方便区分不同复习内容（如复习红黑树、刷题练习）。
        </p>

        {/* 操作按钮 */}
        <div className="flex gap-3 pt-1">
          <button
            onClick={handleSave}
            className="flex-1 py-2.5 rounded-full bg-[rgb(0.01,0.16,0.47)] text-white text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            保存调整
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-semibold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
}
