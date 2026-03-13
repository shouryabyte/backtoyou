import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../lib/apiClient";
import { Card } from "../components/Card";
import { Badge } from "../components/Badge";

export default function ChatsPage() {
  const q = useQuery({
    queryKey: ["chatRooms", "mine"],
    queryFn: () => api<any>("/api/chat/mine")
  });

  const rooms = q.data?.chatRooms ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-zinc-100">Chats</h1>
        <p className="mt-2 text-zinc-400">Chats open only after admin approval.</p>
      </div>

      <Card>
        {q.isLoading ? <div className="text-zinc-400">Loading...</div> : null}
        {rooms.length ? (
          <div className="grid gap-3">
            {rooms.map((r: any) => (
              <Link
                key={r.id}
                to={`/chat/${r.id}`}
                className="rounded-2xl border border-white/10 bg-white/5 p-4 hover:bg-white/10 transition"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-zinc-100">Chat room</div>
                    <div className="text-xs text-zinc-400 mt-1">match: {String(r.matchId).slice(0, 8)}…</div>
                  </div>
                  <Badge tone="neutral">Open</Badge>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-zinc-400">No chats yet.</div>
        )}
      </Card>
    </div>
  );
}

