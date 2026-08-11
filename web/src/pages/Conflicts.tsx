import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Clock,
  Hourglass,
  CalendarCheck,
  Star,
  Wand,
  CheckCheck,
  CheckCircle2,
  MessageSquareText,
  Loader2,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTaskStore, useAppStateStore } from '@/store/taskStore';
import { sendChatMessage } from '@/utils/llmService';
import { makeConflictPrompt } from '@/utils/conflictDetector';
import type { ConflictSuggestion } from '@/types';

const riskLevelConfig: Record<string, { label: string; color: string; bg: string; border: string }> = {
  high: { label: '高风险', color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-950/40', border: 'border-red-300 dark:border-red-700' },
  medium: { label: '中风险', color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-950/40', border: 'border-orange-300 dark:border-orange-700' },
  low: { label: '低风险', color: 'text-yellow-600', bg: 'bg-yellow-50 dark:bg-yellow-950/40', border: 'border-yellow-300 dark:border-yellow-700' },
};

const styleConfig: Record<string, { icon: React.ElementType; color: string }> = {
  recommended: { icon: Star, color: 'text-orange-500' },
  smart: { icon: Wand, color: 'text-blue-500' },
  applied: { icon: CheckCheck, color: 'text-green-500' },
};

export default function Conflicts() {
  const navigate = useNavigate();
  const {
    conflicts,
    tasks,
    blocks,
    applySuggestion,
    undoLastSuggestion,
    lastAdjustmentSnapshot,
    applyConflictAnalysis,
  } = useTaskStore();
  const appState = useAppStateStore((s) => s.appState);
  const [appliedConflictIds, setAppliedConflictIds] = useState<Set<string>>(new Set());
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmError, setLlmError] = useState('');
  const [feedback, setFeedback] = useState('');

  // Auto-trigger LLM analysis on page load if conflicts exist and LLM is configured
  useEffect(() => {
    if (conflicts.length > 0 && appState.llm.enabled && appState.llm.apiKey) {
      handleLlmSuggest();
    }
  }, []); // Run once on mount

  const handleSuggestionClick = (conflictId: string, suggestion: ConflictSuggestion) => {
    const key = `${conflictId}-${suggestion.label}`;
    setAppliedConflictIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
        // Actually apply the suggestion to modify tasks
        applySuggestion(conflictId, suggestion);
        setFeedback('已为你调整方案');
        setTimeout(() => setFeedback(''), 2000);
      }
      return next;
    });
  };

  const handleUndo = () => {
    if (!lastAdjustmentSnapshot) return;
    undoLastSuggestion();
    setAppliedConflictIds(new Set());
    setFeedback('已撤销上次调整');
    setTimeout(() => setFeedback(''), 2000);
  };

  const handleLlmSuggest = useCallback(async () => {
    const { llm } = appState;
    if (!llm.enabled || !llm.apiKey) {
      return; // Silently skip if not configured
    }

    if (conflicts.length === 0) return;

    setLlmLoading(true);
    setLlmError('');

    const prompt = makeConflictPrompt(conflicts, tasks, blocks);

    const result = await sendChatMessage(
      [{ role: 'user', text: prompt }],
      llm,
      tasks
    );

    if (result.success) {
      try {
        const jsonMatch = result.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.suggestions && Array.isArray(parsed.suggestions)) {
            applyConflictAnalysis(parsed);
            return;
          }
        }
      } catch (err) {
        console.warn('LLM conflict parse failed:', err);
      }
    }

    setLlmError(result.success ? '未能解析 LLM 返回的建议' : 'LLM 请求失败，请检查配置');
    setLlmLoading(false);
  }, [appState, conflicts, tasks, blocks, applyConflictAnalysis]);

  if (conflicts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-6">
        <div className="w-16 h-16 rounded-full bg-green-50 dark:bg-green-950/40 flex items-center justify-center mb-4">
          <CheckCircle2 className="w-10 h-10 text-green-500" />
        </div>
        <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
          当前没有冲突
        </h2>
        <p className="text-sm text-gray-400 dark:text-gray-500 mb-6 max-w-xs">
          你的日程安排非常合理
        </p>
        <button
          onClick={() => navigate('/tasks')}
          className="px-6 py-2.5 rounded-xl text-white font-medium text-sm shadow-lg"
          style={{ backgroundColor: 'var(--brand)' }}
        >
          返回列表视图
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-[920px] mx-auto px-6">
      {/* Feedback Toast */}
      {feedback && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium shadow-lg animate-fade-in">
          <CheckCircle2 className="w-4 h-4 inline-block mr-1.5 -mt-0.5" />
          {feedback}
        </div>
      )}

      {conflicts.map((conflict) => {
        const risk = riskLevelConfig[conflict.riskLevel];

        return (
          <div
            key={conflict.id}
            className="bg-[var(--surface)] rounded-3xl shadow-lg p-6 mb-6"
          >
            {/* Title Row */}
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  冲突警告详情页
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {conflict.description}
                </p>
              </div>
              <span
                className={cn(
                  'inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border',
                  risk.bg,
                  risk.color,
                  risk.border
                )}
              >
                <span className={cn('w-1.5 h-1.5 rounded-full', risk.color.replace('text', 'bg'))} />
                {conflict.riskLevelText || risk.label}
              </span>
            </div>

            {/* Risk Information Cards */}
            <div className="space-y-3 mb-6">
              <div className="bg-[var(--card)] rounded-2xl p-4 flex items-center gap-3">
                <Clock className="w-5 h-5 text-red-500 flex-shrink-0" />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {conflict.latestStartText || `最晚开始时间: ${conflict.involvedBlocks[0]?.timeRange?.split('-')[0] || '--'}`}
                </span>
              </div>

              <div className="bg-[var(--card)] rounded-2xl p-4 flex items-center gap-3">
                <Hourglass className="w-5 h-5 text-orange-500 flex-shrink-0" />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {conflict.remainingEffortText || `剩余待投入: ${conflict.involvedBlocks.length} 个时段`}
                </span>
              </div>

              <div className="bg-[var(--card)] rounded-2xl p-4 flex items-center gap-3">
                <CalendarCheck className="w-5 h-5 text-blue-500 flex-shrink-0" />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {conflict.conflictSourceText || `冲突来源: ${conflict.involvedBlocks.map((b) => b.title).join('、')}`}
                </span>
              </div>
            </div>

            {/* Recommended Adjustments */}
            <div className="mb-6">
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">
                推荐调整方案
              </h3>
              <div className="space-y-3">
                {conflict.suggestions.map((suggestion, idx) => {
                  const key = `${conflict.id}-${suggestion.label}`;
                  const isApplied = appliedConflictIds.has(key);
                  const isLlm = suggestion.llmBlocks !== undefined;
                  const styleKey = isApplied ? 'applied' : suggestion.recommended ? 'recommended' : 'smart';
                  const style = styleConfig[styleKey];
                  const IconComponent = style.icon;

                  return (
                    <button
                      key={idx}
                      onClick={() => handleSuggestionClick(conflict.id, suggestion)}
                      className={cn(
                        'w-full text-left bg-[var(--card)] rounded-2xl p-4 transition-all hover:shadow-md',
                        suggestion.recommended && !isApplied && 'border-2 border-orange-400'
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className={cn('flex-shrink-0 mt-0.5', style.color)}>
                          <IconComponent className="w-5 h-5" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                              {suggestion.label}
                            </span>
                            {suggestion.impact && (
                              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                                {suggestion.impact}
                              </span>
                            )}
                            {isLlm && (
                              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400">
                                AI 生成
                              </span>
                            )}
                            {isApplied && (
                              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                                已应用
                              </span>
                            )}
                            {suggestion.recommended && !isApplied && !isLlm && (
                              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400">
                                推荐方案
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {suggestion.description}
                          </p>
                          {suggestion.recommendationReason && (
                            <p className="text-[10px] text-orange-500 dark:text-orange-400 mt-1">
                              推荐理由：{suggestion.recommendationReason}
                            </p>
                          )}

                          {/* LLM scheduleBlocks preview */}
                          {suggestion.llmBlocks && suggestion.llmBlocks.length > 0 && (
                            <div className="mt-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700">
                              <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500 mb-1.5">日程预览</p>
                              <div className="space-y-0.5">
                                {suggestion.llmBlocks.map((b, bi) => (
                                  <div key={bi} className="flex items-center gap-2 text-[10px]">
                                    <span className={cn(
                                      'w-1.5 h-1.5 rounded-full flex-shrink-0',
                                      b.type.startsWith('meal') ? 'bg-orange-400' :
                                      b.type === 'rest' ? 'bg-gray-300' : 'bg-blue-500'
                                    )} />
                                    <span className="text-gray-500 dark:text-gray-400 w-[72px] flex-shrink-0">
                                      {String(b.startHour).padStart(2, '0')}:{String(b.startMinute).padStart(2, '0')}
                                      -{String(b.endHour).padStart(2, '0')}:{String(b.endMinute).padStart(2, '0')}
                                    </span>
                                    <span className="text-gray-700 dark:text-gray-300 truncate">{b.title}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bottom Buttons */}
            <div className="flex items-center gap-3 mb-6">
              <button
                onClick={handleUndo}
                disabled={!lastAdjustmentSnapshot}
                className="px-4 py-2 text-xs font-medium rounded-xl border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                撤销上次调整
              </button>
              <button
                onClick={handleLlmSuggest}
                disabled={llmLoading}
                className="px-4 py-2 text-xs font-medium rounded-xl border border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                {llmLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    AI 思考中...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    AI 生成智能建议
                  </>
                )}
              </button>
            </div>

            {llmError && (
              <p className="text-xs text-red-500 mb-4">{llmError}</p>
            )}

            {/* Insight Pills */}
            <div className="flex items-center gap-2 mb-6 flex-wrap">
              <span className="rounded-full px-3 py-1 text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                提醒是否明显
              </span>
              <span className="rounded-full px-3 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                预估耗时是否易懂
              </span>
              <span className="rounded-full px-3 py-1 text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400">
                当前已应用 {appliedConflictIds.size} 项
              </span>
            </div>
          </div>
        );
      })}

      {/* Bottom Navigation */}
      <div className="flex items-center justify-between pb-8">
        <button
          onClick={() => navigate('/chat')}
          className="flex items-center gap-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
        >
          <MessageSquareText className="w-4 h-4" />
          跳转人机对话模式
        </button>
        <button
          onClick={() => navigate('/tasks')}
          className="px-6 py-2.5 rounded-xl text-white font-medium text-sm shadow-lg"
          style={{ backgroundColor: 'var(--brand)' }}
        >
          返回列表视图
        </button>
      </div>
    </div>
  );
}
