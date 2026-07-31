import {
  type PlannedTask,
  type ScheduleBlock,
  type TaskCategory,
  type ScheduleBlockStyle,
} from '@/types';
import { format, parseISO, addDays, isSameDay, differenceInDays, startOfDay, endOfDay } from 'date-fns';

interface TimeWindow {
  start: Date;
  end: Date;
}

const FOCUS_BLOCK_DURATIONS: Record<string, number> = {
  steady: 60,
  split: 90,
  frontLoad: 120,
};

const DAY_WINDOWS: [number, number][] = [
  [8, 12],
  [13, 18],
  [19, 22.5],
];

function toMinutes(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function dateFromMinutes(base: Date, minutes: number): Date {
  const d = new Date(base);
  d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return d;
}

/** 弹性任务在截止时间前排不完的缺口信息（对应 iOS「固定事件与截止时间之间的冲突」） */
export interface FlexibleRiskInfo {
  taskID: string;
  title: string;
  /** 截止时间前无法排完的缺口小时数（>0 表示排不下） */
  remainingHours: number;
  /** 已排到的第一个专注块开始时间 */
  latestStart: Date | null;
  /** 已排到的最后一个专注块结束时间 */
  latestBlockEnd: Date | null;
  deadline: Date;
  blocks: { blockID: string; title: string; timeRange: string }[];
  lastBlockID: string | null;
}

export interface ScheduleResult {
  blocks: ScheduleBlock[];
  flexibleRisks: FlexibleRiskInfo[];
}

export function generateSchedule(tasks: PlannedTask[]): ScheduleResult {
  const fixedBlocks: ScheduleBlock[] = [];
  const manualBlocks: ScheduleBlock[] = [];
  const flexibleTasks: PlannedTask[] = [];

  for (const task of tasks) {
    if (task.isCompleted) continue;

    if (task.isFixedTime && task.fixedStart && task.fixedEnd) {
      fixedBlocks.push(...buildFixedBlock(task));
    } else if (task.manualFocusBlocks.length > 0) {
      // 已手动调整过时间：按手动调整块排程，不再自动排程（对应 iOS 手动调整后的专注块）
      manualBlocks.push(...buildManualFocusBlocks(task));
    } else {
      flexibleTasks.push(task);
    }
  }

  const allBlocks: ScheduleBlock[] = [...fixedBlocks, ...manualBlocks];
  const flexibleRisks: FlexibleRiskInfo[] = [];

  if (flexibleTasks.length > 0) {
    const now = new Date();
    const farthestDeadline = flexibleTasks.reduce((latest, t) => {
      const d = parseISO(t.deadline);
      return d > latest ? d : latest;
    }, now);

    const windows = makePlanningWindows(now, farthestDeadline);
    // 固定块与手动调整块都占用空闲时段，自动排程需要避开
    const availableWindows = subtractWindows(windows, allBlocks);
    const result = buildFlexibleBlocks(flexibleTasks, availableWindows);
    allBlocks.push(...result.blocks);
    flexibleRisks.push(...result.risks);
  }

  return { blocks: allBlocks, flexibleRisks };
}

/** 根据任务的手动调整专注块生成排程块 */
function buildManualFocusBlocks(task: PlannedTask): ScheduleBlock[] {
  const sorted = [...task.manualFocusBlocks].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
  );

  return sorted.map((b) => {
    const start = new Date(b.start);
    const end = new Date(b.end);
    const durationMinutes = Math.max((end.getTime() - start.getTime()) / 60000, 60);
    return {
      id: `${task.id}-manual-${b.id}`,
      taskID: task.id,
      taskCategory: task.category,
      dayLabel: formatDayLabel(start),
      timeRange: `${format(start, 'HH:mm')}-${format(end, 'HH:mm')}`,
      title: b.title || task.title,
      detail: `手动调整块 · ${durationMinutes} 分钟`,
      style: 'focus',
      hasConflict: false,
      startDate: b.start,
      endDate: b.end,
      isBlockCompleted: !!b.isCompleted,
      isBlockDependent: b.dependencyBlockIDs.length > 0,
    };
  });
}

