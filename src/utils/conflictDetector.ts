import type { ScheduleBlock, Conflict, ConflictSuggestion, RiskLevel, PlannedTask } from '@/types';
import { format } from 'date-fns';
import type { FlexibleRiskInfo } from './scheduleEngine';

/**
 * Detect time overlaps between any two schedule blocks on the same day,
 * plus flexible-task shortages (can't finish before deadline, mirroring iOS).
 * Also marks hasConflict on individual blocks.
 */
export function detectConflicts(
  blocks: ScheduleBlock[],
  tasks: PlannedTask[],
  flexibleRisks: FlexibleRiskInfo[] = []
): Conflict[] {
  const conflicts: Conflict[] = [];
  const blocksWithTime = blocks.filter(b => b.startDate && b.endDate);

  // Group blocks by day
  const byDay = new Map<string, ScheduleBlock[]>();
  for (const block of blocksWithTime) {
    const day = new Date(block.startDate!).toDateString();
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(block);
  }

  // Set of block IDs involved in conflicts
  const conflictedBlockIds = new Set<string>();

  // Check overlaps within each day
  for (const [, dayBlocks] of byDay) {
    for (let i = 0; i < dayBlocks.length; i++) {
      for (let j = i + 1; j < dayBlocks.length; j++) {
        const a = dayBlocks[i];
        const b = dayBlocks[j];

        const aStart = new Date(a.startDate!).getTime();
        const aEnd = new Date(a.endDate!).getTime();
        const bStart = new Date(b.startDate!).getTime();
        const bEnd = new Date(b.endDate!).getTime();

        if (aStart < bEnd && bStart < aEnd) {
          const overlapStart = new Date(Math.max(aStart, bStart));
          const overlapEnd = new Date(Math.min(aEnd, bEnd));
          const overlapMinutes = Math.round((overlapEnd.getTime() - overlapStart.getTime()) / 60000);

          if (overlapMinutes <= 0) continue;

          conflictedBlockIds.add(a.id);
          conflictedBlockIds.add(b.id);

          const riskLevel: RiskLevel =
            overlapMinutes >= 60 ? 'high'
            : overlapMinutes >= 30 ? 'medium'
            : 'low';

          const alreadyExists = conflicts.some(c => {
            const ids = c.involvedBlocks.map(b => b.blockID);
            return ids.includes(a.id) && ids.includes(b.id);
          });
          if (alreadyExists) continue;

          const riskLabel = riskLevel === 'high' ? '高风险' : riskLevel === 'medium' ? '中风险' : '低风险';

          conflicts.push({
            id: `conflict-${a.id}-${b.id}`,
            riskLevel,
            description: `「${a.title}」与「${b.title}」时间重叠 ${overlapMinutes} 分钟`,
            riskLevelText: riskLabel,
            latestStartText: `最晚开始时间: ${a.timeRange.split('-')[0]}`,
            remainingEffortText: `剩余待投入: ${conflicts.length + 1} 个时段`,
            conflictSourceText: `冲突来源: ${a.title}、${b.title}`,
            involvedBlocks: [
              { blockID: a.id, title: a.title, timeRange: a.timeRange },
              { blockID: b.id, title: b.title, timeRange: b.timeRange },
            ],
            suggestions: generateSuggestions(a, b, overlapMinutes),
          });
        }
      }
    }
  }

  // 弹性任务缺口冲突（对应 iOS「固定事件与截止时间之间的冲突」）
  for (const risk of flexibleRisks) {
    if (risk.remainingHours <= 0.01) continue;
    if (conflicts.some((c) => c.id === `conflict-shortage-${risk.taskID}`)) continue;

    const task = tasks.find((t) => t.id === risk.taskID);
    const estHours = task?.estimatedHours ?? risk.remainingHours + (risk.latestBlockEnd && risk.latestStart
      ? (risk.latestBlockEnd.getTime() - risk.latestStart.getTime()) / 3600000
      : 0);

    conflicts.push({
      id: `conflict-shortage-${risk.taskID}`,
      riskLevel: 'high',
      description: `「${risk.title}」预估 ${hoursText(estHours)}，截止时间前空闲时段不足，仍缺少 ${hoursText(risk.remainingHours)}`,
      riskLevelText: '高风险',
      latestStartText: risk.latestStart
        ? `最晚开始时间: ${format(risk.latestStart, 'HH:mm')}`
        : `最晚开始时间: ${format(risk.deadline, 'HH:mm')}（当前已无可用时段）`,
      remainingEffortText: `剩余待投入: ${hoursText(risk.remainingHours)}`,
      conflictSourceText: `冲突来源: 截止时间前空闲时段不足（${risk.title}）`,
      involvedBlocks:
        risk.blocks.length > 0
          ? risk.blocks
          : [{ blockID: `shortage-${risk.taskID}`, title: risk.title, timeRange: '暂无可用时段' }],
      suggestions: generateShortageSuggestions(risk),
    });

    if (risk.lastBlockID) {
      conflictedBlockIds.add(risk.lastBlockID);
    }
  }

  // Mark hasConflict on individual blocks
  for (const block of blocks) {
    block.hasConflict = conflictedBlockIds.has(block.id);
  }

  return conflicts;
}

