import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
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

function toTimeLocal(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function fromTimeLocal(val: string): string {
  if (!val) return '';
  const today = new Date();
  const [h, m] = val.split(':').map(Number);
  today.setHours(h, m, 0, 0);
  return today.toISOString();
}

function computeDuration(start: string, end: string): string {
  if (!start || !end) return '';
  // start/end are "HH:MM" format; convert to today's Date for comparison
  const startDate = fromTimeLocal(start);
  const endDate = fromTimeLocal(end);
  const diff = new Date(endDate).getTime() - new Date(startDate).getTime();
  if (diff <= 0) return '';
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  if (hours > 0 && minutes > 0) return `${hours}小时${minutes}分钟`;
  if (hours > 0) return `${hours}小时`;
  return `${minutes}分钟`;
}

const categories = Object.entries(CATEGORY_CONFIG) as [TaskCategory, typeof CATEGORY_CONFIG[TaskCategory]][];

const dailyPlanOptions: { value: DailyPlanPreset; label: string; description: string }[] = [
  { value: 'steady', label: '稳步推进', description: '每天安排一段稳定推进' },
  { value: 'split', label: '拆成多段', description: '拆成多个短时段完成' },
  { value: 'frontLoad', label: '提前前移', description: '优先前移到更早的可用时间' },
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
  // 自定义颜色
  const [customColor, setCustomColor] = useState('');

  // ===== Load existing task data =====
  useEffect(() => {
    if (existingTask) {
      setTitle(existingTask.title);
      setCategory(existingTask.category);
      setDeadline(toDatetimeLocal(existingTask.deadline));
      setEstimatedHours(existingTask.estimatedHours);
      setDailyPlan(existingTask.dailyPlan);
      setIsFixedTime(existingTask.isFixedTime);
      // 时间范围任务只存储时间部分
      setFixedStart(existingTask.fixedStart ? toTimeLocal(existingTask.fixedStart) : '');
      setFixedEnd(existingTask.fixedEnd ? toTimeLocal(existingTask.fixedEnd) : '');
      setRepeatsWeekly(existingTask.repeatsWeekly);
      setLocationText(existingTask.locationText || '');
      setRepeatMode(existingTask.repeatMode || 'once');
      setWeeklyDays(existingTask.weeklyDays || []);
      setCustomColor(existingTask.color || '');
    }
  }, [existingTask]);

  // 新增任务时自动预填当前系统时间，用户可手动修改
  useEffect(() => {
    if (isEdit) return;
    const now = new Date();
    const plusOneHour = new Date(now.getTime() + 60 * 60000);
    if (!fixedStart) setFixedStart(toTimeLocal(now.toISOString()));
    if (!fixedEnd) setFixedEnd(toTimeLocal(plusOneHour.toISOString()));
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
        ? Math.max(0.5, Math.round(((new Date(fromTimeLocal(fixedEnd)).getTime() - new Date(fromTimeLocal(fixedStart)).getTime()) / 3600000) * 10) / 10)
        : estimatedHours;

    const base: Omit<PlannedTask, 'id'> = {
      title: title.trim(),
      category,
      deadline:
        usesTimeRange && fixedEnd
          ? new Date(fromTimeLocal(fixedEnd)).toISOString()
          : deadline
            ? new Date(deadline).toISOString()
            : new Date().toISOString(),
      estimatedHours: computedHours,
      dailyPlan,
      isFixedTime: usesTimeRange ? true : isFixedTime,
      fixedStart: (usesTimeRange || isFixedTime) && fixedStart ? fromTimeLocal(fixedStart) : undefined,
      fixedEnd: (usesTimeRange || isFixedTime) && fixedEnd ? fromTimeLocal(fixedEnd) : undefined,
      repeatsWeekly: !usesTimeRange && isFixedTime ? repeatsWeekly : false,
      repeatMode: usesTimeRange ? repeatMode : 'once',
      weeklyDays: usesTimeRange && repeatMode === 'weekly' ? weeklyDays : [],
      conflictReminderEnabled: true,
      manualFocusBlocks: existingTask?.manualFocusBlocks || [],
      locationText: locationText.trim() || undefined,
      isCompleted: existingTask?.isCompleted || false,
      color: customColor || CATEGORY_CONFIG[category].color,
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
            可直接修改任务名称和时间。
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

        {/* ===== 任务类型 ===== */}
        <div className="bg-[var(--surface)] rounded-3xl shadow-lg p-6">
          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wider">
            任务类型
          </label>

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
        </div>

        {/* ===== 自定义颜色 ===== */}
        <div className="bg-[var(--surface)] rounded-3xl shadow-lg p-6">
          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wider">
            自定义颜色
          </label>

          {/* 预设颜色 */}
          <div className="flex flex-wrap gap-2 mb-3">
            {[
              { label: '红色', value: '#EF4444' },
              { label: '橙色', value: '#F59E0B' },
              { label: '黄色', value: '#EAB308' },
              { label: '绿色', value: '#22C55E' },
              { label: '青色', value: '#14B8A6' },
              { label: '蓝色', value: '#3B82F6' },
              { label: '紫色', value: '#8B5CF6' },
              { label: '粉色', value: '#EC4899' },
            ].map((color) => (
              <button
                key={color.value}
                onClick={() => setCustomColor(color.value)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                  customColor === color.value
                    ? 'border-transparent text-white shadow-sm'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                )}
                style={
                  customColor === color.value && color.value
                    ? { backgroundColor: color.value }
                    : undefined
                }
              >
                {color.label}
              </button>
            ))}
          </div>

          {/* 自定义颜色输入 */}
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={customColor || CATEGORY_CONFIG[category].color}
              onChange={(e) => setCustomColor(e.target.value)}
              className="w-10 h-10 rounded-lg cursor-pointer border border-gray-200 dark:border-gray-700"
            />
            <input
              type="text"
              value={customColor || CATEGORY_CONFIG[category].color}
              onChange={(e) => setCustomColor(e.target.value)}
              placeholder={CATEGORY_CONFIG[category].color}
              className="flex-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
            {customColor && (
              <button
                onClick={() => setCustomColor('')}
                className="px-3 py-2 rounded-lg text-xs font-medium text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                重置
              </button>
            )}
          </div>
          {customColor && (
            <div className="mt-2 flex items-center gap-2">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: customColor }}
              />
              <span className="text-xs text-gray-500 dark:text-gray-400">
                自定义颜色
              </span>
            </div>
          )}
        </div>

        {/* ===== Date/Time ===== */}
        <div className="bg-[var(--surface)] rounded-3xl shadow-lg p-6">
          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wider">
            {usesTimeRange || (isFixedTime && category !== 'study') ? '时间段' : '提交截止时间'}
          </label>

          {usesTimeRange || (isFixedTime && category !== 'study') ? (
            /* 非学习/作业任务（或学习任务开启固定时间）：开始时间 + 结束时间 */
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 dark:text-gray-500 mb-1">
                    开始时间
                  </label>
                  <input
                    type="time"
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
                    type="time"
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
                  提交截止日期
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
                  预估总时间（小时）
                </label>
                <input
                  type="number"
                  value={estimatedHours}
                  onChange={(e) => setEstimatedHours(Math.max(0.5, Math.min(100, parseFloat(e.target.value) || 0.5)))}
                  step={0.5}
                  min={0.5}
                  max={100}
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
                <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
                  {dailyPlanOptions.find(o => o.value === dailyPlan)?.description}
                </p>
              </div>
            </div>
          )}
        </div>

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