function buildFixedBlock(task: PlannedTask): ScheduleBlock[] {
  const blocks: ScheduleBlock[] = [];
  const start = parseISO(task.fixedStart!);
  const end = parseISO(task.fixedEnd!);

  const repeatMode = task.repeatMode || 'once';

  // 单次（含旧的「每周重复」逻辑回退）
  if (repeatMode === 'once') {
    if (task.repeatsWeekly) {
      const now = new Date();
      const maxDate = task.deadline ? parseISO(task.deadline) : addDays(now, 14);
      const daysUntilDeadline = differenceInDays(maxDate, now);
      const maxWeeks = Math.max(1, Math.min(Math.ceil(daysUntilDeadline / 7), 4));

      for (let w = 0; w < maxWeeks; w++) {
        const blockStart = addDays(start, w * 7);
        const blockEnd = addDays(end, w * 7);
        if (blockStart >= new Date() || isSameDay(blockStart, new Date())) {
          blocks.push(createBlock(task, blockStart, blockEnd, 'fixed'));
        }
      }
    } else {
      blocks.push(createBlock(task, start, end, 'fixed'));
    }
    return blocks;
  }

  // 重复展开：从任务开始日起未来 30 天内所有匹配日期，保留原开始/结束的时分
  const now = new Date();
  const windowDays = 30;
  const startHour = start.getHours();
  const startMinute = start.getMinutes();
  const endHour = end.getHours();
  const endMinute = end.getMinutes();

  const matches = (d: Date): boolean => {
    switch (repeatMode) {
      case 'daily':
        return true;
      case 'weekly': {
        const days = task.weeklyDays || [];
        if (days.length === 0) return true; // 未选择星期时退化为每天
        return days.includes(d.getDay());
      }
      case 'workdays': {
        const day = d.getDay();
        return day >= 1 && day <= 5; // 周一至周五
      }
      case 'holidays': {
        // 近似实现：周六/周日视为假期；真实「法定节假日」需内置节假日数据源
        const day = d.getDay();
        return day === 0 || day === 6;
      }
      default:
        return false;
    }
  };

  for (let i = 0; i <= windowDays; i++) {
    const day = addDays(now, i);
    // 不早于任务开始日期
    if (day.getTime() < startOfDay(start).getTime()) continue;
    if (!matches(day)) continue;

    const blockStart = new Date(day);
    blockStart.setHours(startHour, startMinute, 0, 0);
    const blockEnd = new Date(day);
    blockEnd.setHours(endHour, endMinute, 0, 0);
    // 跨天结束（如 22:00 - 08:00）→ 结束时间顺延到次日
    if (blockEnd.getTime() <= blockStart.getTime()) {
      blockEnd.setDate(blockEnd.getDate() + 1);
    }
    // 已过去且不是今天的块不生成
    if (blockStart.getTime() < now.getTime() && !isSameDay(blockStart, now)) continue;

    blocks.push(createBlock(task, blockStart, blockEnd, 'fixed'));
  }

  return blocks;
}

function formatDayLabel(d: Date): string {
  const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return `${d.getMonth() + 1}.${String(d.getDate()).padStart(2, '0')} ${weekDays[d.getDay()]}`;
}

function createBlock(task: PlannedTask, start: Date, end: Date, style: ScheduleBlockStyle): ScheduleBlock {
  const dayLabel = formatDayLabel(start);
  const timeRange = `${format(start, 'HH:mm')}-${format(end, 'HH:mm')}`;
  const detail = task.isFixedTime ? '固定事件' : (style === 'focus' ? '专注时段' : '弹性任务');

  return {
    id: `${task.id}-${start.toISOString()}-${end.toISOString()}`,
    taskID: task.id,
    taskCategory: task.category,
    dayLabel,
    timeRange,
    title: task.title,
    detail,
    style,
    hasConflict: false,
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    isBlockCompleted: false,
    isBlockDependent: false,
  };
}

function makePlanningWindows(from: Date, to: Date): TimeWindow[] {
  const windows: TimeWindow[] = [];
  let current = startOfDay(from);

  while (current <= to) {
    for (const [startHour, endHour] of DAY_WINDOWS) {
      const ws = new Date(current);
      ws.setHours(startHour, 0, 0, 0);
      const we = new Date(current);
      we.setHours(Math.floor(endHour), (endHour % 1) * 60, 0, 0);

      if (from > ws && isSameDay(from, ws)) continue;
      windows.push({ start: ws, end: we });
    }
    current = addDays(current, 1);
  }
  return windows;
}

