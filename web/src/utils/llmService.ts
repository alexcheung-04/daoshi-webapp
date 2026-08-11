import type { LlmConfig, PlannedTask } from '@/types';

interface ChatMessagePart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string };
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | ChatMessagePart[];
}

/**
 * Build the system prompt with current task list context.
 * Instructs the LLM to output structured task operations in a parseable format.
 */
function buildSystemPrompt(tasks: PlannedTask[]): string {
  const now = new Date();
  // Get local time components
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const currentDateTime = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
  
  // Get timezone offset
  const timezoneOffset = -now.getTimezoneOffset() / 60;
  const timezoneStr = timezoneOffset >= 0 ? `UTC+${timezoneOffset}` : `UTC${timezoneOffset}`;

  const taskList = tasks.length === 0
    ? '（当前没有任何任务）'
    : tasks.map(t => {
        const parts = [
          `ID: ${t.id}`,
          `标题: ${t.title}`,
          `分类: ${t.category}`,
          `截止: ${t.deadline}`,
          `预估: ${t.estimatedHours}h`,
          `固定时间: ${t.isFixedTime ? '是' : '否'}`,
        ];
        if (t.isFixedTime && t.fixedStart) parts.push(`开始: ${t.fixedStart}`);
        if (t.isFixedTime && t.fixedEnd) parts.push(`结束: ${t.fixedEnd}`);
        if (t.locationText) parts.push(`地点: ${t.locationText}`);
        parts.push(`已完成: ${t.isCompleted ? '是' : '否'}`);
        return `- [${parts.join(', ')}]`;
      }).join('\n');

  return `你是「倒时·日程」的智能日程管理助手。

## 当前时间
**${currentDateTime}**（${timezoneStr}，本地时间）

**重要**：用户所在时区为 ${timezoneStr}。所有日期时间操作必须使用本地时间，不要使用 UTC 时间。当用户说"明天"、"后天"等相对时间时，请基于当前本地时间推算。

你可以帮助用户：
1. 添加新任务
2. 删除已有任务
3. 修改任务信息（标题、截止时间、时长、分类等）
4. 分析日程冲突
5. 生成专注时段
6. 回答日程相关问题

## 当前任务列表
${taskList}

## 任务操作指令

当用户要求执行具体的任务操作时（如添加、删除、修改任务），请在回复的**末尾**附加一个 JSON 操作块，格式如下：

\`\`\`daoshi_ops
[{"op":"add","task":{"title":"...","category":"study|entertainment|exam|focus|life","deadline":"ISO 8601","estimatedHours":2,"dailyPlan":"steady","isFixedTime":false}},{"op":"delete","taskId":"任务ID"},{"op":"update","taskId":"任务ID","updates":{"title":"新标题","deadline":"新截止时间"}}]
\`\`\`

### 操作类型说明：
- **add**: 添加新任务。task 对象需包含 title、category、deadline(ISO 8601)、estimatedHours。可选：dailyPlan(steady/split/frontLoad)、isFixedTime、fixedStart、fixedEnd、locationText
- **delete**: 删除任务。需提供 taskId（从当前任务列表中获取）
- **update**: 修改任务。需提供 taskId 和要修改的字段

### 重要规则：
1. 每次操作前，先用自然语言向用户说明你要做什么
2. 操作块必须放在回复的最后，用 \`\`\`daoshi_ops 代码块包裹
3. 如果用户只是询问建议而不要求执行，则不需要输出操作块
4. 分类(category) 必须是以下之一：study(学习/作业)、entertainment(娱乐)、exam(上课/考试)、focus(专注)、life(生活)
5. 日期时间使用 ISO 8601 格式的本地时间，如 "2025-01-20T09:00:00"。**不要使用 UTC 时间或带时区偏移的时间**，直接使用用户所在时区的本地时间
6. 如果用户说"明天"、"后天"等，请根据当前本地时间推算具体日期
7. 添加任务时，如果用户没有指定分类，根据任务内容智能判断

请用中文回复，保持简洁、实用。`;
}

function resolveEndpoint(config: LlmConfig): string {
  switch (config.provider) {
    case 'DeepSeek':
      return 'https://api.deepseek.com/v1/chat/completions';
    case 'Qwen':
      return 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
    case 'GPT':
      return 'https://api.openai.com/v1/chat/completions';
    case '自定义':
      return config.baseURL || '';
    default:
      return '';
  }
}

function resolveModel(config: LlmConfig): string {
  switch (config.provider) {
    case 'DeepSeek':
      return 'deepseek-chat';
    case 'Qwen':
      return 'qwen-plus';
    case 'GPT':
      return 'gpt-4o-mini';
    case '自定义':
      return config.model || 'gpt-4o-mini';
    default:
      return 'gpt-4o-mini';
  }
}

export interface LlmResponse {
  success: boolean;
  text: string;
  error?: string;
}

/**
 * Parsed task operation from LLM response.
 */
export interface TaskOperation {
  op: 'add' | 'delete' | 'update';
  taskId?: string;
  task?: Partial<PlannedTask>;
  updates?: Partial<PlannedTask>;
}

