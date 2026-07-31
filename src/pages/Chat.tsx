import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Share2,
  MoreVertical,
  Brain,
  Mic,
  Paperclip,
  ArrowUp,
  Trash2,
  Loader2,
  MessageSquare,
  CheckCircle2,
  X,
  FileText,
  Download,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStateStore, useTaskStore } from '@/store/taskStore';
import { useAuthStore } from '@/store/authStore';
import { sendChatMessage, formatChatError, parseLlmResponse } from '@/utils/llmService';
import type { PlannedTask, TaskCategory, DailyPlanPreset } from '@/types';
import * as pdfjsLib from 'pdfjs-dist';

// Initialize pdf.js worker (do once at module level)
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

// Type declarations for Web Speech API (not in all TS lib targets)
interface SpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}
interface SpeechRecognitionConstructor {
  new(): SpeechRecognition;
}
interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionResult {
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
}
interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface MessageFile {
  name: string;
  mime: string;
  data: string; // base64 data URL
  size: number;
  textContent?: string; // extracted text content (for text/PDF files)
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: string; // ISO 8601
  operations?: string; // Summary of executed operations
  images?: string[]; // base64 image data URLs
  files?: MessageFile[]; // non-image file attachments
}

function getChatKey(): string {
  const user = (() => {
    try { return localStorage.getItem('daoshi:session'); } catch { return null; }
  })();
  return user ? `daoshi:chatMessages:${user}` : 'daoshi:chatMessages:__guest__';
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${mins}`;
}

function generateId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

const INITIAL_MESSAGE: Message = {
  id: 'initial',
  role: 'assistant',
  text: '你好！我是「倒时·日程」的智能助手。你可以告诉我需要如何调整你的时间安排，比如：「把明天的学习任务移到上午」、「增加一段 2 小时的专注时间」等。',
  timestamp: new Date().toISOString(),
};

function loadMessages(): Message[] {
  try {
    const raw = localStorage.getItem(getChatKey());
    if (raw) {
      const parsed = JSON.parse(raw) as Message[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch { /* ignore */ }
  return [INITIAL_MESSAGE];
}

function saveMessages(messages: Message[]): void {
  localStorage.setItem(getChatKey(), JSON.stringify(messages));
}

/**
 * Compress a base64 image to a max width/height to reduce localStorage usage.
 */
function compressImage(dataUrl: string, maxDimension = 800, quality = 0.7): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = (height / width) * maxDimension;
          width = maxDimension;
        } else {
          width = (width / height) * maxDimension;
          height = maxDimension;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
      }
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_TEXT_LENGTH = 15 * 1024; // 15KB max text content for LLM (leave room for response)

const TEXT_FILE_TYPES = new Set([
  'text/plain', 'text/csv', 'text/json', 'text/xml',
  'application/json', 'application/xml',
]);

function isTextFile(file: File): boolean {
  const ext = file.name.toLowerCase().split('.').pop();
  return TEXT_FILE_TYPES.has(file.type) ||
    ext === 'txt' || ext === 'csv' || ext === 'json' || ext === 'xml';
}

function isPdfFile(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

/** Read a File as ArrayBuffer */
function readAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

/** Convert ArrayBuffer to base64 data URL */
function bufferToDataUrl(buffer: ArrayBuffer, mime: string): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

/** Extract text content from a PDF using pdf.js */
async function extractPdfText(buffer: ArrayBuffer): Promise<string> {
  const pdf = await pdfjsLib.getDocument({ data: buffer.slice(0) }).promise;
  const pageTexts: string[] = [];
  for (let i = 1; i <= Math.min(pdf.numPages, 20); i++) { // Limit to 20 pages
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map((item) => (item as { str: string }).str).join(' ');
    pageTexts.push(text);
  }
  return pageTexts.join('\n\n');
}

export default function Chat() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const openLoginModal = useAuthStore((s) => s.openLoginModal);
  const [messages, setMessages] = useState<Message[]>(loadMessages);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteMenu, setShowDeleteMenu] = useState(false);
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [pendingFiles, setPendingFiles] = useState<MessageFile[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const deleteMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const llmConfig = useAppStateStore((s) => s.appState.llm);
  const tasks = useTaskStore((s) => s.tasks);
  const addTask = useTaskStore((s) => s.addTask);
  const deleteTask = useTaskStore((s) => s.deleteTask);
  const updateTask = useTaskStore((s) => s.updateTask);

  // Persist messages to localStorage on every change
  useEffect(() => {
    saveMessages(messages);
  }, [messages]);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 3 * 24)}px`;
    }
  }, [inputText]);

  // Close delete menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (deleteMenuRef.current && !deleteMenuRef.current.contains(e.target as Node)) {
        setShowDeleteMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Initialize speech recognition
  useEffect(() => {
    const SpeechRecognitionAPI = (window as unknown as { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor }).SpeechRecognition
      || (window as unknown as { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor }).webkitSpeechRecognition;
    if (SpeechRecognitionAPI) {
      const recognition = new SpeechRecognitionAPI();
      recognition.lang = 'zh-CN';
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let interimText = '';
        let finalText = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalText += transcript;
          } else {
            interimText += transcript;
          }
        }
        if (finalText) {
          setInputText((prev) => prev + finalText);
        }
        // Show interim results as placeholder (optional visual feedback)
      };

      recognition.onerror = () => {
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch { /* ignore */ }
      }
    };
  }, []);

  /**
   * Execute task operations parsed from LLM response.
   * Returns a summary string describing what was done.
   */
  const executeOperations = useCallback(
    (operations: { op: string; taskId?: string; task?: Partial<PlannedTask>; updates?: Partial<PlannedTask> }[]) => {
      const summaries: string[] = [];

      for (const op of operations) {
        try {
          if (op.op === 'add' && op.task) {
            const newTask: PlannedTask = {
              id: crypto.randomUUID?.() ?? `task-${Date.now()}-${Math.random().toString(36).slice(2)}`,
              title: op.task.title || '未命名任务',
              category: (op.task.category as TaskCategory) || 'study',
              deadline: op.task.deadline || new Date(Date.now() + 86400000).toISOString(),
              estimatedHours: op.task.estimatedHours || 1,
              dailyPlan: (op.task.dailyPlan as DailyPlanPreset) || 'steady',
              isFixedTime: op.task.isFixedTime || false,
              fixedStart: op.task.fixedStart,
              fixedEnd: op.task.fixedEnd,
              repeatsWeekly: false,
              conflictReminderEnabled: true,
              manualFocusBlocks: [],
              locationText: op.task.locationText,
              isCompleted: false,
            };
            addTask(newTask);
            summaries.push(`✅ 已添加任务「${newTask.title}」`);
          } else if (op.op === 'delete' && op.taskId) {
            const target = tasks.find((t) => t.id === op.taskId);
            if (target) {
              deleteTask(op.taskId);
              summaries.push(`🗑️ 已删除任务「${target.title}」`);
            } else {
              summaries.push(`⚠️ 未找到要删除的任务 (ID: ${op.taskId})`);
            }
          } else if (op.op === 'update' && op.taskId && op.updates) {
            const target = tasks.find((t) => t.id === op.taskId);
            if (target) {
              updateTask(op.taskId, op.updates);
              const changes = Object.keys(op.updates).join('、');
              summaries.push(`✏️ 已修改任务「${target.title}」的 ${changes}`);
            } else {
              summaries.push(`⚠️ 未找到要修改的任务 (ID: ${op.taskId})`);
            }
          }
        } catch (err) {
          summaries.push(`⚠️ 操作执行失败: ${err instanceof Error ? err.message : '未知错误'}`);
        }
      }

      return summaries.join('\n');
    },
    [tasks, addTask, deleteTask, updateTask]
  );

  // --- File / Image upload ---

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList) return;

    const processFile = async (file: File) => {
      if (file.size > MAX_FILE_SIZE) return;

      if (file.type.startsWith('image/')) {
          // Image → compress and store
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
          });
          const compressed = await compressImage(dataUrl);
          setPendingImages((prev) => [...prev, compressed]);
          return;
        }

      if (isTextFile(file)) {
        // Text file → read as text + data URL
        const buffer = await readAsArrayBuffer(file);
        const dataUrl = bufferToDataUrl(buffer, file.type);
        const textContent = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
        setPendingFiles((prev) => [...prev, {
          name: file.name, mime: file.type, data: dataUrl, size: file.size,
          textContent: textContent.substring(0, MAX_TEXT_LENGTH),
        }]);
        return;
      }

      if (isPdfFile(file)) {
        // PDF → extract text + data URL
        const buffer = await readAsArrayBuffer(file);
        const dataUrl = bufferToDataUrl(buffer, file.type);
        let textContent: string | undefined;
        try {
          textContent = await extractPdfText(buffer);
          if (textContent.length > MAX_TEXT_LENGTH) {
            textContent = textContent.substring(0, MAX_TEXT_LENGTH) + '\n\n...（内容已截断）';
          }
        } catch (err) {
          console.warn('PDF text extraction failed:', err);
        }
        setPendingFiles((prev) => [...prev, {
          name: file.name, mime: file.type, data: dataUrl, size: file.size,
          textContent,
        }]);
        return;
      }

      // Other file types → data URL only
      const buffer = await readAsArrayBuffer(file);
      const dataUrl = bufferToDataUrl(buffer, file.type);
      setPendingFiles((prev) => [...prev, {
        name: file.name, mime: file.type, data: dataUrl, size: file.size,
      }]);
    };

    // Process files sequentially to avoid race conditions with state updates
    for (let i = 0; i < fileList.length; i++) {
      await processFile(fileList[i]);
    }

    // Reset input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    const imageItems: DataTransferItem[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        imageItems.push(items[i]);
      }
    }

    if (imageItems.length > 0) {
      e.preventDefault();
      imageItems.forEach((item) => {
        const file = item.getAsFile();
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) return;

        const reader = new FileReader();
        reader.onload = async (ev) => {
          const dataUrl = ev.target?.result as string;
          const compressed = await compressImage(dataUrl);
          setPendingImages((prev) => [...prev, compressed]);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const removePendingImage = (index: number) => {
    setPendingImages((prev) => prev.filter((_, i) => i !== index));
  };

  const removePendingFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // --- Voice dictation ---

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      return; // Speech recognition not supported
    }

    if (isRecording) {
      try { recognitionRef.current.stop(); } catch { /* ignore */ }
      setIsRecording(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsRecording(true);
      } catch {
        setIsRecording(false);
      }
    }
  };

  // --- Send ---

  const handleSend = async () => {
    if ((!inputText.trim() && pendingImages.length === 0 && pendingFiles.length === 0) || isLoading) return;

    const userMsg: Message = {
      id: generateId(),
      role: 'user',
      text: inputText.trim(),
      timestamp: new Date().toISOString(),
      images: pendingImages.length > 0 ? [...pendingImages] : undefined,
      files: pendingFiles.length > 0 ? [...pendingFiles] : undefined,
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInputText('');
    setPendingImages([]);
    setPendingFiles([]);
    setIsLoading(true);

    const result = await sendChatMessage(
      updatedMessages
        .filter((m) => m.id !== 'initial' || m === INITIAL_MESSAGE)
        .map((m) => {
          // Include file content as text context for LLM
          let text = m.text;
          if (m.files && m.files.length > 0) {
            const fileParts = m.files.map((f) => {
              if (f.textContent) {
                // With extractable text → tell LLM to create tasks from it
                return (
                  `[用户上传了文件: "${f.name}" (${formatFileSize(f.size)})]\n` +
                  `请根据以上文件的内容，创建或修改对应的日程任务。如果需要，请使用 \`\`\`daoshi_ops 格式输出。\n` +
                  `--- ${f.name} 内容 ---\n${f.textContent}\n--- ${f.name} 内容结束 ---`
                );
              }
              return `[用户上传了文件: "${f.name}" (${formatFileSize(f.size)})，但无法读取其文字内容]`;
            });
            text = text
              ? `${text}\n\n${fileParts.join('\n\n')}`
              : `请根据以下文件内容创建日程任务。\n\n${fileParts.join('\n\n')}`;
          }
          return {
            role: m.role as 'user' | 'assistant',
            text,
            images: m.images,
          };
        }),
      llmConfig,
      tasks
    );

    if (result.success) {
      // Parse the response for task operations
      const { displayText, operations } = parseLlmResponse(result.text);

      // Log for debugging
      console.log('[Chat] LLM response length:', result.text.length);
      console.log('[Chat] LLM response (last 2000 chars):', result.text.substring(result.text.length - 2000));
      console.log('[Chat] Contains ```daoshi_ops:', result.text.includes('```daoshi_ops'));
      console.log('[Chat] Contains ```json:', result.text.includes('```json'));
      console.log('[Chat] Contains [{"op":', result.text.includes('[{"op"'));
      console.log('[Chat] Contains ```:', result.text.includes('```'));
      console.log('[Chat] Parsed operations:', JSON.stringify(operations));

      let opSummary = '';
      if (operations.length > 0) {
        opSummary = executeOperations(operations);
        console.log('[Chat] Operations result:', opSummary);
      } else {
        console.warn('[Chat] No operations parsed from LLM response');
      }

      const assistantMsg: Message = {
        id: generateId(),
        role: 'assistant',
        text: displayText,
        timestamp: new Date().toISOString(),
        operations: opSummary || undefined,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } else {
      const errorMsg: Message = {
        id: generateId(),
        role: 'assistant',
        text: formatChatError(result.error || '未知错误'),
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    }

    setIsLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleDeleteBeforeToday = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    setMessages((prev) => {
      const filtered = prev.filter((m) => new Date(m.timestamp) >= today);
      return filtered.length > 0 ? filtered : [INITIAL_MESSAGE];
    });
    setShowDeleteMenu(false);
  };

  const handleDeleteAll = () => {
    setMessages([INITIAL_MESSAGE]);
    setShowDeleteMenu(false);
  };

  const handleExport = () => {
    const text = messages
      .filter((m) => m.role !== 'system')
      .map((m) => `[${m.role === 'user' ? '用户' : '助手'}] ${m.text}`)
      .join('\n\n');
    navigator.clipboard?.writeText(text).catch(() => {});
  };

  if (!isLoggedIn) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[var(--surface)] px-6">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
          style={{ backgroundColor: 'rgb(0.01, 0.16, 0.47)' }}>
          <MessageSquare className="w-7 h-7 text-white" />
        </div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">
          登录后使用人机对话
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 text-center max-w-xs">
          请先登录账号，即可与智能助手对话、管理你的日程安排。
        </p>
        <button
          onClick={openLoginModal}
          className="px-8 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors hover:opacity-90"
          style={{ backgroundColor: 'rgb(0.01, 0.16, 0.47)' }}
        >
          去登录
        </button>
      </div>
    );
  }

  const isEmpty = messages.length === 0 || (messages.length === 1 && messages[0].id === 'initial');

  return (
    <div className="flex flex-col flex-1 h-screen bg-[var(--surface)]">
      {/* Header */}
      <div className="flex items-start justify-between px-6 pt-4 pb-3 border-b border-gray-100 dark:border-gray-800">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            人机对话
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            请向「倒时 · 日程」助手，描述你的任务调整需求。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors"
            title="导出对话"
          >
            <Share2 className="w-4 h-4" />
          </button>
          <div className="relative" ref={deleteMenuRef}>
            <button
              onClick={() => setShowDeleteMenu(!showDeleteMenu)}
              className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            {showDeleteMenu && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 py-1 z-10">
                <button
                  onClick={handleDeleteBeforeToday}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  删除今天之前的对话
                </button>
                <button
                  onClick={handleDeleteAll}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  删除全部对话
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <MessageSquare className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-sm text-gray-400 dark:text-gray-500">
              暂无对话记录，开始一段新的对话吧
            </p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            if (msg.role === 'system') return null;

            const showTimestamp =
              idx === 0 ||
              new Date(messages[idx - 1].timestamp).getTime() - new Date(msg.timestamp).getTime() > 300000 ||
              messages[idx - 1].role !== msg.role;

            return (
              <div key={msg.id}>
                {/* Timestamp header */}
                {showTimestamp && (
                  <div className="flex justify-center mb-3">
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
                      {formatTime(msg.timestamp)}
                    </span>
                  </div>
                )}

                <div
                  className={cn(
                    'flex gap-2',
                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                  )}
                >
                  {/* Assistant icon */}
                  {msg.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0 mt-1">
                      <Brain className="w-4 h-4 text-gray-500" />
                    </div>
                  )}

                  {/* Message bubble */}
                  <div className="max-w-[80%] space-y-2">
                    <div
                      className={cn(
                        'rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                        msg.role === 'user'
                          ? 'text-white'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                      )}
                      style={
                        msg.role === 'user'
                          ? {
                              backgroundColor: 'rgba(0.01, 0.16, 0.47, 0.1)',
                              color: 'rgb(0.01, 0.16, 0.47)',
                            }
                          : undefined
                      }
                    >
                      {/* Images in message */}
                      {msg.images && msg.images.length > 0 && (
                        <div className={cn('flex flex-wrap gap-1.5', msg.text || (msg.files && msg.files.length > 0) ? 'mb-2' : '')}>
                          {msg.images.map((img, i) => (
                            <img
                              key={i}
                              src={img}
                              alt={`图片 ${i + 1}`}
                              className="max-w-[200px] max-h-[200px] rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity"
                              loading="lazy"
                              onClick={() => window.open(img, '_blank')}
                            />
                          ))}
                        </div>
                      )}

                      {/* File attachments in message */}
                      {msg.files && msg.files.length > 0 && (
                        <div className={cn('flex flex-wrap gap-2', msg.text ? 'mt-2' : '')}>
                          {msg.files.map((file, i) => (
                            <div
                              key={i}
                              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-white/80 dark:hover:bg-gray-900/80 transition-colors max-w-[240px]"
                              onClick={() => window.open(file.data, '_blank')}
                              title="点击下载/查看"
                            >
                              <FileText className="w-5 h-5 flex-shrink-0 text-blue-500" />
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-medium truncate">{file.name}</p>
                                <p className="text-[10px] text-gray-400">{formatFileSize(file.size)}</p>
                              </div>
                              <Download className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
                            </div>
                          ))}
                        </div>
                      )}

                      {msg.text && (
                        <span className={cn(msg.role === 'user' && 'dark:text-blue-200')}>
                          {msg.text}
                        </span>
                      )}
                    </div>

                    {/* Operation result badge */}
                    {msg.operations && (
                      <div className="flex items-start gap-1.5 px-3 py-2 bg-green-50 dark:bg-green-950/30 rounded-xl border border-green-200 dark:border-green-800/50">
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                        <span className="text-xs text-green-700 dark:text-green-300 whitespace-pre-line">
                          {msg.operations}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex items-start gap-2">
            <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
              <Brain className="w-4 h-4 text-gray-500" />
            </div>
            <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl px-4 py-2.5 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
              <span className="text-sm text-gray-500 dark:text-gray-400">正在思考...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <div className="border-t border-gray-100 dark:border-gray-800 bg-[var(--surface)]">
        {/* Pending previews (images + files) */}
        {(pendingImages.length > 0 || pendingFiles.length > 0) && (
          <div className="flex flex-wrap gap-2 px-6 pt-3 pb-1">
            {pendingImages.map((img, i) => (
              <div key={`img-${i}`} className="relative group">
                <img
                  src={img}
                  alt={`待发送图片 ${i + 1}`}
                  className="w-16 h-16 rounded-lg object-cover border border-gray-200 dark:border-gray-700"
                />
                <button
                  onClick={() => removePendingImage(i)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 shadow-sm"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            {pendingFiles.map((file, i) => (
              <div key={`file-${i}`} className="relative group">
                <div className="w-36 flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm">
                  <FileText className="w-5 h-5 flex-shrink-0 text-blue-500" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate text-gray-700 dark:text-gray-300">{file.name}</p>
                    <p className="text-[10px] text-gray-400">{formatFileSize(file.size)}</p>
                  </div>
                </div>
                <button
                  onClick={() => removePendingFile(i)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 shadow-sm"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Recording indicator */}
        {isRecording && (
          <div className="flex items-center gap-2 px-6 pt-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
            </span>
            <span className="text-xs text-red-500 font-medium">正在录音...</span>
          </div>
        )}

        <div className="flex items-end gap-2 px-6 py-3">
          {/* Voice button */}
          <button
            onClick={toggleRecording}
            className={cn(
              'p-2 rounded-xl transition-colors flex-shrink-0',
              isRecording
                ? 'bg-red-100 dark:bg-red-900/30 text-red-500'
                : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400'
            )}
            title={isRecording ? '停止录音' : '语音输入'}
          >
            <Mic className={cn('w-5 h-5', isRecording && 'animate-pulse')} />
          </button>

          {/* Text area */}
          <textarea
            ref={textareaRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder="告诉我您的任务调整…（支持附件和粘贴图片）"
            rows={1}
            className="flex-1 bg-transparent text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 resize-none outline-none py-1.5 max-h-[72px]"
          />

          {/* Attachment button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 transition-colors flex-shrink-0"
            title="上传附件"
          >
            <Paperclip className="w-5 h-5" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.json,.xml,.zip,.rar"
            multiple
            onChange={handleFileUpload}
            className="hidden"
          />

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={(!inputText.trim() && pendingImages.length === 0 && pendingFiles.length === 0) || isLoading}
            className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all',
              (inputText.trim() || pendingImages.length > 0 || pendingFiles.length > 0) && !isLoading
                ? 'text-white shadow-sm'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
            )}
            style={
              (inputText.trim() || pendingImages.length > 0 || pendingFiles.length > 0) && !isLoading
                ? { backgroundColor: 'rgb(0.01, 0.16, 0.47)' }
                : undefined
            }
          >
            <ArrowUp className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
