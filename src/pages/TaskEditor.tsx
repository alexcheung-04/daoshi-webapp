import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTaskStore } from '@/store/taskStore';
import { useAuthStore } from '@/store/authStore';
import { CATEGORY_CONFIG, DAILY_PLAN_LABELS, REPEAT_MODE_LABELS, WEEKDAY_LABELS } from '@/types';
import type { TaskCategory, DailyPlanPreset, PlannedTask, RepeatMode } from '@/types';

function generateId(): string {
  return `task-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function toDatetimeLocal(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function fromDatetimeLocal(val: string): string {
  if (!val) return '';
  return new Date(val).toISOString();
}

function computeDuration(start: string, end: string): string {
  if (!start || !end) return '';
  const diff = new Date(end).getTime() - new Date(start).getTime();
  if (diff <= 0) return '';
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  if (hours > 0 && minutes > 0) return `${hours}小时${minutes}分钟`;
  if (hours > 0) return `${hours}小时`;
  return `${minutes}分钟`;
}

// Auto-detect category from title keywords
function autoDetectCategory(title: string): TaskCategory | null {
  const lower = title.toLowerCase();

  // exam keywords
  const examKeywords = ['考试', '测验', '期末', '期中', '考', 'exam', 'test', 'quiz', 'final', 'midterm', '上课', '听课', '讲座', 'class', 'lecture'];
  if (examKeywords.some(k => lower.includes(k))) return 'exam';

  // study keywords
  const studyKeywords = ['学习', '作业', '复习', '预习', '读书', '阅读', '写', '做', 'study', 'homework', 'assignment', 'read', 'research', 'project', '论文', '报告', '实验'];
  if (studyKeywords.some(k => lower.includes(k))) return 'study';

  // entertainment keywords
  const entertainmentKeywords = ['娱乐', '游戏', '电影', '音乐', '视频', '动漫', '综艺', 'entertainment', 'game', 'movie', 'music', 'video', 'anime', 'play'];
  if (entertainmentKeywords.some(k => lower.includes(k))) return 'entertainment';

  // focus keywords
  const focusKeywords = ['专注', '计时', '番茄', 'focus', 'timer', 'pomodoro', '冥想', '深呼吸'];
  if (focusKeywords.some(k => lower.includes(k))) return 'focus';

  // life keywords
  const lifeKeywords = ['生活', '日常', '购物', '运动', '健身', '社交', '睡觉', '休息', 'life', 'daily', 'shop', 'workout', 'exercise', 'sleep', 'rest', '吃饭', '散步'];
  if (lifeKeywords.some(k => lower.includes(k))) return 'life';

  return null;
}

const categories = Object.entries(CATEGORY_CONFIG) as [TaskCategory, typeof CATEGORY_CONFIG[TaskCategory]][];

const dailyPlanOptions: { value: DailyPlanPreset; label: string }[] = [
  { value: 'steady', label: '稳步推进' },
  { value: 'split', label: '拆成多段' },
  { value: 'frontLoad', label: '提前前移' },
];

const repeatOptions: { value: RepeatMode; label: string }[] = [
  { value: 'once', label: '单次' },
  { value: 'daily', label: '每天' },
  { value: 'weekly', label: '每周（自定义）' },
  { value: 'workdays', label: '法定工作日' },
  { value: 'holidays', label: '法定节假日' },
];

export default function TaskEditor() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  const { tasks, addTask, updateTask, deleteTask } = useTaskStore();
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const openLoginModal = useAuthStore((s) => s.openLoginModal);

  const existingTask = isEdit ? tasks.find((t) => t.id === id) : null;

  // ===== Form State =====
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<TaskCategory>('study');
  const [deadline, setDeadline] = useState('');
  const [estimatedHours, setEstimatedHours] = useState(1);
  const [dailyPlan, setDailyPlan] = useState<DailyPlanPreset>('steady');
  const [isFixedTime, setIsFixedTime] = useState(false);
  const [fixedStart, setFixedStart] = useState('');
  const [fixedEnd, setFixedEnd] = useState('');
  const [repeatsWeekly, setRepeatsWeekly] = useState(false);
  const [locationText, setLocationText] = useState('');
  // 重复规则（非「学习/作业」任务）
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('once');
  const [weeklyDays, setWeeklyDays] = useState<number[]>([]);
  const [saveError, setSaveError] = useState('');

  // Track whether user manually changed category
  const [categoryManuallyChanged, setCategoryManuallyChanged] = useState(false);

  // ===== Auto-detect category from title =====
  const autoCategory = useMemo(() => {
    if (!title.trim()) return null;
    return autoDetectCategory(title);
  }, [title]);

  // When title changes, auto-update category unless user has manually changed it
  useEffect(() => {
    if (!categoryManuallyChanged && autoCategory && autoCategory !== category) {
      setCategory(autoCategory);
    }
  }, [autoCategory]); // eslint-disable-line react-hooks/exhaustive-deps

  // ===== Load existing task data =====
  useEffect(() => {
    if (existingTask) {
      setTitle(existingTask.title);
      setCategory(existingTask.category);
      setDeadline(toDatetimeLocal(existingTask.deadline));
      setEstimatedHours(existingTask.estimatedHours);
      setDailyPlan(existingTask.dailyPlan);
      setIsFixedTime(existingTask.isFixedTime);
      setFixedStart(existingTask.fixedStart ? toDatetimeLocal(existingTask.fixedStart) : '');
      setFixedEnd(existingTask.fixedEnd ? toDatetimeLocal(existingTask.fixedEnd) : '');
      setRepeatsWeekly(existingTask.repeatsWeekly);
      setLocationText(existingTask.locationText || '');
      setRepeatMode(existingTask.repeatMode || 'once');
      setWeeklyDays(existingTask.weeklyDays || []);
    }
  }, [existingTask]);

  // 新增任务时自动预填当前系统时间，用户可手动修改
  useEffect(() => {
    if (isEdit) return;
    const now = new Date();
    const plusOneHour = new Date(now.getTime() + 60 * 60000);
    if (!fixedStart) setFixedStart(toDatetimeLocal(now.toISOString()));
    if (!fixedEnd) setFixedEnd(toDatetimeLocal(plusOneHour.toISOString()));
    if (!deadline) setDeadline(toDatetimeLocal(plusOneHour.toISOString()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit]);

  // ===== Computed values =====
  const isExam = category === 'exam';
  // 除「学习/作业」外，任务一律用开始时间 + 结束时间定义（不使用截止时间）
  const usesTimeRange = category !== 'study';

  const toggleWeekday = (d: number) => {
    setWeeklyDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort((a, b) => a - b)
    );
  };

  // Determine if auto-detected differs from current selection
  const isCategoryOverridden = categoryManuallyChanged && autoCategory && autoCategory !== category;

  // Duration text
  const durationText = useMemo(() => {
    if (isFixedTime && fixedStart && fixedEnd) {
      return computeDuration(fixedStart, fixedEnd);
    }
    return '';
  }, [isFixedTime, fixedStart, fixedEnd]);

  // ===== Handlers =====
  const handleCategorySelect = (cat: TaskCategory) => {
    setCategory(cat);
    setCategoryManuallyChanged(true);
  };

  const handleRestoreAutoCategory = () => {
    if (autoCategory) {
      setCategory(autoCategory);
      setCategoryManuallyChanged(false);
    }
  };

  const handleSave = () => {
    if (!isLoggedIn) {
      openLoginModal();
      return;
    }
    setSaveError('');
    if (!title.trim()) return;

    // 时间范围任务：必须填写开始/结束时间且结束晚于开始
    if (usesTimeRange) {
      if (!fixedStart || !fixedEnd) {
        setSaveError('请填写开始时间和结束时间');
        return;
      }
      if (new Date(fixedEnd).getTime() <= new Date(fixedStart).getTime()) {
        setSaveError('结束时间必须晚于开始时间');
        return;
      }
    } else if (!deadline && !isFixedTime) {
      return;
    }

    // 每周（自定义）必须至少选择一个星期
    if (repeatMode === 'weekly' && weeklyDays.length === 0) {
      setSaveError('请至少选择一个星期');
      return;
    }

    // 时间范围任务：预估时长由开始/结束时间自动计算
    const computedHours =
      usesTimeRange && fixedStart && fixedEnd
        ? Math.max(0.5, Math.round(((new Date(fixedEnd).getTime() - new Date(fixedStart).getTime()) / 3600000) * 10) / 10)
        : estimatedHours;

    const base: Omit<PlannedTask, 'id'> = {
      title: title.trim(),
      category,
      deadline:
        usesTimeRange && fixedEnd
          ? new Date(fixedEnd).toISOString()
          : deadline
            ? new Date(deadline).toISOString()
            : new Date().toISOString(),
      estimatedHours: computedHours,
      dailyPlan,
      isFixedTime: usesTimeRange ? true : isFixedTime,
      fixedStart: (usesTimeRange || isFixedTime) && fixedStart ? fromDatetimeLocal(fixedStart) : undefined,
      fixedEnd: (usesTimeRange || isFixedTime) && fixedEnd ? fromDatetimeLocal(fixedEnd) : undefined,
      repeatsWeekly: !usesTimeRange && isFixedTime ? repeatsWeekly : false,
      repeatMode: usesTimeRange ? repeatMode : 'once',
      weeklyDays: usesTimeRange && repeatMode === 'weekly' ? weeklyDays : [],
      conflictReminderEnabled: true,
      manualFocusBlocks: existingTask?.manualFocusBlocks || [],
      locationText: locationText.trim() || undefined,
      isCompleted: existingTask?.isCompleted || false,
    };

    if (isEdit && id) {
      updateTask(id, base);
    } else {
      addTask({ ...base, id: generateId() });
    }

    navigate('/tasks');
  };

  const handleDelete = () => {
    if (!isLoggedIn) {
      openLoginModal();
      return;
    }
    if (isEdit && id) {
      deleteTask(id);
      navigate('/tasks');
    }
  };

  const handleCancel = () => {
    navigate(-1);
  };

  return (
    <div className="max-w-[920px] mx-auto" style={{ padding: '24px' }}>
      <div className="space-y-[18px]">
        {/* ===== Header ===== */}
        <div className="bg-[var(--surface)] rounded-3xl shadow-lg p-6">
          <div className="flex items-center gap-3 mb-2">
            <button
              onClick={handleCancel}
              className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {isEdit ? '编辑已录入任务' : '录入新任务'}
            </h1>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 ml-11">
            可直接修改任务名称和时间，任务类型会根据标题自动重新识别。
          </p>
        </div>

        {/* ===== 任务名称 ===== */}
        <div className="bg-[var(--surface)] rounded-3xl shadow-lg p-6">
          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">
            任务名称
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="键入你要执行的任务…"
            className="w-full text-xl font-bold py-2 px-0 border-0 border-b-2 border-gray-200 dark:border-gray-700 bg-transparent text-gray-900 dark:text-gray-100 placeholder-gray-300 dark:placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        {/* ===== 智能识别任务类型 ===== */}
        <div className="bg-[var(--surface)] rounded-3xl shadow-lg p-6">
          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wider">
            智能识别任务类型
          </label>

          {/* Tags */}
          <div className="flex items-center gap-2 mb-4">
            {autoCategory && (
              <span
                className="text-[11px] font-medium px-2.5 py-1 rounded-full"
                style={{
                  backgroundColor: CATEGORY_CONFIG[autoCategory]?.lightBg,
                  color: CATEGORY_CONFIG[autoCategory]?.color,
                }}
              >
                自动识别结果: {CATEGORY_CONFIG[autoCategory]?.label}
              </span>
            )}
            {isCategoryOverridden && (
              <span
                className="text-[11px] font-medium px-2.5 py-1 rounded-full"
                style={{
                  backgroundColor: CATEGORY_CONFIG[category]?.lightBg,
                  color: CATEGORY_CONFIG[category]?.color,
                }}
              >
                当前保存类型: {CATEGORY_CONFIG[category]?.label}
              </span>
            )}
          </div>

          {/* Category chips */}
          <div className="flex flex-wrap gap-2">
            {categories.map(([key, config]) => (
              <button
                key={key}
                onClick={() => handleCategorySelect(key)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                  category === key
                    ? 'border-transparent text-white shadow-sm'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                )}
                style={
                  category === key
                    ? { backgroundColor: config.color }
                    : undefined
                }
              >
                {config.label}
              </button>
            ))}
          </div>

          {/* Restore auto-detection button */}
          {isCategoryOverridden && (
            <button
              onClick={handleRestoreAutoCategory}
              className="mt-3 flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              恢复自动识别结果
            </button>
          )}
        </div>

        {/* ===== Date/Time ===== */}
        <div className="bg-[var(--surface)] rounded-3xl shadow-lg p-6">
          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wider">
            {usesTimeRange || isFixedTime ? '时间范围' : '截止时间'}
          </label>

          {usesTimeRange || isFixedTime ? (
            /* 非学习/作业任务（或学习任务开启固定时间）：开始时间 + 结束时间 */
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 dark:text-gray-500 mb-1">
                    开始时间
                  </label>
                  <input
                    type="datetime-local"
                    value={fixedStart}
                    onChange={(e) => setFixedStart(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 dark:text-gray-500 mb-1">
                    结束时间
                  </label>
                  <input
                    type="datetime-local"
                    value={fixedEnd}
                    onChange={(e) => setFixedEnd(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                </div>
              </div>
              {durationText && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  共 {durationText}
                </p>
              )}
            </div>
          ) : (
            /* 学习/作业：截止时间 + 预估时间 + 每日安排 */
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 dark:text-gray-500 mb-1">
                  截止日期
                </label>
                <input
                  type="datetime-local"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 dark:text-gray-500 mb-1">
                  预估时间（小时）
                </label>
                <input
                  type="number"
                  value={estimatedHours}
                  onChange={(e) => setEstimatedHours(Math.max(0.5, Math.min(24, parseFloat(e.target.value) || 0.5)))}
                  step={0.5}
                  min={0.5}
                  max={24}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>

              {/* Daily Plan (flexible tasks only) */}
              <div>
                <label className="block text-xs text-gray-400 dark:text-gray-500 mb-2">
                  每日安排
                </label>
                <div className="flex gap-2">
                  {dailyPlanOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setDailyPlan(option.value)}
                      className={cn(
                        'flex-1 px-3 py-2 rounded-xl text-xs font-medium border transition-all',
                        dailyPlan === option.value
                          ? 'border-transparent text-white shadow-sm'
                          : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                      )}
                      style={
                        dailyPlan === option.value
                          ? { backgroundColor: 'rgb(0.01, 0.16, 0.47)' }
                          : undefined
                      }
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ===== 固定时间任务开关（仅学习/作业显示）===== */}
        {!usesTimeRange && (
          <div className="bg-[var(--surface)] rounded-3xl shadow-lg p-6">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                固定时间任务
              </span>
              <button
                onClick={() => setIsFixedTime(!isFixedTime)}
                className={cn(
                  'w-11 h-6 rounded-full transition-colors relative',
                  isFixedTime ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                )}
              >
                <span
                  className={cn(
                    'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform',
                    isFixedTime && 'translate-x-5'
                  )}
                />
              </button>
            </div>

            {/* Repeats Weekly - shown when fixed time is on */}
            {isFixedTime && (
              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={repeatsWeekly}
                    onChange={(e) => setRepeatsWeekly(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500/30"
                  />
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    每周重复
                  </span>
                </label>
              </div>
            )}
          </div>
        )}

        {/* ===== 重复规则（非学习/作业任务）===== */}
        {usesTimeRange && (
          <div className="bg-[var(--surface)] rounded-3xl shadow-lg p-6">
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wider">
              重复
            </label>
            <div className="flex flex-wrap gap-2">
              {repeatOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setRepeatMode(opt.value)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                    repeatMode === opt.value
                      ? 'border-transparent text-white shadow-sm'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                  )}
                  style={
                    repeatMode === opt.value
                      ? { backgroundColor: 'rgb(0.01, 0.16, 0.47)' }
                      : undefined
                  }
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* 每周（自定义）：选择星期，可多选或单选 */}
            {repeatMode === 'weekly' && (
              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                <label className="block text-xs text-gray-400 dark:text-gray-500 mb-2">
                  选择星期（可多选或单选）
                </label>
                <div className="flex flex-wrap gap-2">
                  {WEEKDAY_LABELS.map((label, idx) => (
                    <button
                      key={idx}
                      onClick={() => toggleWeekday(idx)}
                      className={cn(
                        'w-11 h-11 rounded-full text-sm font-medium border transition-all',
                        weeklyDays.includes(idx)
                          ? 'border-transparent text-white shadow-sm'
                          : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                      )}
                      style={
                        weeklyDays.includes(idx)
                          ? { backgroundColor: 'rgb(0.01, 0.16, 0.47)' }
                          : undefined
                      }
                    >
                      {label.replace('周', '')}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 当前重复规则摘要 */}
            {repeatMode !== 'once' && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
                {REPEAT_MODE_LABELS[repeatMode]}
                {repeatMode === 'weekly' && weeklyDays.length > 0
                  ? `：${weeklyDays.map((d) => WEEKDAY_LABELS[d]).join('、')}`
                  : ''}
              </p>
            )}
          </div>
        )}

        {/* ===== Location (exam tasks only) ===== */}
        <div className="bg-[var(--surface)] rounded-3xl shadow-lg p-6">
          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">
            地点
          </label>
          <input
            type="text"
            value={locationText}
            onChange={(e) => setLocationText(e.target.value)}
            placeholder={isExam ? '请输入上课/考试地点' : '选填'}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
          {isExam && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              上课/考试任务建议填写地点信息
            </p>
          )}
        </div>

        {/* ===== Action Buttons ===== */}
        <div className="bg-[var(--surface)] rounded-3xl shadow-lg p-6">
          <div className="flex flex-col gap-3">
            {saveError && (
              <p className="text-sm text-red-500 dark:text-red-400 text-center">{saveError}</p>
            )}
            {/* Save */}
            <button
              onClick={handleSave}
              disabled={!title.trim()}
              className="w-full py-3 rounded-xl text-white font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg transition-all hover:opacity-90"
              style={{
                background: 'linear-gradient(135deg, rgb(0.01, 0.16, 0.47), rgb(0.03, 0.25, 0.65))',
              }}
            >
              保存修改
            </button>

            {/* Delete (edit mode only) */}
            {isEdit && (
              <button
                onClick={handleDelete}
                className="w-full py-3 rounded-xl text-white font-medium text-sm flex items-center justify-center gap-2 transition-all hover:opacity-90"
                style={{ backgroundColor: '#EF4444' }}
              >
                删除任务
              </button>
            )}

            {/* Cancel */}
            <button
              onClick={handleCancel}
              className="w-full py-3 rounded-xl text-gray-500 dark:text-gray-400 font-medium text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