/**
 * Try to parse a JSON string as a TaskOperation array.
 */
function tryParseOperations(jsonStr: string): TaskOperation[] {
  try {
    const parsed = JSON.parse(jsonStr);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (item: TaskOperation) =>
          item.op === 'add' || item.op === 'delete' || item.op === 'update'
      );
    }
  } catch {
    // Not valid JSON
  }
  return [];
}

/**
 * Parse the LLM response text, extracting the visible message and any task operations.
 *
 * Strategy (in order):
 * 1. Try to match ```daoshi_ops ... ``` (preferred format from system prompt)
 * 2. Try to match ```json ... ``` (some LLMs use this)
 * 3. Try to match ``` ... ``` (generic code block)
 * 4. Search for `[{"op":` patterns directly in raw text (inline JSON)
 */
export function parseLlmResponse(raw: string): { displayText: string; operations: TaskOperation[] } {
  // Strategy 1: ```daoshi_ops ... ```
  const daoshiOpsRegex = /```daoshi_ops\s*\n?([\s\S]*?)\n?\s*```/;
  let match = raw.match(daoshiOpsRegex);
  if (match) {
    const jsonStr = match[1].trim();
    const operations = tryParseOperations(jsonStr);
    if (operations.length > 0) {
      const displayText = raw.replace(daoshiOpsRegex, '').trim();
      return { displayText, operations };
    }
  }

  // Strategy 2: ```json ... ```
  const jsonCodeRegex = /```(?:json|javascript)\s*\n?([\s\S]*?)\n?\s*```/;
  match = raw.match(jsonCodeRegex);
  if (match) {
    const jsonStr = match[1].trim();
    const operations = tryParseOperations(jsonStr);
    if (operations.length > 0) {
      const displayText = raw.replace(jsonCodeRegex, '').trim();
      return { displayText, operations };
    }
  }

  // Strategy 3: Generic ``` ... ``` - try to parse content as JSON
  const anyCodeRegex = /```\s*\n?([\s\S]*?)\n?\s*```/;
  match = raw.match(anyCodeRegex);
  if (match) {
    const jsonStr = match[1].trim();
    const operations = tryParseOperations(jsonStr);
    if (operations.length > 0) {
      const displayText = raw.replace(anyCodeRegex, '').trim();
      return { displayText, operations };
    }
  }

  // Strategy 4: Search inline JSON starting with `[{"op"` — find text between first `[` and last `]`
  const startIdx = raw.indexOf('[{"op"');
  if (startIdx !== -1) {
    const endIdx = raw.lastIndexOf(']');
    if (endIdx > startIdx) {
      const jsonStr = raw.substring(startIdx, endIdx + 1);
      const operations = tryParseOperations(jsonStr);
      if (operations.length > 0) {
        const displayText = (raw.substring(0, startIdx) + raw.substring(endIdx + 1)).trim();
        return { displayText, operations };
      }
    }
  }

  return { displayText: raw, operations: [] };
}

export interface ChatInputMessage {
  role: 'user' | 'assistant';
  text: string;
  images?: string[];
}

export async function sendChatMessage(
  messages: ChatInputMessage[],
  config: LlmConfig,
  tasks: PlannedTask[]
): Promise<LlmResponse> {
  if (!config.enabled || !config.apiKey) {
    return {
      success: false,
      text: '',
      error: '请在设置中启用语言模型并配置 API Key。',
    };
  }

  const endpoint = resolveEndpoint(config);
  if (!endpoint) {
    return {
      success: false,
      text: '',
      error: 'LLM 服务配置无效，请检查设置中的 URL。',
    };
  }

  const systemPrompt = buildSystemPrompt(tasks);

  const chatMessages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...messages.map((m): ChatMessage => {
      if (m.images && m.images.length > 0) {
        // Multimodal content: text + images
        const parts: ChatMessagePart[] = [
          { type: 'text', text: m.text || '[图片]' },
          ...m.images.map((url) => ({ type: 'image_url' as const, image_url: { url } })),
        ];
        return { role: m.role as 'user' | 'assistant', content: parts };
      }
      return { role: m.role as 'user' | 'assistant', content: m.text };
    }),
  ];

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: resolveModel(config),
        messages: chatMessages,
        temperature: 0.7,
        max_tokens: 2048,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      return {
        success: false,
        text: '',
        error: `API 请求失败 (${response.status}): ${errorBody || response.statusText}`,
      };
    }

    const data = await response.json();
    const replyText = data.choices?.[0]?.message?.content?.trim();

    if (!replyText) {
      return {
        success: false,
        text: '',
        error: 'API 返回了空回复，请重试。',
      };
    }

    return { success: true, text: replyText };
  } catch (err) {
    const message = err instanceof Error ? err.message : '网络请求失败';
    return { success: false, text: '', error: `网络错误: ${message}` };
  }
}

export function formatChatError(error: string): string {
  return `⚠️ ${error}\n\n请检查设置中的 LLM 配置是否正确。`;
}
