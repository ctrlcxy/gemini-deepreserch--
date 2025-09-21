import { useEffect, useMemo, useRef } from "react";

import { WelcomeScreen } from "@/components/WelcomeScreen";
import { ChatMessagesView } from "@/components/ChatMessagesView";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useChatContext } from "@/contexts/ChatContext";

export function ChatPage() {
  const {
    thread,
    processedEventsTimeline,
    historicalActivities,
    error,
    handleSubmit,
    handleCancel,
    startNewConversation,
    liveMessages,
    conversationHistory,
    activeConversationId,
    selectConversation,
  } = useChatContext();

  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const viewingHistoryConversation = useMemo(() => {
    if (thread.isLoading || liveMessages.length > 0) {
      return null;
    }
    if (!activeConversationId) {
      return null;
    }
    return (
      conversationHistory.find(
        (conversation) => conversation.id === activeConversationId
      ) || null
    );
  }, [thread.isLoading, liveMessages, activeConversationId, conversationHistory]);

  const messagesToRender = viewingHistoryConversation
    ? viewingHistoryConversation.messages
    : liveMessages;

  const historicalActivityMap = viewingHistoryConversation
    ? viewingHistoryConversation.activities
    : historicalActivities;

  const liveEvents =
    viewingHistoryConversation || liveMessages.length === 0
      ? []
      : processedEventsTimeline;
  const isLoading = viewingHistoryConversation ? false : thread.isLoading;

  useEffect(() => {
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector(
        "[data-radix-scroll-area-viewport]"
      );
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [messagesToRender]);

  const handleStartNewConversation = () => {
    selectConversation(null);
    startNewConversation();
  };

  const formatUpdatedTime = (iso: string) => {
    const deltaMs = Date.now() - new Date(iso).getTime();
    const seconds = Math.floor(deltaMs / 1000);
    if (seconds < 60) return "刚刚";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} 分钟前`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} 小时前`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} 天前`;
    const weeks = Math.floor(days / 7);
    if (weeks < 5) return `${weeks} 周前`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months} 个月前`;
    const years = Math.floor(days / 365);
    return `${years} 年前`;
  };

  const hasAnyConversation =
    liveMessages.length > 0 || conversationHistory.length > 0;

  return (
    <div className="flex h-full w-full gap-6">
      <aside className="hidden w-72 shrink-0 flex-col rounded-xl border border-white/10 bg-neutral-900/60 p-4 md:flex">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-neutral-200">
            历史对话
          </h2>
          {conversationHistory.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              className="text-xs text-neutral-400 hover:text-white"
              onClick={() => selectConversation(null)}
            >
              清除选择
            </Button>
          )}
        </div>
        <Button
          className="mt-3 w-full justify-start bg-blue-500/10 text-blue-200 hover:bg-blue-500/20"
          variant="secondary"
          onClick={handleStartNewConversation}
        >
          新建对话
        </Button>
        <ScrollArea className="mt-4 flex-1">
          <div className="space-y-2">
            {conversationHistory.length === 0 && (
              <p className="text-sm text-neutral-500">
                暂无历史对话，先发起一次提问吧。
              </p>
            )}
            {conversationHistory.map((conversation) => {
              const isActive = conversation.id === activeConversationId;
              return (
                <button
                  key={conversation.id}
                  onClick={() => selectConversation(conversation.id)}
                  className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                    isActive
                      ? "border-blue-400 bg-blue-500/10 text-blue-100"
                      : "border-white/10 bg-neutral-900/40 text-neutral-200 hover:border-white/20 hover:bg-neutral-800/60"
                  }`}
                >
                  <div className="truncate text-sm font-medium">
                    {conversation.title || "未命名对话"}
                  </div>
                  <div className="mt-1 text-xs text-neutral-400">
                    {formatUpdatedTime(conversation.updatedAt)}
                  </div>
                  <div className="mt-1 text-xs text-neutral-500">
                    {conversation.messages.filter((msg) => msg.type === "human").length}
                    次提问 · {conversation.messages.length} 条消息
                  </div>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </aside>

      <div className="flex flex-1 flex-col">
        {messagesToRender.length === 0 && !isLoading && !viewingHistoryConversation ? (
          <WelcomeScreen
            handleSubmit={handleSubmit}
            isLoading={isLoading}
            onCancel={handleCancel}
          />
        ) : error ? (
          <div className="flex flex-1 flex-col items-center justify-center">
            <div className="flex flex-col items-center justify-center gap-4">
              <h1 className="text-2xl font-bold text-red-400">Error</h1>
              <p className="text-red-400">{JSON.stringify(error)}</p>

              <Button variant="destructive" onClick={handleStartNewConversation}>
                重试
              </Button>
            </div>
          </div>
        ) : (
          <ChatMessagesView
            messages={messagesToRender}
            isLoading={isLoading}
            scrollAreaRef={scrollAreaRef}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            liveActivityEvents={liveEvents}
            historicalActivities={historicalActivityMap}
            isHistoryView={Boolean(viewingHistoryConversation)}
            onStartNewConversation={handleStartNewConversation}
          />
        )}

        {!hasAnyConversation && viewingHistoryConversation && (
          <div className="mt-6 text-center text-sm text-neutral-500">
            当前显示的是历史记录，如需继续交流，请选择“新建对话”。
          </div>
        )}
      </div>
    </div>
  );
}
