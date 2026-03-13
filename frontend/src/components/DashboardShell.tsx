import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "./Button";
import { api } from "../lib/apiClient";
import { useAuthStore } from "../store/auth";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";

export default function DashboardShell() {
  const nav = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const meQ = useQuery({
    queryKey: ["me"],
    queryFn: () => api<{ user: any }>("/api/auth/me"),
    retry: false
  });

  const chatRoomsQ = useQuery({
    queryKey: ["chatRooms", "mine"],
    enabled: Boolean(user?.id) && user?.role !== "ADMIN",
    queryFn: () => api<any>("/api/chat/mine"),
    refetchInterval: 5000,
    retry: false
  });

  useEffect(() => {
    if (meQ.data?.user) {
      setUser(meQ.data.user);
      if (meQ.data.user.role === "ADMIN") nav("/admin", { replace: true });
    }
    if (meQ.isError) {
      toast.error("Session expired");
      logout();
      nav("/login");
    }
  }, [meQ.data, meQ.isError, logout, nav, setUser]);

  useEffect(() => {
    if (!user?.id || user.role === "ADMIN") return;
    const rooms = chatRoomsQ.data?.chatRooms ?? [];
    for (const r of rooms) {
      const roomId = String(r.id);
      const key = `bty_chat_room_seen_${roomId}`;
      if (localStorage.getItem(key)) continue;

      const isLost = String(r.lostUserId) === String(user.id);
      const isFound = String(r.foundUserId) === String(user.id);
      const title = r.match?.foundItemTitle ?? r.match?.lostItemTitle ?? "your item";

      if (isLost) toast.success(`Approved: chat is ready to coordinate pickup for "${title}".`);
      else if (isFound) toast.success(`A claim was approved for "${title}". Chat is ready.`);
      else toast.success("A new chat room is available.");

      localStorage.setItem(key, "1");
    }
  }, [chatRoomsQ.data, user]);

  return (
    <div className="min-h-screen relative">
      <div className="absolute inset-0 -z-10 bty-bg" />
      <header className="sticky top-0 z-10 bg-black/40 backdrop-blur border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/dashboard" className="font-bold text-zinc-100 tracking-tight">
            BackToYou
          </Link>
          <div className="flex items-center gap-3">
            <nav className="hidden sm:flex gap-4 text-sm text-zinc-300">
              {user?.role === "ADMIN" ? (
                <NavLink className={({ isActive }) => (isActive ? "font-semibold text-white" : "hover:text-white")} to="/admin">
                  Admin
                </NavLink>
              ) : (
                <>
                  <NavLink className={({ isActive }) => (isActive ? "font-semibold text-white" : "hover:text-white")} to="/dashboard">
                    Dashboard
                  </NavLink>
                  <NavLink className={({ isActive }) => (isActive ? "font-semibold text-white" : "hover:text-white")} to="/report">
                    Report
                  </NavLink>
                  <NavLink className={({ isActive }) => (isActive ? "font-semibold text-white" : "hover:text-white")} to="/matches">
                    Matches
                  </NavLink>
                  <NavLink className={({ isActive }) => (isActive ? "font-semibold text-white" : "hover:text-white")} to="/claims">
                    Claims
                  </NavLink>
                  <NavLink className={({ isActive }) => (isActive ? "font-semibold text-white" : "hover:text-white")} to="/chats">
                    Chats
                  </NavLink>
                </>
              )}
            </nav>

            <div className="hidden md:flex items-center gap-2 text-xs text-zinc-300">
              <span className="px-3 py-1 rounded-full border border-white/10 bg-white/5">
                {user?.email ?? "..."}
              </span>
            </div>

            <Button
              variant="secondary"
              onClick={() => {
                logout();
                nav("/login");
              }}
            >
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
