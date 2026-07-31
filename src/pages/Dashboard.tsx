import { useState, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  List,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Play,
  CheckCircle2,
  Circle,
  AlertTriangle,
  ChevronRight as ChevronRightIcon,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTaskStore } from '@/store/taskStore';
import { useAuthStore } from '@/store/authStore';
import ScheduleBlockCard from '@/components/ScheduleBlockCard';
import FocusBlockEditorModal from '@/components/FocusBlockEditorModal';
import { CATEGORY_CONFIG } from '@/types';
import type { ScheduleBlock } from '@/types';

const WEEK_DAYS_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

function formatDayLabel(date: Date): string {
  const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return `${date.getMonth() + 1}.${String(date.getDate()).padStart(2, '0')} ${weekDays[date.getDay()]}`;
}

function isSameDate(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isBlockForDate(block: ScheduleBlock, date: Date): boolean {
  return block.dayLabel === formatDayLabel(date);
}

function getWeekDays(date: Date): Date[] {
  const startOfWeek = new Date(date);
  const dayOfWeek = date.getDay();
  startOfWeek.setDate(date.getDate() - dayOfWeek);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    return d;
  });
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { blocks, conflicts, toggleBlockCompletion, deleteTask } = useTaskStore();
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const openLoginModal = useAuthStore((s) => s.openLoginModal);

  const [viewMode, setViewMode] = useState(0); // 0=列表, 1=日历
  const [calendarLayout, setCalendarLayout] = useState(0); // 0=竖向日期, 1=横向日期
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerYear, setPickerYear] = useState(new Date().getFullYear());
  const [pickerMonth, setPickerMonth] = useState(new Date().getMonth());
  const [editingBlock, setEditingBlock] = useState<ScheduleBlock | null>(null);
  const touchStartX = useRef(0);
  const pickerRef = useRef<HTMLDivElement>(null);

  // ===== 列表模式: today blocks =====
  const todayBlocks = useMemo(
    () => blocks.filter((b) => isBlockForDate(b, new Date())),
    [blocks]
  );
  const incompleteTodayBlocks = useMemo(
    () => todayBlocks.filter((b) => !b.isBlockCompleted),
    [todayBlocks]
  );

  // ===== 竖向日期: date list (14 days from today) =====
  const verticalDateList = useMemo(() => {
    const dates: Date[] = [];
    const today = new Date();
    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      dates.push(d);
    }
    return dates;
  }, []);

  // ===== 横向日期: week state =====
  const weekDays = useMemo(() => getWeekDays(selectedDate), [selectedDate]);

  const selectedDateBlocks = useMemo(
    () => blocks.filter((b) => isBlockForDate(b, selectedDate)),
    [blocks, selectedDate]
  );

  // ===== Touch swipe for 横向 =====
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const diff = touchStartX.current - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 50) {
        const newDate = new Date(selectedDate);
        newDate.setDate(newDate.getDate() + (diff > 0 ? 7 : -7));
        setSelectedDate(newDate);
      }
    },
    [selectedDate]
  );

  const goToPrevWeek = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 7);
    setSelectedDate(d);
  };

  const goToNextWeek = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 7);
    setSelectedDate(d);
  };

  const handlePlay = useCallback(
    (blockId: string) => {
      const block = blocks.find((b) => b.id === blockId);
      if (block?.taskID) navigate(`/timer/${block.taskID}`);
    },
    [navigate, blocks]
  );

  const handleAdjust = useCallback(
    (blockId: string) => {
      const block = blocks.find((b) => b.id === blockId);
      if (block?.taskID) setEditingBlock(block);
    },
    [blocks]
  );

  // 删除任务（带登录守卫）
  const handleDeleteTask = useCallback(
    (taskId: string) => {
      if (!isLoggedIn) {
        openLoginModal();
        return;
      }
      deleteTask(taskId);
    },
    [isLoggedIn, openLoginModal, deleteTask]
  );

  // Close date picker on outside click
  const handlePickerOverlay = useCallback((e: React.MouseEvent) => {
    if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
      setShowDatePicker(false);
    }
  }, []);

  // Calendar grid for the popup
  const calendarDays = useMemo(() => {
    const firstDay = new Date(pickerYear, pickerMonth, 1).getDay();
    const daysInMonth = new Date(pickerYear, pickerMonth + 1, 0).getDate();
    const grid: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) grid.push(null);
    for (let d = 1; d <= daysInMonth; d++) grid.push(d);
    return grid;
  }, [pickerYear, pickerMonth]);

  const today = new Date();

  return (
    <div className="max-w-[920px] mx-auto" style={{ padding: '24px' }}>
      <div className="space-y-[18px]">
        {/* ===== Header Controls ===== */}
        <div className="bg-[var(--surface)] rounded-3xl shadow-lg p-6">
          <div className="flex items-center justify-center">
            <div className="inline-flex bg-gray-100 dark:bg-gray-800 rounded-xl p-0.5">
              <button
                onClick={() => setViewMode(0)}
                className={cn(
                  'px-5 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2',
                  viewMode === 0
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400'
                )}
              >
                <List className="w-4 h-4" />
                列表
              </button>
              <button
                onClick={() => setViewMode(1)}
                className={cn(
                  'px-5 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2',
                  viewMode === 1
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400'
                )}
              >
                <CalendarDays className="w-4 h-4" />
                日历
              </button>
            </div>
          </div>
        </div>

        {/* ===== 列表模式 ===== */}
        {viewMode === 0 && (
          <>
            {/* Conflict Alert Banner */}
            {conflicts.length > 0 && (
              <div
                className="flex items-center gap-3 px-5 py-3.5 rounded-2xl mb-4 cursor-pointer bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-700/50 hover:shadow-md transition-shadow"
                onClick={() => navigate('/conflicts')}
              >
                <div className="w-9 h-9 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-red-700 dark:text-red-300">
                    检测到 {conflicts.length} 个时间冲突
                  </p>
                  <p className="text-xs text-red-500 dark:text-red-400 mt-0.5">
                    点击查看详情及 AI 调整方案
                  </p>
                </div>
                <ChevronRightIcon className="w-4 h-4 text-red-400 flex-shrink-0" />
              </div>
            )}

            <div className="bg-[var(--surface)] rounded-3xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                当天待完成的任务
              </h2>
              <span className="text-xs font-medium text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-2.5 py-1 rounded-full">
                共 {incompleteTodayBlocks.length} 项
              </span>
            </div>

            {todayBlocks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <CheckCircle2 className="w-12 h-12 text-green-400 mb-3" />
                <p className="text-sm text-gray-400 dark:text-gray-500">
                  今天没有待完成的任务。
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {todayBlocks.map((block) => (
                  <ScheduleBlockCard
                    key={block.id}
                    block={block}
                    onToggleComplete={() => toggleBlockCompletion(block.id)}
                    onPlay={handlePlay}
                    onAdjust={handleAdjust}
                    onDelete={
                      block.taskID
                        ? () => handleDeleteTask(block.taskID as string)
                        : undefined
                    }
                  />
                ))}
              </div>
            )}
          </div>
          </>
        )}

        {/* ===== 日历模式 ===== */}
        {viewMode === 1 && (
          <div className="bg-[var(--surface)] rounded-3xl shadow-lg p-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
              日历模式
            </h2>

            {/* Sub-picker */}
            <div className="flex items-center justify-center mb-6">
              <div className="inline-flex bg-gray-100 dark:bg-gray-800 rounded-xl p-0.5">
                <button
                  onClick={() => setCalendarLayout(0)}
                  className={cn(
                    'px-4 py-1.5 rounded-lg text-xs font-medium transition-all',
                    calendarLayout === 0
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                      : 'text-gray-500 dark:text-gray-400'
                  )}
                >
                  竖向日期
                </button>
                <button
                  onClick={() => setCalendarLayout(1)}
                  className={cn(
                    'px-4 py-1.5 rounded-lg text-xs font-medium transition-all',
                    calendarLayout === 1
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                      : 'text-gray-500 dark:text-gray-400'
                  )}
                >
                  横向日期
                </button>
              </div>
            </div>

            {/* ===== 竖向日期 ===== */}
            {calendarLayout === 0 && (
              <div className="space-y-4">
                {verticalDateList.map((date) => {
                  const dateBlocks = blocks.filter((b) => isBlockForDate(b, date));
                  const isToday = isSameDate(date, new Date());
                  return (
                    <div key={date.toISOString()} className="flex gap-3">
                      {/* Date label */}
                      <div
                        className="flex-shrink-0 text-center pt-1"
                        style={{ width: '44px' }}
                      >
                        <div
                          className={cn(
                            'text-sm font-semibold',
                            isToday
                              ? 'text-[rgb(0.01,0.16,0.47)] dark:text-blue-400'
                              : 'text-gray-500 dark:text-gray-400'
                          )}
                        >
                          {date.getMonth() + 1}.{date.getDate()}
                        </div>
                        <div className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                          {WEEK_DAYS_LABELS[date.getDay()]}
                        </div>
                      </div>

                      {/* Blocks */}
                      <div className="flex-1 min-w-0">
                        {dateBlocks.length === 0 ? (
                          <p className="text-xs text-gray-400 dark:text-gray-500 py-2">
                            当日没有任务。
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {dateBlocks.map((block) => {
                              const config = CATEGORY_CONFIG[block.taskCategory];
                              // 有对应任务的时间块才显示操作按钮
                              const showActions = !!block.taskID;
                              return (
                                <div
                                  key={block.id}
                                  className="flex items-stretch gap-3 bg-white dark:bg-gray-900 rounded-xl p-3 border border-gray-100 dark:border-gray-800"
                                >
                                  {/* Colored left bar */}
                                  <div
                                    className="w-[6px] rounded-full flex-shrink-0"
                                    style={{ backgroundColor: config?.color }}
                                  />
                                  {/* Content */}
                                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                      {block.timeRange}
                                    </span>
                                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                                      {block.title}
                                    </span>
                                  </div>
                                  {/* Per-block action buttons：打勾 / 专注 / 调整时间 / 删除 */}
                                  {showActions && (
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                      <button
                                        onClick={() => toggleBlockCompletion(block.id)}
                                        className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-green-500 transition-colors"
                                        title="标记完成"
                                      >
                                        {block.isBlockCompleted ? (
                                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                                        ) : (
                                          <Circle className="w-4 h-4" />
                                        )}
                                      </button>
                                      <button
                                        onClick={() => {
                                          if (block.taskID)
                                            navigate(`/timer/${block.taskID}`);
                                        }}
                                        className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-amber-500 transition-colors"
                                        title="进入专注"
                                      >
                                        <Play className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={() => {
                                          if (block.taskID) setEditingBlock(block);
                                        }}
                                        className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-blue-500 transition-colors"
                                        title="调整时间"
                                      >
                                        <SlidersHorizontal className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={() => {
                                          if (block.taskID)
                                            handleDeleteTask(block.taskID);
                                        }}
                                        className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-red-500 transition-colors"
                                        title="删除任务"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ===== 横向日期 ===== */}
            {calendarLayout === 1 && (
              <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
                {/* Large date title — click to open date picker */}
                <div className="flex items-center justify-between mb-4">
                  <button
                    onClick={goToPrevWeek}
                    className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <div className="relative">
                    <h3
                      className="text-[26px] font-bold text-gray-900 dark:text-gray-100 cursor-pointer hover:opacity-70 transition-opacity select-none"
                      onClick={() => {
                        setPickerYear(selectedDate.getFullYear());
                        setPickerMonth(selectedDate.getMonth());
                        setShowDatePicker(!showDatePicker);
                      }}
                    >
                      {selectedDate.getFullYear()}年{selectedDate.getMonth() + 1}月{selectedDate.getDate()}日
                    </h3>

                    {/* Date picker popup */}
                    {showDatePicker && (
                      <div
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 dark:bg-black/40"
                        onClick={handlePickerOverlay}
                      >
                        <div
                          ref={pickerRef}
                          className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-[320px] p-5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {/* Year / Month header */}
                          <div className="flex items-center justify-between mb-4">
                            <button
                              onClick={() => setPickerYear((y) => y - 1)}
                              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 transition-colors"
                            >
                              <ChevronLeft className="w-4 h-4" />
                            </button>
                            <span className="text-base font-bold text-gray-900 dark:text-gray-100">
                              {pickerYear}年{pickerMonth + 1}月
                            </span>
                            <button
                              onClick={() => setPickerYear((y) => y + 1)}
                              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 transition-colors"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Month selector */}
                          <div className="flex gap-1 mb-4">
                            {Array.from({ length: 12 }, (_, i) => (
                              <button
                                key={i}
                                onClick={() => setPickerMonth(i)}
                                className={cn(
                                  'flex-1 py-1 text-[10px] font-medium rounded-md transition-colors',
                                  pickerMonth === i
                                    ? 'bg-[rgb(0.01,0.16,0.47)] text-white'
                                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                                )}
                              >
                                {i + 1}月
                              </button>
                            ))}
                          </div>

                          {/* Week day headers */}
                          <div className="grid grid-cols-7 mb-2">
                            {['日', '一', '二', '三', '四', '五', '六'].map((w) => (
                              <div key={w} className="text-center text-[10px] text-gray-400 dark:text-gray-500 py-1">
                                {w}
                              </div>
                            ))}
                          </div>

                          {/* Day grid */}
                          <div className="grid grid-cols-7 gap-1">
                            {calendarDays.map((d, i) => {
                              if (d === null) return <div key={`e-${i}`} />;
                              const dateObj = new Date(pickerYear, pickerMonth, d);
                              const isSel = isSameDate(dateObj, selectedDate);
                              const isTd = isSameDate(dateObj, today);
                              return (
                                <button
                                  key={`d-${d}`}
                                  onClick={() => {
                                    setSelectedDate(dateObj);
                                    setShowDatePicker(false);
                                  }}
                                  className={cn(
                                    'w-9 h-9 rounded-full text-xs font-medium transition-colors mx-auto',
                                    isSel
                                      ? 'bg-[rgb(0.01,0.16,0.47)] text-white shadow-sm'
                                      : isTd
                                      ? 'ring-1 ring-gray-300 dark:ring-gray-600 text-gray-700 dark:text-gray-300'
                                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                                  )}
                                >
                                  {d}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={goToNextWeek}
                    className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>

                {/* Week day circles */}
                <div className="flex justify-center gap-2 mb-5">
                  {weekDays.map((day, idx) => {
                    const isSelected = isSameDate(day, selectedDate);
                    const isToday = isSameDate(day, new Date());
                    return (
                      <button
                        key={idx}
                        onClick={() => setSelectedDate(day)}
                        className={cn(
                          'w-9 h-9 rounded-full flex flex-col items-center justify-center transition-all text-[10px] font-medium',
                          isSelected
                            ? 'bg-[rgb(0.01,0.16,0.47)] text-white shadow-sm'
                            : isToday
                            ? 'ring-1 ring-gray-300 dark:ring-gray-600 text-gray-600 dark:text-gray-400'
                            : 'text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
                        )}
                      >
                        <span>{WEEK_DAYS_LABELS[idx]}</span>
                        <span className="text-[8px]">{day.getDate()}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Selected date panel */}
                <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-100 dark:border-gray-800">
                  {/* Capsule indicator */}
                  <div className="w-12 h-[5px] bg-gray-200 dark:bg-gray-700 rounded-full mx-auto mb-4" />

                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 text-center mb-4">
                    {selectedDate.getMonth() + 1}月{selectedDate.getDate()}
                    日待完成的任务
                    <span className="text-gray-400 dark:text-gray-500 font-normal ml-1">
                      ({selectedDateBlocks.length})
                    </span>
                  </h4>

                  {selectedDateBlocks.length === 0 ? (
                    <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-6">
                      当日没有任务。
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {selectedDateBlocks.map((block) => {
                        const config = CATEGORY_CONFIG[block.taskCategory];
                        // 有对应任务的时间块才显示操作按钮
                        const showActions = !!block.taskID;
                        return (
                          <div
                            key={block.id}
                            className="flex items-stretch gap-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3"
                          >
                            {/* Colored left bar 6x42 */}
                            <div
                              className="w-[6px] h-[42px] rounded-full flex-shrink-0 self-center"
                              style={{ backgroundColor: config?.color }}
                            />
                            {/* Content right VStack */}
                            <div className="flex-1 min-w-0 flex flex-col justify-center">
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {block.timeRange}
                              </span>
                              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                                {block.title}
                              </span>
                            </div>
                            {/* Per-block action buttons：打勾 / 专注 / 调整时间 / 删除 */}
                            {showActions && (
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <button
                                  onClick={() => toggleBlockCompletion(block.id)}
                                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-green-500 transition-colors"
                                  title="标记完成"
                                >
                                  {block.isBlockCompleted ? (
                                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                                  ) : (
                                    <Circle className="w-4 h-4" />
                                  )}
                                </button>
                                <button
                                  onClick={() => {
                                    if (block.taskID)
                                      navigate(`/timer/${block.taskID}`);
                                  }}
                                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-amber-500 transition-colors"
                                  title="进入专注"
                                >
                                  <Play className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => {
                                    if (block.taskID) setEditingBlock(block);
                                  }}
                                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-blue-500 transition-colors"
                                  title="调整时间"
                                >
                                  <SlidersHorizontal className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => {
                                    if (block.taskID)
                                      handleDeleteTask(block.taskID);
                                  }}
                                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-red-500 transition-colors"
                                  title="删除任务"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 调整专注时间段弹窗 */}
      {editingBlock && (
        <FocusBlockEditorModal
          block={editingBlock}
          onClose={() => setEditingBlock(null)}
        />
      )}
    </div>
  );
}
