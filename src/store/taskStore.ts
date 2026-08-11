import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { generateSchedule, detectConflicts, type FlexibleRiskInfo } from '@/utils/scheduleEngine';
import type { PlannedTask, ScheduleBlock, ConflictSuggestion, TaskCategory } from '@/types';
import { storage } from '@/lib/storage';
import { llmBlocksToManualFocus } from '@/utils/llmBlocks';
import type { AdjustmentSnapshot } from '@/types';

interface TaskState {
  tasks: PlannedTask[];
  blocks: ScheduleBlock[];
  conflicts: ConflictSuggestion[];
  activeTimerTask: PlannedTask | null;
  lastAdjustmentSnapshot: AdjustmentSnapshot | null;
  completedBlockIds: Set<string>;

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
  applySuggestion: (conflictId: string, suggestion: ConflictSuggestion) => void;
  undoLastAdjustment: () => void;
  /** 标记某个任务的所有排程块为已完成 */
  completeAllBlocksForTask: (taskId: string) => void;
}

export const useTaskStore = create<TaskState>()(
  persist(
    (set, get) => ({
      tasks: [],
      blocks: [],
      conflicts: [],
      activeTimerTask: null,
      lastAdjustmentSnapshot: null,
      completedBlockIds: new Set<string>(),

      addTask: (task) => {
        set({ tasks: [...get().tasks, task] });
        get().rebuildSchedule();
      },

      updateTask: (id, updates) => {
        set({
          tasks: get().tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
        });
        get().rebuildSchedule();
      },

      deleteTask: (id) => {
        set({ tasks: get().tasks.filter((t) => t.id !== id) });
        get().rebuildSchedule();
      },

      toggleTaskCompletion: (id) => {
        set({
          tasks: get().tasks.map((t) =>
            t.id === id ? { ...t, isCompleted: !t.isCompleted } : t
          ),
        });
        get().rebuildSchedule();
      },

      toggleBlockCompletion: (blockId) => {
        const newSet = new Set(get().completedBlockIds);
        if (newSet.has(blockId)) {
          newSet.delete(blockId);
        } else {
          newSet.add(blockId);
        }
        set({ completedBlockIds: newSet });
        // Rebuild to reflect completion state
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

        // 统一走手动块逻辑：固定任务与弹性任务都可以在任意位置修改时间段。
        // 排程引擎对含 manualFocusBlocks 的任务优先按手动块渲染。
        let manualBlocks = task.manualFocusBlocks;
        if (manualBlocks.length === 0) {
          // 初始化：把该任务当前已排出的所有块（含固定块）固化为手动块，
          // 这样只修改目标块，其他重复块保持原时间。
          manualBlocks = get().blocks
            .filter((b) => b.taskID === task.id && b.startDate && b.endDate)
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

      deleteScheduleBlock: (blockId) => {
        const block = get().blocks.find((b) => b.id === blockId);
        const task = block?.taskID ? get().tasks.find((t) => t.id === block.taskID) : undefined;
        if (!block || !task) return;

        // 统一走手动块逻辑：删除单个块，不影响其他重复块
        let manualBlocks = task.manualFocusBlocks;
        if (manualBlocks.length === 0) {
          // 初始化：把该任务当前已排出的所有块（含固定块）固化为手动块
          manualBlocks = get().blocks
            .filter((b) => b.taskID === task.id && b.startDate && b.endDate)
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
          manualBlocks.splice(matchIndex, 1);
        }

        // 如果删除后没有块了，删除整个任务
        if (manualBlocks.length === 0) {
          get().deleteTask(task.id);
          return;
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
        }

        set({ tasks: [...tasks] });
        get().rebuildSchedule();
      },

      undoLastAdjustment: () => {
        const snapshot = get().lastAdjustmentSnapshot;
        if (!snapshot) return;
        set({
          tasks: snapshot.tasks,
          lastAdjustmentSnapshot: null,
        });
        get().rebuildSchedule();
      },

      completeAllBlocksForTask: (taskId) => {
        const taskBlocks = get().blocks.filter(b => b.taskID === taskId);
        const newSet = new Set(get().completedBlockIds);
        taskBlocks.forEach(b => newSet.add(b.id));
        set({ completedBlockIds: newSet });
        get().rebuildSchedule();
      },
    }),
    {
      name: 'daoshi-tasks',
      storage: createJSONStorage(() => ({
        getItem: (name: string) => {
          const raw = localStorage.getItem(name);
          if (!raw) return null;
          try {
            const parsed = JSON.parse(raw);
            // Revive completedBlockIds Set
            if (parsed?.state?.completedBlockIds && Array.isArray(parsed.state.completedBlockIds)) {
              parsed.state.completedBlockIds = new Set(parsed.state.completedBlockIds);
            }
            return JSON.stringify(parsed);
          } catch {
            return raw;
          }
        },
        setItem: (name: string, value: string) => {
          try {
            const parsed = JSON.parse(value);
            // Serialize completedBlockIds Set to array
            if (parsed?.state?.completedBlockIds instanceof Set) {
              parsed.state.completedBlockIds = Array.from(parsed.state.completedBlockIds);
            }
            localStorage.setItem(name, JSON.stringify(parsed));
          } catch {
            localStorage.setItem(name, value);
          }
        },
        removeItem: (name: string) => localStorage.removeItem(name),
      })),
      partialize: (state) => ({
        tasks: state.tasks,
        completedBlockIds: Array.from(state.completedBlockIds),
      }),
    }
  )
);
