export type TaskCategory = 'study' | 'entertainment' | 'exam' | 'focus' | 'life';

export type DailyPlanPreset = 'steady' | 'split' | 'frontLoad';

export type ScheduleBlockStyle = 'fixed' | 'flexible' | 'focus';

export type AppMode = 'daily' | 'examPrep' | 'emergency';

export type AppAppearance = 'system' | 'light' | 'dark';

export type RiskLevel = 'high' | 'medium' | 'low';

/** 重复规则：单次 / 每天 / 每周（自定义星期）/ 法定工作日 / 法定节假日 */
export type RepeatMode = 'once' | 'daily' | 'weekly' | 'workdays' | 'holidays';

export const REPEAT_MODE_LABELS: Record<RepeatMode, string> = {
  once: '单次',
  daily: '每天',
  weekly: '每周（自定义）',
  workdays: '法定工作日',
  holidays: '法定节假日',
};

/** 星期几：0 = 周日 … 6 = 周六 */
export const WEEKDAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

export interface ManualFocusBlock {
  id: string;
  start: string; // ISO 8601
  end: string;   // ISO 8601
  title?: string;
  isCompleted: boolean;
  dependencyBlockIDs: string[];
}

export interface PlannedTask {
  id: string;
  title: string;
  category: TaskCategory;
  deadline: string; // ISO 8601
  estimatedHours: number;
  dailyPlan: DailyPlanPreset;
  isFixedTime: boolean;
  fixedStart?: string; // ISO 8601
  fixedEnd?: string;   // ISO 8601
  repeatsWeekly: boolean;
  /** 重复规则（除「学习/作业」外的任务），缺省为单次 */
  repeatMode?: RepeatMode;
  /** 每周（自定义）时选中的星期，0=周日 … 6=周六 */
  weeklyDays?: number[];
  conflictReminderEnabled: boolean;
  manualFocusBlocks: ManualFocusBlock[];
  locationText?: string;
  isCompleted: boolean;
}

export interface ScheduleBlock {
  id: string;
  taskID?: string;
  taskCategory: TaskCategory;
  dayLabel: string;
  timeRange: string;
  title: string;
  detail: string;
  style: ScheduleBlockStyle;
  hasConflict: boolean;
  startDate?: string; // ISO 8601
  endDate?: string;   // ISO 8601
  isBlockCompleted: boolean;
  isBlockDependent: boolean;
}

export interface Conflict {
  id: string;
  riskLevel: RiskLevel;
  description: string;
  involvedBlocks: {
    blockID: string;
    title: string;
    timeRange: string;
  }[];
  suggestions: ConflictSuggestion[];
  // LLM-populated fields
  riskLevelText?: string;
  latestStartText?: string;
  remainingEffortText?: string;
  conflictSourceText?: string;
}

export interface ConflictSuggestion {
  type: 'move' | 'split' | 'keepReminder';
  label: string;
  description: string;
  impact?: string;
  recommended?: boolean;
  recommendationReason?: string;
  // LLM-generated schedule blocks for this suggestion
  llmBlocks?: LLMBlockPlan[];
}

/** A single time block planned by LLM for conflict resolution */
export interface LLMBlockPlan {
  taskID?: string;
  title: string;
  dayOffset: number;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  type: 'focus' | 'meal_breakfast' | 'meal_lunch' | 'meal_dinner' | 'rest';
}

/** LLM conflict analysis output */
export interface ConflictAnalysisOutput {
  summary: string;
  riskLevelText: string;
  latestStartText: string;
  remainingEffortText: string;
  conflictSourceText: string;
  suggestions: {
    title: string;
    description: string;
    impact: string;
    recommended: boolean;
    recommendationReason: string;
    scheduleBlocks?: LLMBlockPlan[];
  }[];
}

export interface LlmConfig {
  enabled: boolean;
  provider: 'DeepSeek' | 'Qwen' | 'GPT' | '自定义';
  model: string;
  baseURL: string;
  apiKey: string;
}

export interface AppState {
  appMode: AppMode;
  appearance: AppAppearance;
  completionSound: 'bell' | 'chime' | 'electronic' | 'alert';
  notificationsEnabled: boolean;
  llm: LlmConfig;
}

export const DEFAULT_LLM_CONFIG: LlmConfig = {
  enabled: false,
  provider: 'DeepSeek',
  model: '',
  baseURL: '',
  apiKey: '',
};

export const CATEGORY_CONFIG: Record<TaskCategory, {
  label: string;
  color: string;
  lightBg: string;
  icon: string;
}> = {
  study:     { label: '学习/作业', color: '#3B82F6', lightBg: '#DBEAFE', icon: 'BookOpen' },
  entertainment: { label: '娱乐', color: '#8B5CF6', lightBg: '#EDE9FE', icon: 'Music' },
  exam:      { label: '上课/考试', color: '#EF4444', lightBg: '#FEE2E2', icon: 'Pencil' },
  focus:     { label: '专注', color: '#F59E0B', lightBg: '#FEF3C7', icon: 'Timer' },
  life:      { label: '生活', color: '#22C55E', lightBg: '#DCFCE7', icon: 'Leaf' },
};

export const DAILY_PLAN_LABELS: Record<DailyPlanPreset, string> = {
  steady: '稳步推进',
  split: '拆成多段',
  frontLoad: '提前前移',
};

export const APP_MODE_LABELS: Record<AppMode, string> = {
  daily: '日常生活',
  examPrep: '复习考试周',
  emergency: '紧急异常',
};