function generateSuggestions(
  a: ScheduleBlock,
  b: ScheduleBlock,
  overlapMinutes: number
): ConflictSuggestion[] {
  const suggestions: ConflictSuggestion[] = [];

  const aStart = a.startDate ? new Date(a.startDate) : null;
  const bStart = b.startDate ? new Date(b.startDate) : null;
  const aEnd = a.endDate ? new Date(a.endDate) : null;
  const bEnd = b.endDate ? new Date(b.endDate) : null;

  // Determine which is flexible and which is fixed
  const isAFlexible = a.style === 'flexible' || a.style === 'focus';
  const isBFlexible = b.style === 'flexible' || b.style === 'focus';

  // Suggestion 1: Move shorter task after longer one
  const aDuration = aStart && aEnd ? aEnd.getTime() - aStart.getTime() : 0;
  const bDuration = bStart && bEnd ? bEnd.getTime() - bStart.getTime() : 0;

  if (bEnd && aDuration <= bDuration) {
    const newStart = new Date(bEnd.getTime() + 5 * 60000);
    const startStr = `${String(newStart.getHours()).padStart(2, '0')}:${String(newStart.getMinutes()).padStart(2, '0')}`;
    suggestions.push({
      type: 'move',
      label: `将「${a.title}」推迟`,
      description: `延后到 ${startStr} 开始，避开「${b.title}」的时间段`,
      impact: '最直接',
      recommended: isAFlexible,
      recommendationReason: isAFlexible ? '优先调整弹性任务，对固定任务无影响' : undefined,
    });
  }
  if (aEnd && bDuration < aDuration) {
    const newStart = new Date(aEnd.getTime() + 5 * 60000);
    const startStr = `${String(newStart.getHours()).padStart(2, '0')}:${String(newStart.getMinutes()).padStart(2, '0')}`;
    suggestions.push({
      type: 'move',
      label: `将「${b.title}」推迟`,
      description: `延后到 ${startStr} 开始，避开「${a.title}」的时间段`,
      impact: '直接有效',
      recommended: isBFlexible && !isAFlexible,
    });
  }

  // Suggestion 2: Split flexible task
  if (isAFlexible) {
    suggestions.push({
      type: 'split',
      label: `拆分「${a.title}」`,
      description: `将「${a.title}」拆分成多段专注块，避开冲突区间，利用三餐间隙完成`,
      impact: '更稳妥',
    });
  }
  if (isBFlexible && !isAFlexible) {
    suggestions.push({
      type: 'split',
      label: `拆分「${b.title}」`,
      description: `将「${b.title}」拆分成多段专注块，避开冲突区间`,
      impact: '更稳妥',
    });
  }

  // Suggestion 3: Move to weekend morning
  suggestions.push({
    type: 'move',
    label: '移出到周末上午优先完成',
    description: '周末上午 8:00-12:00 通常是最连续的空闲窗口，适合处理需要长专注的任务',
    impact: '较可行',
  });

  // Suggestion 4: Use meal gap slots
  suggestions.push({
    type: 'split',
    label: '利用三餐后的间隙分批完成',
    description: '把剩余任务碎片化，分散到每天早餐后、午餐后、晚餐后的短时段里完成',
    impact: '灵活方案',
  });

  // Suggestion 5: Keep as-is with reminder
  suggestions.push({
    type: 'keepReminder',
    label: '保留原计划，提升提醒频率',
    description: `保持现有安排，但在重叠时段（${overlapMinutes} 分钟）前多次提醒，避免遗漏`,
    impact: '保守方案',
  });

  return suggestions;
}

