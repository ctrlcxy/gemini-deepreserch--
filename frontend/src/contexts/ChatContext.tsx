import {
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useStream } from "@langchain/langgraph-sdk/react";
import type { Message } from "@langchain/langgraph-sdk";

import type { ProcessedEvent } from "@/components/ActivityTimeline";

interface ConversationSnapshot {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
  activities: Record<string, ProcessedEvent[]>;
}

interface ChatContextValue {
  thread: any;
  processedEventsTimeline: ProcessedEvent[];
  historicalActivities: Record<string, ProcessedEvent[]>;
  error: string | null;
  handleSubmit: (input: string, effort: string, model: string) => void;
  handleCancel: () => void;
  conversationHistory: ConversationSnapshot[];
  activeConversationId: string | null;
  selectConversation: (conversationId: string | null) => void;
}

type MessageState = {
  messages: Message[];
  initial_search_query_count: number;
  max_research_loops: number;
  reasoning_model: string;
};

const ChatContext = createContext<ChatContextValue | undefined>(undefined);

const HISTORY_STORAGE_KEY = "chat_history_v1";
const ACTIVE_CONVERSATION_KEY = "chat_active_conversation_v1";
const CURRENT_SESSION_KEY = "chat_active_session_v1";

function readHistoryFromStorage(): ConversationSnapshot[] {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as ConversationSnapshot[];
  } catch (err) {
    console.warn("Failed to read chat history", err);
    return [];
  }
}

function writeHistoryToStorage(history: ConversationSnapshot[]) {
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
  } catch (err) {
    console.warn("Failed to persist chat history", err);
  }
}

function readActiveConversation(): string | null {
  try {
    return localStorage.getItem(ACTIVE_CONVERSATION_KEY);
  } catch (err) {
    console.warn("Failed to read active conversation", err);
    return null;
  }
}

function writeActiveConversation(conversationId: string | null) {
  try {
    if (conversationId) {
      localStorage.setItem(ACTIVE_CONVERSATION_KEY, conversationId);
    } else {
      localStorage.removeItem(ACTIVE_CONVERSATION_KEY);
    }
  } catch (err) {
    console.warn("Failed to persist active conversation", err);
  }
}

function readActiveSession(): string | null {
  try {
    return localStorage.getItem(CURRENT_SESSION_KEY);
  } catch (err) {
    console.warn("Failed to read active session", err);
    return null;
  }
}

function writeActiveSession(sessionId: string | null) {
  try {
    if (sessionId) {
      localStorage.setItem(CURRENT_SESSION_KEY, sessionId);
    } else {
      localStorage.removeItem(CURRENT_SESSION_KEY);
    }
  } catch (err) {
    console.warn("Failed to persist active session", err);
  }
}

