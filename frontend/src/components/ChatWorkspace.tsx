'use client';

import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ArrowUp,
  Square,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Download,
  Copy,
  Check,
  Clock,
  Database,
  Sparkles,
} from 'lucide-react';
import { ChatSettings } from './Settings';
import { API_URL } from '@/lib/api';

interface ChatWorkspaceProps {
  userName: string;
  userEmail: string;
  chatHistory: { role: string; content: string }[];
  setChatHistory: React.Dispatch<React.SetStateAction<{ role: string; content: string }[]>>;
  sessionId: string;
  setSessionId: (id: string) => void;
  onMessageSent: () => void | Promise<void>;
  settings: ChatSettings;
  initialPrompt?: string;
  onClearInitialPrompt?: () => void;
  onGuestLimitReached?: () => void;
}

const STARTER_CHIPS = [
  {
    icon: Sparkles,
    label: 'Plan my daily routine',
    prompt: 'Help me organize a clear daily routine based on my primary goal.',
  },
  {
    icon: Clock,
    label: 'Set a reminder',
    prompt: 'Remind me to review my tasks today at 6:00 PM.',
  },
  {
    icon: Database,
    label: 'Save a routine note',
    prompt: 'Remember that I prefer focused work blocks in the morning and lighter tasks in the evening.',
  },
];