/** 格式化小时文本，如 1 → "1 小时"，1.5 → "1.5 小时" */
function hoursText(hours: number): string {
  const rounded = Math.round(hours * 10) / 10;
  return `${rounded} 小时`;
}

function generateShortageSuggestions(risk: FlexibleRiskInfo): ConflictSuggestion[] {
  const title = risk.title;
  return [
    {
      type: 'move',
      label: `把「${title}」前移到更早的空闲时段`,
      description: '优先占用固定任务之前更早的空闲窗口，锁定截止前进度',
      impact: '最直接',
      recommended: true,
      recommendationReason: '优先完成截止最近的任务，风险最小',
    },
    {
      type: 'split',
      label: `拆分「${title}」为多个短专注块`,
      description: '拆到多个空闲时段，利用三餐间隙完成，避开固定事件占用',
      impact: '更稳妥',
    },
    {
      type: 'move',
      label: '移出到周末上午优先完成',
      description: '周末上午 8:00-12:00 是最连续的空闲窗口，适合需要长专注的任务',
      impact: '较可行',
    },
    {
      type: 'keepReminder',
      label: '保留原计划，提升提醒频率',
      description: '保持现有安排，在截止前多次提醒，避免遗漏',
      impact: '保守方案',
    },
  ];
}

/**
 * Build conflict analysis prompt for LLM (mirrors iOS SmartTaskAssistantService).
 */
