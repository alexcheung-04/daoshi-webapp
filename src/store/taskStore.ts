import { create } from 'zustand';
import type { PlannedTask, ScheduleBlock, AppState, Conflict, ConflictSuggestion, LLMBlockPlan, ManualFocusBlock } from '@/types';
import { storage } from '@/utils/storage';
import { generateSchedule } from '@/utils/scheduleEngine';
import { detectConflicts, applyConflictAnalysis } from '@/utils/conflictDetector';

interface AdjustmentSnapshot {
  tasks: PlannedTask[];
}

interface TaskStore {
  tasks: PlannedTask[];
  blocks: ScheduleBlock[];
  conflicts: Conflict[];
  activeTimerTask: PlannedTask | null;
  completedBlockIds: Set<string>;
  lastAdjustmentSnapshot: AdjustmentSnapshot | null;

  loadTasks: () => void;
  addTask: (task: PlannedTask) => void;
  updateTask: (id: string, updates: Partial<PlannedTask>) => void;
  deleteTask: (id: string) => void;
  toggleTaskCompletion: (id: string) => void;
  toggleBlockCompletion: (blockId: string) => void;
  /** 调整某个排程块的时间（对应 iOS updateScheduleBlock） */
  updateScheduleBlock: (blockId: string, start: string, end: string) => void;
  /** 重命名某个排程块（对应 iOS renameFocusBlock） */
  renameFocusBlock: (blockId: string, newTitle: string) => void;
  rebuildSchedule: () => void;
  setActiveTimerTask: (task: PlannedTask | null) => void;
  getTaskById: (id: string) => PlannedTask | undefined;
  /** Apply a conflict suggestion and modify the task */
  applySuggestion: (conflictId: string, suggestion: ConflictSuggestion) => void;
  /** Undo the last applied suggestion */
  undoLastSuggestion: () => void;
  /** Apply LLM conflict analysis to current conflicts */
  applyConflictAnalysis: (output: Parameters<typeof applyConflictAnalysis>[1]) => void;
}

