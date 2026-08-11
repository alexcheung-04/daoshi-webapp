import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Play,
  Pause,
  StopCircle,
  RotateCcw,
  Clock,
  Timer as TimerIcon,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTaskStore } from '@/store/taskStore';
import { CATEGORY_CONFIG, DAILY_PLAN_LABELS } from '@/types';
import type { PlannedTask } from '@/types';

type TimerMode = 'deadline' | 'focusTimer';

function formatHours(hours: number): string {
  return hours.toLocaleString('en-US'); // 千位分隔符
}

function formatDeadlineCountdown(seconds: number): string {
  const totalSecs = Math.max(0, seconds);
  const hours = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  if (hours > 0) {
    return `${formatHours(hours)}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function formatFocusTimer(seconds: number): string {
  const totalSecs = Math.max(0, seconds);
  const hours = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  if (hours > 0) {
    return `${formatHours(hours)}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function formatDeadlineDate(iso: string): string {
  const d = new Date(iso);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${year}年${month}月${day}日 ${hours}:${mins}`;
}

function playCompletionSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
    osc.frequency.setValueAtTime(1320, ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.6);
  } catch {
    // Fallback
  }
}

function getTimerMode(task: PlannedTask): TimerMode {
  if (task.category === 'focus' || task.category === 'study') {
    if (task.category === 'focus') return 'focusTimer';
    // study tasks with a deadline in the future use deadline mode
    const deadline = new Date(task.deadline).getTime();
    if (deadline > Date.now()) return 'deadline';
    return 'focusTimer';
  }
  if (task.category === 'exam') return 'deadline';
  return 'focusTimer';
}

export default function FocusTimer() {
  const navigate = useNavigate();
  const { taskId } = useParams();
  const { tasks, getTaskById, toggleTaskCompletion } = useTaskStore();

  const task = taskId ? getTaskById(taskId) : null;
  const availableTasks = tasks.filter(
    (t) => !t.isCompleted && (t.category === 'focus' || t.category === 'study' || t.category === 'exam')
  );

  const timerMode: TimerMode = task ? getTimerMode(task) : 'focusTimer';

  // Compute initial time based on mode
  const getInitialTime = useCallback((): number => {
    if (!task) return 25 * 60; // default 25 min
    if (timerMode === 'deadline') {
      const deadline = new Date(task.deadline).getTime();
      const now = Date.now();
      return Math.max(0, Math.floor((deadline - now) / 1000));
    }
    // focusTimer mode: use fixedStart/fixedEnd time range, or estimatedHours
    if (task.isFixedTime && task.fixedStart && task.fixedEnd) {
      const start = new Date(task.fixedStart).getTime();
      const end = new Date(task.fixedEnd).getTime();
      const durationSecs = Math.floor((end - start) / 1000);
      return Math.max(60, durationSecs); // at least 1 minute
    }
    // fallback: use estimatedHours
    const mins = Math.max(1, Math.round(task.estimatedHours * 60));
    return mins * 60;
  }, [task, timerMode]);

  const [timeLeft, setTimeLeft] = useState(getInitialTime());
  const [isRunning, setIsRunning] = useState(!!task); // Auto-start when task is present
  const [isCompleted, setIsCompleted] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset when task changes
  useEffect(() => {
    setTimeLeft(getInitialTime());
    setIsRunning(!!task); // Auto-start when task is present
    setIsCompleted(false);
    setShowAlert(false);
  }, [getInitialTime, taskId]);

  // Timer tick
  useEffect(() => {
    if (isRunning && !isCompleted) {
      intervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setIsRunning(false);
            setIsCompleted(true);
            setShowAlert(true);
            playCompletionSound();
            if (intervalRef.current) clearInterval(intervalRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRunning, isCompleted]);

  // Background color based on mode
  const getBgStyle = useCallback((): React.CSSProperties => {
    if (timerMode === 'focusTimer') {
      return { background: 'linear-gradient(180deg, rgb(0.20, 0.08, 0.42), rgb(0.10, 0.04, 0.25))' };
    }
    // deadline mode: color based on time remaining
    const hoursLeft = timeLeft / 3600;
    if (hoursLeft < 1) return { backgroundColor: 'rgb(0.93, 0.31, 0.24)' };
    if (hoursLeft < 24) return { backgroundColor: 'rgb(1.0, 0.6, 0.0)' };
    if (hoursLeft < 48) return { backgroundColor: 'rgb(0.9, 0.8, 0.1)' };
    return { backgroundColor: 'rgb(0.01, 0.16, 0.47)' };
  }, [timerMode, timeLeft]);

  const handleStartPause = () => {
    if (isCompleted) return;
    setIsRunning((prev) => !prev);
  };

  const handleStop = () => {
    setIsRunning(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    navigate(-1);
  };

  const handleReset = () => {
    setIsRunning(false);
    setIsCompleted(false);
    setShowAlert(false);
    setTimeLeft(getInitialTime());
  };

  const handleDismissAlert = () => {
    setShowAlert(false);
    if (timerMode === 'focusTimer') {
      navigate(-1);
    }
  };

  // Task Selection View (when no taskId)
  if (!task) {
    return (
      <div className="flex flex-col min-h-[70vh] px-4">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
          >
            <X className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            专注计时
          </h1>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <TimerIcon className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4" />
          <h2 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-1">
            选择一项学习或专注任务开始计时
          </h2>
          <p className="text-sm text-gray-400 dark:text-gray-500 mb-8">
            计时时长将根据任务的类型和预估时间自动设定
          </p>

          <div className="w-full space-y-2 max-w-sm">
            {availableTasks.map((t) => {
              const cfg = CATEGORY_CONFIG[t.category];
              const mode = getTimerMode(t);
              return (
                <button
                  key={t.id}
                  onClick={() => navigate(`/timer/${t.id}`)}
                  className="w-full flex items-center gap-3 p-4 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 hover:shadow-md transition-all text-left"
                >
                  <Clock className="w-5 h-5 text-gray-400" />
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {t.title}
                    </p>
                    <p className="text-xs text-gray-400">
                      {cfg.label}
                      {mode === 'deadline' && ' · 倒计时模式'}
                      {mode === 'focusTimer' && ' · 专注计时模式'}
                    </p>
                  </div>
                </button>
              );
            })}
            {availableTasks.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-8">
                没有可用的学习或专注任务
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  const cfg = CATEGORY_CONFIG[task.category];

  return (
    <div
      className="flex flex-col items-center justify-center min-h-[80vh] px-4 rounded-3xl text-white relative overflow-hidden"
      style={getBgStyle()}
    >
      {/* Alert overlay */}
      {showAlert && (
        <div className="absolute inset-0 bg-[var(--surface)]/80 flex items-center justify-center z-10 rounded-3xl">
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 text-center max-w-xs mx-4 shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center mx-auto mb-4">
              <TimerIcon className="w-8 h-8 text-green-500" />
            </div>
            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              {timerMode === 'focusTimer' ? '当前专注计时已结束' : '专注时间结束'}
            </p>
            {timerMode === 'focusTimer' && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                你的专注时段已完成，继续保持！
              </p>
            )}
            <button
              onClick={handleDismissAlert}
              className="px-6 py-2.5 rounded-xl text-white font-medium text-sm shadow-lg"
              style={{ backgroundColor: 'rgb(0.01, 0.16, 0.47)' }}
            >
              知道了
            </button>
          </div>
        </div>
      )}

      {/* Deadline Mode Layout */}
      {timerMode === 'deadline' && (
        <>
          <p className="text-[28px] font-bold mb-4 text-white/90">
            {task.title}剩余
          </p>
          <p className="text-[92px] font-bold tracking-wider text-white leading-none mb-4" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Rounded", "SF Pro Display", "Helvetica Neue", Arial, sans-serif', fontWeight: 900 }}>
            {formatDeadlineCountdown(timeLeft)}
          </p>
          <p className="text-[26px] font-bold text-white/80">
            截止时间：{formatDeadlineDate(task.deadline)}
          </p>
          {task.manualFocusBlocks.length > 0 && (
            <div className="mt-4 text-sm text-white/60">
              <p>专注时段: {task.manualFocusBlocks.filter(b => !b.isCompleted).length} 个待完成</p>
            </div>
          )}
        </>
      )}

      {/* Focus Timer Mode Layout */}
      {timerMode === 'focusTimer' && (
        <>
          <p className="text-[28px] font-bold mb-4 text-white/90">
            当前专注时段剩余
          </p>
          <p className="text-[110px] font-bold tracking-wider text-white leading-none mb-4" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Rounded", "SF Pro Display", "Helvetica Neue", Arial, sans-serif', fontWeight: 900 }}>
            {formatFocusTimer(timeLeft)}
          </p>
          <p className="text-[24px] font-semibold text-white/88">
            {task.title}
          </p>
        </>
      )}

      {/* Controls */}
      <div className="flex items-center gap-6 mt-12">
        {/* Pause/Play toggle */}
        <button
          onClick={handleStartPause}
          disabled={isCompleted}
          className="w-[78px] h-[78px] rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
        >
          {isRunning ? (
            <Pause className="w-8 h-8" />
          ) : (
            <Play className="w-8 h-8 ml-1" />
          )}
        </button>

        {/* Stop button */}
        <button
          onClick={handleStop}
          className="w-[78px] h-[78px] rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-all shadow-lg"
        >
          <StopCircle className="w-8 h-8" />
        </button>

        {/* Reset button */}
        <button
          onClick={handleReset}
          className="w-[78px] h-[78px] rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-all shadow-lg"
        >
          <RotateCcw className="w-8 h-8" />
        </button>
      </div>
    </div>
  );
}
