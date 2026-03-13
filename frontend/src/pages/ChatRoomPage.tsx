import { useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "../lib/apiClient";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { useAuthStore } from "../store/auth";

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString();
}

export default function ChatRoomPage() {
  const { chatRoomId } = useParams();
  const me = useAuthStore((s) => s.user);
  const [content, setContent] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const q = useQuery({
    queryKey: ["chatRoom", chatRoomId],
    enabled: Boolean(chatRoomId),
    queryFn: () => api<any>(`/api/chat/${chatRoomId}`),
    refetchInterval: 2500
  });

  const messages = q.data?.messages ?? [];
  const canSend = useMemo(() => {
    const room = q.data?.chatRoom;
    if (!room || !me) return false;
    return me.id === room.lostUserId || me.id === room.foundUserId;
  }, [q.data, me]);

  const sendM = useMutation({
    mutationFn: async () => {
      const text = content.trim();
      if (!text) return;
      await api(`/api/chat/${chatRoomId}/message`, {
        method: "POST",
        body: JSON.stringify({ content: text })
      });
      setContent("");
      await q.refetch();
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-zinc-100">Chat</h1>
        <p className="mt-2 text-zinc-400">Available only after admin approval. Admin can view for moderation.</p>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="h-[55vh] overflow-auto p-5 space-y-3">
          {q.isLoading ? <div className="text-zinc-400">Loading...</div> : null}
          {messages.length ? (
            messages.map((m: any) => {
              const mine = me?.id && String(m.senderId) === String(me.id);
              return (
                <div key={m.id} className={mine ? "flex justify-end" : "flex justify-start"}>
                  <div
                    className={[
                      "max-w-[85%] rounded-2xl px-4 py-3 border",
                      mine
                        ? "bg-gradient-to-r from-fuchsia-500/20 via-pink-500/15 to-indigo-500/20 border-white/10 text-zinc-100"
                        : "bg-white/5 border-white/10 text-zinc-100"
                    ].join(" ")}
                  >
                    <div className="text-sm whitespace-pre-wrap break-words">{m.content}</div>
                    <div className="text-[11px] text-zinc-400 mt-2">{formatTime(m.timestamp)}</div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-zinc-400">No messages yet.</div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="border-t border-white/10 p-4 bg-black/30">
          <div className="flex items-end gap-2">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={canSend ? "Write a message..." : "Only participants can send messages."}
              disabled={!canSend || sendM.isPending}
              className="min-h-[44px] max-h-[140px] flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-zinc-100 shadow-sm focus:outline-none focus:ring-4 focus:ring-pink-500/15 focus:border-pink-400/40 disabled:opacity-50"
            />
            <Button
              variant="primary"
              disabled={!canSend || sendM.isPending || !content.trim()}
              onClick={() => sendM.mutate()}
            >
              Send
            </Button>
          </div>
          {sendM.isError ? <div className="text-sm text-red-200 mt-2">Failed to send message.</div> : null}
        </div>
      </Card>
    </div>
  );
}