/** Convert LLMBlockPlan to ManualFocusBlock with absolute dates */
function llmBlocksToManualFocus(llmBlocks: LLMBlockPlan[]): ManualFocusBlock[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return llmBlocks
    .filter(b => b.type === 'focus')
    .map((b, idx) => {
      const day = new Date(today);
      day.setDate(today.getDate() + b.dayOffset);
      const start = new Date(day);
      start.setHours(b.startHour, b.startMinute, 0, 0);
      const end = new Date(day);
      end.setHours(b.endHour, b.endMinute, 0, 0);
      return {
        id: `llm-focus-${Date.now()}-${idx}`,
        start: start.toISOString(),
        end: end.toISOString(),
        title: b.title,
        isCompleted: false,
        dependencyBlockIDs: [],
      };
    });
}

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: [],
  blocks: [],
  conflicts: [],
  activeTimerTask: null,
  completedBlockIds: new Set(),
  lastAdjustmentSnapshot: null,

  loadTasks: () => {
    const tasks = storage.loadTasks();
    const completedBlockIds = storage.loadCompletedBlockIDs();
    set({ tasks, completedBlockIds });
    get().rebuildSchedule();
  },

  addTask: (task) => {
    const tasks = [...get().tasks, task];
    storage.saveTasks(tasks);
    set({ tasks });
    get().rebuildSchedule();
  },

  updateTask: (id, updates) => {
    const tasks = get().tasks.map(t =>
      t.id === id ? { ...t, ...updates } : t
    );
    storage.saveTasks(tasks);
    set({ tasks });
    get().rebuildSchedule();
  },

  deleteTask: (id) => {
    const tasks = get().tasks.filter(t => t.id !== id);
    storage.saveTasks(tasks);
    set({ tasks });
    get().rebuildSchedule();
  },

  toggleTaskCompletion: (id) => {
    const tasks = get().tasks.map(t => {
      if (t.id !== id) return t;
      const completed = !t.isCompleted;
      return { ...t, isCompleted: completed };
    });
    storage.saveTasks(tasks);
    set({ tasks });
    get().rebuildSchedule();
  },

  toggleBlockCompletion: (blockId) => {
    const block = get().blocks.find(b => b.id === blockId);
    if (!block) return;

    if (block.taskID) {
      const tasks = get().tasks.map(t => {
        if (t.id !== block.taskID) return t;
        const updatedBlocks = t.manualFocusBlocks.map(b => {
          const bStart = new Date(b.start).getTime();
          const bEnd = new Date(b.end).getTime();
          const blockStart = block.startDate ? new Date(block.startDate).getTime() : 0;
          const blockEnd = block.endDate ? new Date(block.endDate).getTime() : 0;
          if (Math.abs(bStart - blockStart) < 60000 && Math.abs(bEnd - blockEnd) < 60000) {
            return { ...b, isCompleted: !b.isCompleted };
          }
          return b;
        });
        return { ...t, manualFocusBlocks: updatedBlocks };
      });
      storage.saveTasks(tasks);
      set({ tasks });
    }

    const completedBlockIds = new Set(get().completedBlockIds);
    if (completedBlockIds.has(blockId)) {
      completedBlockIds.delete(blockId);
    } else {
      completedBlockIds.add(blockId);
    }
    storage.saveCompletedBlockIDs(completedBlockIds);
    set({ completedBlockIds });

    get().rebuildSchedule();
  },

  updateScheduleBlock: (blockId, start, end) => {
    const block = get().blocks.find((b) => b.id === blockId);
    const task = block?.taskID ? get().tasks.find((t) => t.id === block.taskID) : undefined;
    if (!block || !task) return;

    // 结束时间不能早于开始时间（不足 30 分钟则自动补足）
    const normalizedEnd =
      new Date(end).getTime() > new Date(start).getTime()
        ? end
        : new Date(new Date(start).getTime() + 30 * 60000).toISOString();

    // 固定时间的专注任务：直接改任务时段（对应 iOS）
    if (task.category === 'focus' && task.isFixedTime) {
      get().updateTask(task.id, { fixedStart: start, fixedEnd: normalizedEnd, deadline: normalizedEnd });
      return;
    }

    // 其余：写入 manualFocusBlocks，排程引擎会按手动块渲染（对应 iOS）
    let manualBlocks = task.manualFocusBlocks;
    if (manualBlocks.length === 0) {
      // 初始化：把当前已排出的专注块固化为手动块
      manualBlocks = get().blocks
        .filter((b) => b.taskID === task.id && b.style !== 'fixed' && b.startDate && b.endDate)
        .map((b) => ({
          id: `manual-${Date.now()}-${b.id}`,
          start: b.startDate!,
          end: b.endDate!,
          isCompleted: b.isBlockCompleted,
          dependencyBlockIDs: [],
        }));
    }

    const blockStart = new Date(block.startDate!).getTime();
    const blockEnd = new Date(block.endDate!).getTime();
    const matchIndex = manualBlocks.findIndex(
      (b) =>
        Math.abs(new Date(b.start).getTime() - blockStart) < 60000 &&
        Math.abs(new Date(b.end).getTime() - blockEnd) < 60000
    );

    if (matchIndex >= 0) {
      manualBlocks[matchIndex] = { ...manualBlocks[matchIndex], start, end: normalizedEnd };
    } else {
      manualBlocks.push({
        id: `manual-${Date.now()}`,
        start,
        end: normalizedEnd,
        isCompleted: false,
        dependencyBlockIDs: [],
      });
    }

    manualBlocks.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    get().updateTask(task.id, { manualFocusBlocks: manualBlocks });
  },

  renameFocusBlock: (blockId, newTitle) => {
    const block = get().blocks.find((b) => b.id === blockId);
    const task = block?.taskID ? get().tasks.find((t) => t.id === block.taskID) : undefined;
    if (!block || !task) return;

    // 固定时间的专注任务：直接改任务标题（对应 iOS）
    if (task.category === 'focus' && task.isFixedTime) {
      get().updateTask(task.id, { title: newTitle });
      return;
    }

    const blockStart = new Date(block.startDate!).getTime();
    const blockEnd = new Date(block.endDate!).getTime();
    const manualBlocks = task.manualFocusBlocks.map((b) =>
      Math.abs(new Date(b.start).getTime() - blockStart) < 60000 &&
      Math.abs(new Date(b.end).getTime() - blockEnd) < 60000
        ? { ...b, title: newTitle }
        : b
    );
    get().updateTask(task.id, { manualFocusBlocks: manualBlocks });
  },

  rebuildSchedule: () => {
    const { tasks, completedBlockIds } = get();
    const appMode = storage.loadAppState().appMode;
    const filteredTasks = appMode === 'daily'
      ? tasks
      : tasks.filter(t => appMode === 'examPrep' || appMode === 'emergency'
        ? t.category !== 'entertainment'
        : true
      );
    const { blocks: generatedBlocks, flexibleRisks } = generateSchedule(filteredTasks);
    const blocks = generatedBlocks.map(b => ({
      ...b,
      isBlockCompleted: completedBlockIds.has(b.id),
    }));
    const conflicts = detectConflicts(blocks, tasks, flexibleRisks);
    set({ blocks, conflicts });
  },

  setActiveTimerTask: (task) => set({ activeTimerTask: task }),

  getTaskById: (id) => get().tasks.find(t => t.id === id),

  applySuggestion: (_conflictId, suggestion) => {
    // Save snapshot for undo
    const snapshot: AdjustmentSnapshot = {
      tasks: JSON.parse(JSON.stringify(get().tasks)),
    };
    set({ lastAdjustmentSnapshot: snapshot });

    const { tasks } = get();

    // If LLM blocks are present, write them as manualFocusBlocks
    if (suggestion.llmBlocks && suggestion.llmBlocks.length > 0) {
      const focusBlocks = llmBlocksToManualFocus(suggestion.llmBlocks);
      // Apply focus blocks to the first non-fixed task
      const flexTaskIdx = tasks.findIndex(t => !t.isFixedTime);
      if (flexTaskIdx >= 0) {
        tasks[flexTaskIdx] = {
          ...tasks[flexTaskIdx],
          manualFocusBlocks: focusBlocks,
        };
      }
    } else {
      // Local fallback: adjust first flexible task's dailyPlan
      const flexTaskIdx = tasks.findIndex(t => !t.isFixedTime);
      if (flexTaskIdx >= 0) {
        switch (suggestion.type) {
          case 'move':
            tasks[flexTaskIdx] = {
              ...tasks[flexTaskIdx],
              dailyPlan: 'frontLoad',
            };
            break;
          case 'split':
            tasks[flexTaskIdx] = {
              ...tasks[flexTaskIdx],
              dailyPlan: 'split',
            };
            break;
          case 'keepReminder':
            tasks[flexTaskIdx] = {
              ...tasks[flexTaskIdx],
              conflictReminderEnabled: true,
            };
            break;
        }
      }
    }

    storage.saveTasks(tasks);
    set({ tasks });
    get().rebuildSchedule();
  },

  undoLastSuggestion: () => {
    const snapshot = get().lastAdjustmentSnapshot;
    if (!snapshot) return;

    const tasks = snapshot.tasks;
    storage.saveTasks(tasks);
    set({ tasks, lastAdjustmentSnapshot: null });
    get().rebuildSchedule();
  },

  applyConflictAnalysis: (output) => {
    const { conflicts } = get();
    const updated = applyConflictAnalysis(conflicts, output);
    set({ conflicts: updated });
  },
}));

// App state store
interface AppStateStore {
  appState: AppState;
  setAppState: (updates: Partial<AppState>) => void;
  loadAppState: () => void;
}

export const useAppStateStore = create<AppStateStore>((set, get) => ({
  appState: storage.loadAppState(),

  loadAppState: () => {
    set({ appState: storage.loadAppState() });
  },

  setAppState: (updates) => {
    const newState = { ...get().appState, ...updates };
    storage.saveAppState(newState);
    set({ appState: newState });
  },
}));