export function makeConflictPrompt(
  conflicts: Conflict[],
  tasks: PlannedTask[],
  blocks: ScheduleBlock[]
): string {
  const now = new Date();
  const timeOnly: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hour12: false };
  const fmt = (d: Date) => d.toLocaleTimeString('zh-CN', timeOnly);

  const taskLines = tasks.map(t => {
    const parts = [
      `UUID：${t.id}`,
      `标题：${t.title}`,
      `类型：${t.category}`,
      `截止：${new Date(t.deadline).toLocaleString('zh-CN')}`,
      `预估时长：${t.estimatedHours}h`,
      `固定任务：${t.isFixedTime ? '是' : '否'}`,
    ];
    if (t.isFixedTime && t.fixedStart && t.fixedEnd) {
      parts.push(`固定时段：${new Date(t.fixedStart).toLocaleString('zh-CN', timeOnly)}-${fmt(new Date(t.fixedEnd))}`);
    }
    return parts.join('，');
  }).join('\n');

  const blockLines = blocks
    .filter(b => b.startDate && b.endDate)
    .map(b => `${b.timeRange}｜${b.title}｜${b.style}`)
    .join('\n');

  const conflictDesc = conflicts.map(c => c.description).join('；');

  return [
    `请根据以下排程信息生成冲突说明与 3~5 条推荐调整方案，每套方案必须包含完整的每日时间块安排（scheduleBlocks），只返回 JSON。`,
    `要求：在方案中选择一条作为 recommended=true，并填写 recommendationReason 说明推荐理由。`,
    ``,
    `## 当前概况`,
    `摘要：${conflicts.length} 个冲突 — ${conflictDesc}`,
    `风险：${conflicts.length >= 2 ? '高风险' : '中风险'}`,
    `最晚开始：${conflicts[0]?.involvedBlocks[0]?.timeRange || '--'}`,
    `剩余待投入：${blocks.length} 个时段`,
    `冲突来源：${conflicts.map(c => c.involvedBlocks.map(b => b.title).join('、')).join('；')}`,
    ``,
    `## 日常生活约束`,
    `- 早餐：7:00-8:00`,
    `- 午餐：12:00-13:00`,
    `- 晚餐：18:00-19:00`,
    `- 睡眠：23:00-次日7:00（不可占用）`,
    `- 连续专注建议不超过 90 分钟，之后安排短休息`,
    ``,
    `## 任务列表（含 UUID）`,
    taskLines,
    ``,
    `## 当前时间块`,
    blockLines,
    ``,
    `## 输出格式`,
    `{`,
    `  "summary":"冲突分析总结",`,
    `  "riskLevelText":"高风险|中风险|低风险",`,
    `  "latestStartText":"最晚开始时间描述",`,
    `  "remainingEffortText":"剩余待投入描述",`,
    `  "conflictSourceText":"冲突来源描述",`,
    `  "suggestions":[{`,
    `    "title":"方案标题",`,
    `    "description":"方案详细描述",`,
    `    "impact":"影响标签（最直接/更稳妥/保守方案/较可行/灵活方案）",`,
    `    "recommended":true,`,
    `    "recommendationReason":"推荐理由",`,
    `    "scheduleBlocks":[{`,
    `      "taskID":"任务UUID（餐食用空字符串）",`,
    `      "title":"专注XXX"|"早餐"|"午餐"|"晚餐",`,
    `      "dayOffset":0,`,
    `      "startHour":8,`,
    `      "startMinute":0,`,
    `      "endHour":9,`,
    `      "endMinute":30,`,
    `      "type":"focus"|"meal_breakfast"|"meal_lunch"|"meal_dinner"|"rest"`,
    `    }]`,
    `  }]`,
    `}`,
  ].join('\n');
}

/**
 * Convert LLM conflict analysis output into ConflictSuggestion list,
 * plus populate the LLM fields on each conflict.
 */
export function applyConflictAnalysis(
  conflicts: Conflict[],
  output: { summary: string; riskLevelText: string; latestStartText: string; remainingEffortText: string; conflictSourceText: string; suggestions: { title: string; description: string; impact: string; recommended: boolean; recommendationReason: string; scheduleBlocks?: { taskID?: string; title: string; dayOffset: number; startHour: number; startMinute: number; endHour: number; endMinute: number; type: string }[] }[] }
): Conflict[] {
  return conflicts.map((c, idx) => {
    // Spread LLM meta across all conflicts (LLM generates one analysis for all)
    const updated: Conflict = {
      ...c,
      riskLevelText: output.riskLevelText || c.riskLevelText,
      latestStartText: output.latestStartText || c.latestStartText,
      remainingEffortText: output.remainingEffortText || c.remainingEffortText,
      conflictSourceText: output.conflictSourceText || c.conflictSourceText,
    };

    // Replace suggestions with LLM ones for first conflict, distribute others
    if (idx === 0 && output.suggestions?.length > 0) {
      updated.suggestions = output.suggestions.map(s => ({
        type: 'move' as const,
        label: s.title,
        description: s.description,
        impact: s.impact,
        recommended: s.recommended,
        recommendationReason: s.recommendationReason,
        llmBlocks: s.scheduleBlocks?.map(b => ({
          taskID: b.taskID || '',
          title: b.title,
          dayOffset: b.dayOffset || 0,
          startHour: b.startHour || 0,
          startMinute: b.startMinute || 0,
          endHour: b.endHour || 0,
          endMinute: b.endMinute || 0,
          type: (b.type as 'focus' | 'meal_breakfast' | 'meal_lunch' | 'meal_dinner' | 'rest') || 'focus',
        })),
      }));
    }
    return updated;
  });
}