function subtractWindows(windows: TimeWindow[], blocks: ScheduleBlock[]): TimeWindow[] {
  if (blocks.length === 0) return windows;

  const busyPeriods = blocks
    .filter(b => b.startDate && b.endDate)
    .map(b => ({ start: parseISO(b.startDate!), end: parseISO(b.endDate!) }))
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const result: TimeWindow[] = [];

  for (const win of windows) {
    let currentStart = win.start;
    for (const busy of busyPeriods) {
      if (busy.end <= currentStart || busy.start >= win.end) continue;
      if (busy.start > currentStart) {
        result.push({ start: currentStart, end: busy.start });
      }
      currentStart = busy.end > currentStart ? busy.end : currentStart;
    }
    if (currentStart < win.end) {
      result.push({ start: currentStart, end: win.end });
    }
  }
  return result;
}

function buildFlexibleBlocks(
  tasks: PlannedTask[],
  windows: TimeWindow[]
): { blocks: ScheduleBlock[]; risks: FlexibleRiskInfo[] } {
  const blocks: ScheduleBlock[] = [];
  const risks: FlexibleRiskInfo[] = [];
  const sortedTasks = [...tasks].sort(
    (a, b) => parseISO(a.deadline).getTime() - parseISO(b.deadline).getTime()
  );
  const available: TimeWindow[] = windows
    .map((w) => ({ ...w }))
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  for (const task of sortedTasks) {
    const deadline = parseISO(task.deadline);
    const totalMinutes = task.estimatedHours * 60;
    const blockDuration = FOCUS_BLOCK_DURATIONS[task.dailyPlan] || 60;
    let remainingMinutes = totalMinutes;
    const taskBlocks: ScheduleBlock[] = [];

    let windowIndex = 0;
    while (remainingMinutes > 0 && windowIndex < available.length) {
      const win = available[windowIndex];
      const winStart = win.start;

      // 窗口在截止时间之后开始，本任务无法使用
      if (winStart >= deadline) {
        windowIndex++;
        continue;
      }

      const rawAvailMinutes = (win.end.getTime() - winStart.getTime()) / 60000;
      if (rawAvailMinutes <= 0) {
        windowIndex++;
        continue;
      }

      // 只允许排到截止时间为止，避免静默排到截止之后
      const cappedEnd = win.end.getTime() > deadline.getTime() ? deadline : win.end;
      const availMinutes = (cappedEnd.getTime() - winStart.getTime()) / 60000;
      if (availMinutes <= 0) {
        windowIndex++;
        continue;
      }

      const blockLen = Math.min(blockDuration, remainingMinutes, availMinutes);
      const blockStart = winStart;
      const blockEnd = new Date(blockStart.getTime() + blockLen * 60000);
      const dayLabel = formatDayLabel(blockStart);

      const block: ScheduleBlock = {
        id: `${task.id}-${blockStart.toISOString()}`,
        taskID: task.id,
        taskCategory: task.category,
        dayLabel,
        timeRange: `${format(blockStart, 'HH:mm')}-${format(blockEnd, 'HH:mm')}`,
        title: task.title,
        detail: task.dailyPlan === 'split' ? '分段专注' : '专注时段',
        style: 'flexible',
        hasConflict: false,
        startDate: blockStart.toISOString(),
        endDate: blockEnd.toISOString(),
        isBlockCompleted: false,
        isBlockDependent: false,
      };

      taskBlocks.push(block);
      blocks.push(block);

      win.start = blockEnd;
      remainingMinutes -= blockLen;

      // 仅当整个窗口被占满时才移动到下一个窗口（被截止时间截断的剩余部分留给后续任务）
      if (rawAvailMinutes - blockLen <= 0.001) {
        windowIndex++;
      }
    }

    if (remainingMinutes > 0.01) {
      risks.push({
        taskID: task.id,
        title: task.title,
        remainingHours: remainingMinutes / 60,
        latestStart: taskBlocks.length > 0 ? new Date(taskBlocks[0].startDate!) : null,
        latestBlockEnd: taskBlocks.length > 0 ? new Date(taskBlocks[taskBlocks.length - 1].endDate!) : null,
        deadline,
        blocks: taskBlocks.map((b) => ({ blockID: b.id, title: b.title, timeRange: b.timeRange })),
        lastBlockID: taskBlocks.length > 0 ? taskBlocks[taskBlocks.length - 1].id : null,
      });
    }
  }

  return { blocks, risks };
}