function generateSessionId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function ChatProvider({ children }: PropsWithChildren) {
  const [processedEventsTimeline, setProcessedEventsTimeline] = useState<
    ProcessedEvent[]
  >([]);
  const [historicalActivities, setHistoricalActivities] = useState<
    Record<string, ProcessedEvent[]>
  >({});
  const [error, setError] = useState<string | null>(null);
  const [conversationHistory, setConversationHistory] = useState<
    ConversationSnapshot[]
  >(() => readHistoryFromStorage());
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(() => readActiveConversation());

  const hasFinalizeEventOccurredRef = useRef(false);
  const sessionIdRef = useRef<string | null>(readActiveSession());

  const thread = useStream<MessageState>({
    apiUrl: import.meta.env.DEV
      ? "http://localhost:2024"
      : "http://localhost:8123",
    assistantId: "agent",
    messagesKey: "messages",
    onUpdateEvent: (event: any) => {
      let processedEvent: ProcessedEvent | null = null;
      if (event.generate_query) {
        processedEvent = {
          title: "Generating Search Queries",
          data: event.generate_query?.search_query?.join(", ") || "",
        };
      } else if (event.web_research) {
        const sources = event.web_research.sources_gathered || [];
        const numSources = sources.length;
        const uniqueLabels = [
          ...new Set(sources.map((s: any) => s.label).filter(Boolean)),
        ];
        const exampleLabels = uniqueLabels.slice(0, 3).join(", ");
        processedEvent = {
          title: "Web Research",
          data: `Gathered ${numSources} sources. Related to: ${
            exampleLabels || "N/A"
          }.`,
        };
      } else if (event.reflection) {
        processedEvent = {
          title: "Reflection",
          data: "Analysing Web Research Results",
        };
      } else if (event.finalize_answer) {
        processedEvent = {
          title: "Finalizing Answer",
          data: "Composing and presenting the final answer.",
        };
        hasFinalizeEventOccurredRef.current = true;
      }
      if (processedEvent) {
        setProcessedEventsTimeline((prevEvents) => [
          ...prevEvents,
          processedEvent!,
        ]);
      }
    },
    onError: (err: any) => {
      setError(err?.message ?? "Unexpected error");
    },
  });

  useEffect(() => {
    writeHistoryToStorage(conversationHistory);
  }, [conversationHistory]);

  useEffect(() => {
    writeActiveConversation(activeConversationId);
  }, [activeConversationId]);

  useEffect(() => {
    if (
      hasFinalizeEventOccurredRef.current &&
      !thread.isLoading &&
      thread.messages.length > 0
    ) {
      const lastMessage = thread.messages[thread.messages.length - 1];
      if (lastMessage && lastMessage.type === "ai") {
        const sessionId = sessionIdRef.current ?? generateSessionId();
        sessionIdRef.current = sessionId;
        writeActiveSession(sessionId);

        const firstHuman = thread.messages.find((msg) => msg.type === "human");
        const activitiesSnapshot: Record<string, ProcessedEvent[]> = {
          ...historicalActivities,
        };
        if (typeof lastMessage.id === "string") {
          activitiesSnapshot[lastMessage.id] = [...processedEventsTimeline];
        }

        const snapshot: ConversationSnapshot = {
          id: sessionId,
          title:
            typeof firstHuman?.content === "string"
              ? firstHuman.content.slice(0, 60) || "未命名对话"
              : "未命名对话",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          messages: thread.messages.map((message) => ({ ...message })),
          activities: activitiesSnapshot,
        };

        setConversationHistory((prev) => {
          const existingIndex = prev.findIndex((item) => item.id === sessionId);
          if (existingIndex >= 0) {
            const next = [...prev];
            next[existingIndex] = {
              ...snapshot,
              createdAt: next[existingIndex].createdAt,
            };
            return next;
          }
          return [snapshot, ...prev];
        });
        setActiveConversationId(sessionId);
      }
      hasFinalizeEventOccurredRef.current = false;
    }
  }, [
    thread.isLoading,
    thread.messages,
    historicalActivities,
    processedEventsTimeline,
  ]);

  useEffect(() => {
    if (
      hasFinalizeEventOccurredRef.current &&
      !thread.isLoading &&
      thread.messages.length > 0
    ) {
      const lastMessage = thread.messages[thread.messages.length - 1];
      if (
        lastMessage &&
        lastMessage.type === "ai" &&
        typeof lastMessage.id === "string"
      ) {
        const messageId = lastMessage.id;
        setHistoricalActivities((prev) => ({
          ...prev,
          [messageId]: [...processedEventsTimeline],
        }));
      }
      setProcessedEventsTimeline([]);
    }
  }, [thread.isLoading, thread.messages, processedEventsTimeline]);

  const handleSubmit = useCallback(
    (submittedInputValue: string, effort: string, model: string) => {
      if (!submittedInputValue.trim()) return;
      setProcessedEventsTimeline([]);
      hasFinalizeEventOccurredRef.current = false;

      if (thread.messages.length === 0) {
        setHistoricalActivities({});
      }

      if (!sessionIdRef.current) {
        sessionIdRef.current = generateSessionId();
        writeActiveSession(sessionIdRef.current);
      }

      setActiveConversationId(sessionIdRef.current);

      let initial_search_query_count = 0;
      let max_research_loops = 0;
      switch (effort) {
        case "low":
          initial_search_query_count = 1;
          max_research_loops = 1;
          break;
        case "medium":
          initial_search_query_count = 3;
          max_research_loops = 3;
          break;
        case "high":
          initial_search_query_count = 5;
          max_research_loops = 10;
          break;
      }

      const newMessages: Message[] = [
        ...(thread.messages || []),
        {
          type: "human",
          content: submittedInputValue,
          id: Date.now().toString(),
        },
      ];

      thread.submit({
        messages: newMessages,
        initial_search_query_count,
        max_research_loops,
        reasoning_model: model,
      });
    },
    [thread]
  );

  const handleCancel = useCallback(() => {
    thread.stop();
    sessionIdRef.current = null;
    writeActiveSession(null);
    setProcessedEventsTimeline([]);
    setHistoricalActivities({});
    setActiveConversationId(null);
  }, [thread]);

  const selectConversation = useCallback((conversationId: string | null) => {
    setActiveConversationId(conversationId);
    if (!conversationId) {
      sessionIdRef.current = null;
      writeActiveSession(null);
    }
  }, []);

  const value = useMemo<ChatContextValue>(
    () => ({
      thread,
      processedEventsTimeline,
      historicalActivities,
      error,
      handleSubmit,
      handleCancel,
      conversationHistory,
      activeConversationId,
      selectConversation,
    }),
    [
      thread,
      processedEventsTimeline,
      historicalActivities,
      error,
      handleSubmit,
      handleCancel,
      conversationHistory,
      activeConversationId,
      selectConversation,
    ]
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChatContext() {
  const ctx = useContext(ChatContext);
  if (!ctx) {
    throw new Error("useChatContext must be used within a ChatProvider");
  }
  return ctx;
}
