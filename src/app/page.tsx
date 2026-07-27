"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import Image from "next/image";
import { createClient } from "@supabase/supabase-js";
import type { ConversationWithLastMessage, Message } from "@/lib/types";

export default function Dashboard() {
  const supabase = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    return createClient(url, key);
  }, []);

  const [conversations, setConversations] = useState<ConversationWithLastMessage[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const selected = conversations.find((c) => c.id === selectedId);

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/conversations");
      let data: unknown;
      try {
        data = await res.json();
      } catch {
        const text = await res.text();
        setError(`API returned ${res.status}: ${text.slice(0, 200)}`);
        return;
      }
      if (!res.ok || !Array.isArray(data)) {
        setError(`API error: ${(data as Record<string, unknown>)?.error || res.statusText}`);
        return;
      }
      setError(null);
      setConversations(data);
    } catch (e: unknown) {
      setError(`Network error: ${(e as Error).message}`);
    }
  }, []);

  const fetchMessages = useCallback(async (convoId: string) => {
    try {
      const res = await fetch(`/api/conversations/${convoId}/messages`);
      const data = await res.json();
      if (!res.ok || !Array.isArray(data)) return;
      setMessages(data);
    } catch {
      // Silently fail
    }
  }, []);

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/conversations/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        setError(`Delete failed: ${data.error || res.statusText}`);
        return;
      }
      if (selectedId === id) {
        setSelectedId(null);
        setMessages([]);
      }
      setConversations((prev) => prev.filter((c) => c.id !== id));
    } catch (e: unknown) {
      setError(`Delete error: ${(e as Error).message}`);
    }
  }

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    if (selectedId) fetchMessages(selectedId);
  }, [selectedId, fetchMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel("realtime-instagram-messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "instagram_messages" },
        (payload) => {
          const newMsg = payload.new as Message;
          if (newMsg.conversation_id === selectedId) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
          }
          fetchConversations();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "instagram_conversations" },
        () => fetchConversations()
      )
      .subscribe();

    return () => {
      supabase?.removeChannel(channel);
    };
  }, [selectedId, fetchConversations, supabase]);

  async function toggleMode() {
    if (!selected) return;
    const newMode = selected.mode === "agent" ? "human" : "agent";
    await fetch(`/api/conversations/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: newMode }),
    });
    setConversations((prev) =>
      prev.map((c) => (c.id === selected.id ? { ...c, mode: newMode } : c))
    );
  }

  async function handleSend() {
    if (!input.trim() || !selectedId || sending) return;
    setSending(true);
    await fetch(`/api/conversations/${selectedId}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: input.trim() }),
    });
    setInput("");
    setSending(false);
    fetchMessages(selectedId);
  }

  function formatTime(dateStr: string) {
    return new Date(dateStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function getInitials(name: string | null, igsid: string) {
    if (name) return name.slice(0, 2).toUpperCase();
    return igsid.slice(-2);
  }

  function Avatar({ src, name, igsid, size }: { src: string | null; name: string | null; igsid: string; size: number }) {
    const cls = `rounded-full flex items-center justify-center flex-shrink-0 text-white font-semibold overflow-hidden`;
    const style = { width: size, height: size, minWidth: size, fontSize: size * 0.3 };
    if (src) {
      return (
        <div className={cls} style={style}>
          <Image src={src} alt={name || igsid} width={size} height={size} className="w-full h-full object-cover rounded-full" unoptimized />
        </div>
      );
    }
    return (
      <div className={cls} style={{ ...style, background: "linear-gradient(135deg, #d97706, #ea580c)" }}>
        {getInitials(name, igsid)}
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#08080a] font-sans flex justify-center">
      <div className="flex w-full max-w-[1400px]">
        {/* Sidebar — full width on mobile, fixed 320px on desktop */}
      <div className={`w-full md:w-[320px] flex flex-col border-r border-white/[0.04] ${selectedId ? "max-md:hidden" : ""}`} style={{ background: "#0d0d10" }}>
        {/* Sidebar Header */}
        <div className="px-5 py-4 border-b border-white/[0.05]">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #d97706, #ea580c)" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-sm font-semibold text-white/95 leading-tight">Instagram AI Agent</h1>
              <p className="text-xs text-white/45 leading-tight mt-0.5">
                {conversations.length} conversation{conversations.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="px-4 py-2.5 bg-red-500/8 border-b border-red-500/15">
            <p className="text-[11px] text-red-400/90 leading-tight">{error}</p>
          </div>
        )}

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 && (
            <div className="flex flex-col items-center justify-center h-56 gap-3">
              <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-white/40">No conversations yet</p>
                <p className="text-xs text-white/25 mt-1">Messages will appear here</p>
              </div>
            </div>
          )}
          {conversations.map((convo) => {
            const isSelected = selectedId === convo.id;
            return (
              <button
                key={convo.id}
                onClick={() => setSelectedId(convo.id)}
                className={`w-full text-left px-4 py-3 transition-all duration-150 relative group ${
                  isSelected ? "bg-amber-500/[0.05]" : "hover:bg-white/[0.025]"
                }`}
              >
                {isSelected && (
                  <div
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-7 rounded-r"
                    style={{ background: "linear-gradient(to bottom, #d97706, #ea580c)" }}
                  />
                )}
                <div className="flex items-center gap-3">
                  <Avatar src={convo.profile_pic} name={convo.name} igsid={convo.igsid} size={40} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-white/93 truncate">
                        {convo.name || convo.username || convo.igsid}
                      </span>
                      <span className="text-[10px] text-white/35 flex-shrink-0">
                        {formatTime(convo.updated_at)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <p className="text-xs text-white/35 truncate">
                        {convo.username ? `@${convo.username}` : convo.last_message || ""}
                      </p>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 uppercase tracking-wider ${
                            convo.mode === "agent"
                              ? "bg-amber-500/15 text-amber-300"
                              : "bg-emerald-500/15 text-emerald-300"
                          }`}
                        >
                          {convo.mode === "agent" ? "AI" : "You"}
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(convo.id); }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity w-5 h-5 rounded flex items-center justify-center hover:bg-red-500/20 flex-shrink-0"
                          aria-label="Delete conversation"
                          title="Delete from dashboard"
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Chat Panel — hidden on mobile when no selection, full-screen when selected */}
      <div className={`flex-1 flex flex-col min-w-0 ${!selectedId ? "max-md:hidden" : ""}`}>
        {!selected ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/[0.03] flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-white/40">Select a conversation</p>
              <p className="text-xs text-white/20 mt-1">Choose a conversation from the sidebar</p>
            </div>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="px-5 md:px-7 py-4 border-b border-white/[0.05] flex items-center justify-between" style={{ background: "#0d0d10" }}>
              <div className="flex items-center gap-4">
                <button onClick={() => setSelectedId(null)} className="md:hidden p-1 -ml-1 rounded-lg hover:bg-white/[0.06] transition-colors" aria-label="Back to conversations">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 12H5M12 19l-7-7 7-7" />
                  </svg>
                </button>
                <Avatar src={selected.profile_pic} name={selected.name} igsid={selected.igsid} size={44} />
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-white/95 leading-tight">
                      {selected.name || selected.username || selected.igsid}
                    </h2>
                    {selected.username && (
                      <span className="text-xs text-white/35">@{selected.username}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    {selected.follower_count !== null && (
                      <span className="text-[11px] text-white/40">
                        <span className="text-white/60 font-medium">{selected.follower_count.toLocaleString()}</span> followers
                      </span>
                    )}
                    {selected.is_user_follow_business !== null && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${selected.is_user_follow_business ? "bg-amber-500/15 text-amber-300" : "bg-white/5 text-white/35"}`}>
                        {selected.is_user_follow_business ? "Follows you" : "Doesn't follow"}
                      </span>
                    )}
                    {selected.is_business_follow_user !== null && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${selected.is_business_follow_user ? "bg-emerald-500/15 text-emerald-300" : "bg-white/5 text-white/35"}`}>
                        {selected.is_business_follow_user ? "You follow" : "You don't follow"}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={toggleMode}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                  selected.mode === "agent"
                    ? "bg-amber-500/12 text-amber-300 hover:bg-amber-500/20 border border-amber-500/15"
                    : "bg-emerald-500/12 text-emerald-300 hover:bg-emerald-500/20 border border-emerald-500/15"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${selected.mode === "agent" ? "bg-amber-400" : "bg-emerald-400"}`} />
                {selected.mode === "agent" ? "AI Mode" : "Human Mode"}
              </button>
            </div>

            {/* Messages */}
            <div
              className="flex-1 overflow-y-auto px-5 md:px-7 py-6 space-y-4"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 20% 80%, rgba(217,119,6,0.03) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(234,88,12,0.02) 0%, transparent 50%)",
              }}
            >
              {messages.map((msg, i) => {
                const isUser = msg.role === "user";
                const showTime = i === messages.length - 1 || messages[i + 1]?.role !== msg.role;
                return (
                  <div key={msg.id} className={`flex items-end gap-2 ${isUser ? "justify-start" : "justify-end"}`}>
                    {isUser && (
                      <Avatar src={selected.profile_pic} name={selected.name} igsid={selected.igsid} size={26} />
                    )}
                    <div className={`flex flex-col ${isUser ? "items-start" : "items-end"} max-w-[68%]`}>
                      <div
                        className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                          isUser
                            ? "bg-white/[0.06] text-white/93 rounded-tl-sm border border-white/[0.05]"
                            : "text-white/95 rounded-tr-sm"
                        }`}
                        style={!isUser ? { background: "linear-gradient(135deg, #d97706, #ea580c)" } : {}}
                      >
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      </div>
                      {showTime && (
                        <p className="text-[10px] text-white/25 mt-1.5 px-1">
                          {!isUser && <span className="text-amber-300/50 mr-1">AI ·</span>}
                          {formatTime(msg.created_at)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <div className="px-5 md:px-7 py-4 border-t border-white/[0.05]" style={{ background: "#0d0d10" }}>
              <div className="flex items-center gap-3 bg-white/[0.05] rounded-xl px-4 py-2.5 border border-white/[0.06] focus-within:border-amber-500/30 transition-colors">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                  placeholder="Type a message..."
                  className="flex-1 bg-transparent text-sm text-white/93 placeholder:text-white/25 focus:outline-none"
                />
                <button
                  onClick={handleSend}
                  disabled={sending || !input.trim()}
                  className="w-8 h-8 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150 flex items-center justify-center flex-shrink-0"
                  style={{ background: "linear-gradient(135deg, #d97706, #ea580c)" }}
                  aria-label="Send"
                >
                  {sending ? (
                    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13" />
                      <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </>
        )}
        </div>
      </div>
    </div>
  );
}