export default function ChatWorkspace({
  userName,
  userEmail,
  chatHistory,
  setChatHistory,
  sessionId,
  setSessionId,
  onMessageSent,
  settings,
  initialPrompt,
  onClearInitialPrompt,
  onGuestLimitReached,
}: ChatWorkspaceProps) {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Speech Refs
  const speechQueueRef = useRef<string[]>([]);
  const isSpeakingRef = useRef(false);
  const textBufferRef = useRef("");

  const userInitials = userName ? userName.slice(0, 2).toUpperCase() : 'ME';

  useEffect(() => {
    if (initialPrompt) {
      setQuestion(initialPrompt);
      onClearInitialPrompt?.();
    }
  }, [initialPrompt, onClearInitialPrompt]);

  const handleCopyMessage = async (content: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 1800);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  const handleStopStreaming = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setLoading(false);
    window.speechSynthesis?.cancel();
    speechQueueRef.current = [];
    textBufferRef.current = "";
    isSpeakingRef.current = false;
  };

  // --- Export Chat to Markdown ---
  const handleExportChat = () => {
    if (chatHistory.length === 0) return;

    let markdownContent = `# Chat Export with ${userName}\n\n`;
    markdownContent += `Date: ${new Date().toLocaleString()}\n\n---\n\n`;

    chatHistory.forEach((msg) => {
      const roleName = msg.role === 'user' ? userName : 'AI Assistant';
      markdownContent += `**${roleName}:**\n${msg.content}\n\n---\n\n`;
    });

    const blob = new Blob([markdownContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `chat_export_${new Date().toISOString().split('T')[0]}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const processQueue = () => {
    if (speechQueueRef.current.length === 0) {
      isSpeakingRef.current = false;
      return;
    }

    isSpeakingRef.current = true;
    const text = speechQueueRef.current.shift()!;
    const cleanText = text.replace(/[*#`]/g, '').trim();

    if (!cleanText) {
      processQueue();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(cleanText);

    if (settings.voiceName) {
      const voice = window.speechSynthesis.getVoices().find(v => v.name === settings.voiceName);
      if (voice) utterance.voice = voice;
    }

    utterance.rate = 1.0;

    utterance.onend = () => {
      setTimeout(() => {
        processQueue();
      }, 100);
    };

    utterance.onerror = () => {
      isSpeakingRef.current = false;
    };

    window.speechSynthesis.speak(utterance);
  };

  const queueSpeech = (token: string, forceFlush: boolean = false) => {
    if (!voiceEnabled) return;

    textBufferRef.current += token;

    const sentenceEndRegex = /([^.!?\n]+[.!?\n]+)/g;
    let match;
    let extracted = "";

    while ((match = sentenceEndRegex.exec(textBufferRef.current)) !== null) {
      extracted += match[0];
    }

    if (extracted) {
      textBufferRef.current = textBufferRef.current.replace(extracted, "").trim();
      speechQueueRef.current.push(extracted);
    }

    if (forceFlush && textBufferRef.current.trim().length > 0) {
      speechQueueRef.current.push(textBufferRef.current);
      textBufferRef.current = "";
    }

    if (!isSpeakingRef.current && speechQueueRef.current.length > 0) {
      processQueue();
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = false;
        recognitionRef.current.interimResults = true;
        recognitionRef.current.lang = 'en-US';

        recognitionRef.current.onresult = (event: any) => {
          let currentTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            currentTranscript += event.results[i][0].transcript;
          }
          setQuestion(currentTranscript);
        };

        recognitionRef.current.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
          setIsListening(false);
        };

        recognitionRef.current.onend = () => setIsListening(false);

        recognitionRef.current.onspeechend = () => {
          recognitionRef.current?.stop();
          setIsListening(false);
          setTimeout(() => {
            if (formRef.current) {
              if (formRef.current.requestSubmit) formRef.current.requestSubmit();
              else formRef.current.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
            }
          }, 500);
        };
      }
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      setQuestion('');
      recognitionRef.current?.start();
      setIsListening(true);

      window.speechSynthesis?.cancel();
      speechQueueRef.current = [];
      textBufferRef.current = "";
      isSpeakingRef.current = false;
    }
  };

  useEffect(() => {
    if (!sessionId) {
      abortControllerRef.current?.abort();
      setQuestion('');
      setLoading(false);
      if (isListening) {
        recognitionRef.current?.stop();
        setIsListening(false);
      }
      window.speechSynthesis?.cancel();
      speechQueueRef.current = [];
      textBufferRef.current = "";
      isSpeakingRef.current = false;
    }
  }, [sessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, loading]);

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || loading) return;

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    }

    window.speechSynthesis?.cancel();
    speechQueueRef.current = [];
    textBufferRef.current = "";
    isSpeakingRef.current = false;

    const userMsg = question;
    setQuestion('');
    setChatHistory((prev) => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    const isBrandNewSession = !sessionId;
    let currentAnswer = "";
    let assistantAdded = false;

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const userTimezone =
      typeof Intl !== 'undefined'
        ? Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
        : 'UTC';

    try {
      const res = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          question: userMsg,
          session_id: sessionId || null,
          history: chatHistory,
          persona: settings.persona,
          user_email: userEmail,
          timezone: userTimezone,
        }),
      });

      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.replace('data: ', '').trim();
            if (!dataStr) continue;

            try {
              const data = JSON.parse(dataStr);

              if (data.limit_reached) {
                setLoading(false);
                abortControllerRef.current = null;
                setChatHistory((prev) => prev.slice(0, -1));
                setQuestion(userMsg);
                onGuestLimitReached?.();
                return;
              }

              if (data.token) {
                currentAnswer += data.token;
                queueSpeech(data.token, false);

                requestAnimationFrame(() => {
                  if (!assistantAdded) {
                    setChatHistory((prev) => [
                      ...prev,
                      { role: 'assistant', content: currentAnswer },
                    ]);
                    assistantAdded = true;
                  } else {
                    setChatHistory((prev) => {
                      const newHistory = [...prev];
                      const lastIndex = newHistory.length - 1;
                      if (newHistory[lastIndex]?.role === 'assistant') {
                        newHistory[lastIndex] = { role: 'assistant', content: currentAnswer };
                      }
                      return newHistory;
                    });
                  }
                });
              }

              if (data.session_id && !sessionId) {
                setSessionId(data.session_id);
              }

              if (data.error) {
                console.error("Stream error:", data.error);
              }

              if (data.done) {
                setLoading(false);
                abortControllerRef.current = null;
                queueSpeech("", true);
                if (isBrandNewSession) onMessageSent();
              }
            } catch (e) {
              console.error("Parse error:", e);
            }
          }
        }
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        setLoading(false);
        return;
      }
      console.error(err);
      setChatHistory((prev) => [...prev, { role: 'assistant', content: 'Error communicating with the server.' }]);
      setLoading(false);
    } finally {
      abortControllerRef.current = null;
    }
  };

  return (
    <div
      className="flex-1 min-w-0 flex flex-col h-full max-w-3xl w-full mx-auto px-3 sm:px-4 overflow-hidden relative"
      style={{ background: settings.chatBackground }}
    >
      {/* Header Row with Export Button */}
      <div className="flex justify-end items-center pt-2.5 sm:pt-4 pb-2 z-30 shrink-0">
        <button
          type="button"
          data-tour-id="export-btn"
          onClick={handleExportChat}
          disabled={chatHistory.length === 0}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
            chatHistory.length > 0
              ? 'bg-[#28292a] text-[#c4c7c5] hover:bg-[#333537] hover:text-white shadow-sm'
              : 'bg-transparent text-[#555] cursor-not-allowed'
          }`}
          title="Export chat to Markdown"
        >
          <Download className="w-3.5 h-3.5" />
          Export
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar space-y-5 sm:space-y-6 pb-6">
        {chatHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-full text-center space-y-4 px-1 py-4">
            <div className="space-y-1.5">
              <h1 className="text-2xl sm:text-3xl font-medium text-transparent bg-clip-text bg-gradient-to-r from-[#90b4fc] to-[#e3e3e3]">
                Hello, {userName}.
              </h1>
              <p className="text-xs sm:text-sm text-[#c4c7c5]">
                Your personal routine, reminder, memory, and general AI workspace.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 max-w-lg pt-1">
              {STARTER_CHIPS.map((chip) => {
                const ChipIcon = chip.icon;
                return (
                  <button
                    key={chip.label}
                    type="button"
                    onClick={() => setQuestion(chip.prompt)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#1e1f20] hover:bg-[#28292a] border border-[#333537] px-3 py-1.5 text-xs text-[#e3e3e3] transition"
                  >
                    <ChipIcon className="w-3.5 h-3.5 text-[#a8c7fa] shrink-0" />
                    <span>{chip.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="space-y-5 sm:space-y-6">
            {chatHistory.map((msg: { role: string; content: string }, idx: number) => (
              <div key={idx} className={`flex gap-2.5 sm:gap-4 items-start group ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#a8c7fa] text-[#062e6f] flex items-center justify-center font-bold text-xs shrink-0 mt-1">
                    {userInitials}
                  </div>
                )}

                <div className="flex flex-col max-w-[85%] sm:max-w-[82%] min-w-0 gap-1">
                  <div
                    className={`p-3.5 sm:p-4 leading-relaxed shadow-sm break-words ${
                      msg.role === 'user' ? 'text-white' : 'text-[#e3e3e3] border'
                    }`}
                    style={{
                      background: msg.role === 'user' ? settings.userBubbleColor : settings.aiBubbleColor,
                      borderColor: msg.role === 'assistant' ? settings.aiBubbleBorder : 'transparent',
                      borderRadius: `${settings.bubbleRadius}px`,
                      borderBottomRightRadius: msg.role === 'user' ? '4px' : `${settings.bubbleRadius}px`,
                      borderBottomLeftRadius: msg.role === 'assistant' ? '4px' : `${settings.bubbleRadius}px`,
                      fontSize: `${settings.fontScale}px`,
                    }}
                  >
                    {msg.role === 'assistant' ? (
                      <div className="prose prose-invert prose-sm max-w-none prose-p:my-1.5 prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5 prose-pre:bg-[#131314] prose-pre:border prose-pre:border-[#333537] prose-pre:rounded-lg prose-pre:overflow-x-auto prose-code:text-[#a8c7fa]">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                    )}
                  </div>

                  {msg.role === 'assistant' && (
                    <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity pl-1">
                      <button
                        type="button"
                        onClick={() => handleCopyMessage(msg.content, idx)}
                        className="flex items-center gap-1 text-[11px] text-[#8e918f] hover:text-white px-2 py-0.5 rounded hover:bg-[#28292a] transition"
                        title="Copy response"
                      >
                        {copiedIdx === idx ? (
                          <>
                            <Check className="w-3 h-3 text-green-400" />
                            <span className="text-green-400">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-2.5 sm:gap-4 items-start justify-start">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#a8c7fa] text-[#062e6f] flex items-center justify-center font-bold text-xs shrink-0 mt-1">
                  {userInitials}
                </div>
                <div className="bg-[#1e1f20] border border-[#333537] p-4 rounded-2xl rounded-bl-sm flex items-center gap-1.5 h-[52px]">
                  <div className="w-1.5 h-1.5 bg-[#c4c7c5] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-1.5 h-1.5 bg-[#c4c7c5] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-1.5 h-1.5 bg-[#c4c7c5] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  <div className="w-1.5 h-1.5 bg-[#c4c7c5] rounded-full animate-bounce" style={{ animationDelay: '450ms' }} />
                  <div className="w-1.5 h-1.5 bg-[#c4c7c5] rounded-full animate-bounce" style={{ animationDelay: '600ms' }} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} className="h-4" />
          </div>
        )}
      </div>

      {/* Fade gradient */}
      <div className="absolute top-12 sm:top-14 left-0 right-0 h-6 bg-gradient-to-b from-[#131314] to-transparent pointer-events-none z-10" />

      <div className="py-3 sm:py-4 bg-[#131314] shrink-0 z-20 w-full">
        <form
          ref={formRef}
          data-tour-id="chat-input"
          onSubmit={handleSendChat}
          className="bg-[#1e1f20] border border-[#444746] rounded-3xl p-1.5 sm:p-2 flex items-center gap-1 sm:gap-2 shadow-lg w-full max-w-full overflow-hidden"
        >
          <button
            type="button"
            data-tour-id="voice-btn"
            onClick={() => {
              setVoiceEnabled(!voiceEnabled);
              if (voiceEnabled) {
                window.speechSynthesis?.cancel();
                speechQueueRef.current = [];
                textBufferRef.current = "";
                isSpeakingRef.current = false;
              }
            }}
            className={`w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-full transition shrink-0 ${
              voiceEnabled
                ? 'bg-[#004a77] text-[#c2e7ff]'
                : 'bg-[#28292a] text-[#c4c7c5] hover:bg-[#333537] hover:text-white'
            }`}
            title={voiceEnabled ? "Mute AI voice" : "Enable AI voice"}
          >
            {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          <button
            type="button"
            data-tour-id="mic-btn"
            onClick={toggleListening}
            className={`w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-full transition shrink-0 ${
              isListening
                ? 'bg-red-500 text-white animate-pulse'
                : 'bg-[#28292a] text-[#c4c7c5] hover:bg-[#333537] hover:text-white'
            }`}
            title={isListening ? "Stop listening" : "Use voice input"}
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={isListening ? "Listening..." : "Ask about routines, tasks, code, or anything..."}
            className="w-0 flex-1 min-w-0 bg-transparent border-none outline-none px-1.5 sm:px-3 text-sm text-white placeholder-[#8e918f]"
          />

          {loading ? (
            <button
              type="button"
              onClick={handleStopStreaming}
              className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-full bg-red-500/20 text-red-400 hover:bg-red-500/30 transition shrink-0"
              title="Stop generating"
            >
              <Square className="w-4 h-4 fill-current" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!question.trim()}
              aria-label="Send message"
              className={`w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-full transition shrink-0 ${
                question.trim()
                  ? 'bg-[#a8c7fa] text-[#062e6f] hover:bg-[#8ab4f8]'
                  : 'bg-[#333537] text-[#8e918f] cursor-not-allowed'
              }`}
            >
              <ArrowUp className="w-4 h-4 font-bold" />
            </button>
          )}
        </form>
        <p className="text-[10px] text-center text-[#8e918f] mt-2">
          Personal AI Assistant • Powered by CignalPulse
        </p>
      </div>
    </div>
  );
}