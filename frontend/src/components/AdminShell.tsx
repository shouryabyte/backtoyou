import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "./Button";
import { api } from "../lib/apiClient";
import { useAuthStore } from "../store/auth";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";

export default function AdminShell() {
  const nav = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const meQ = useQuery({
    queryKey: ["me"],
    queryFn: () => api<{ user: any }>("/api/auth/me"),
    retry: false
  });

  useEffect(() => {
    if (meQ.data?.user) {
      setUser(meQ.data.user);
      if (meQ.data.user.role !== "ADMIN") nav("/dashboard", { replace: true });
    }
    if (meQ.isError) {
      toast.error("Session expired");
      logout();
      nav("/admin/login");
    }
  }, [meQ.data, meQ.isError, logout, nav, setUser]);

  return (
    <div className="min-h-screen relative">
      <div className="absolute inset-0 -z-10 bty-bg" />
      <header className="sticky top-0 z-10 bg-black/40 backdrop-blur border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/admin" className="font-bold text-zinc-100 tracking-tight">
            BackToYou Admin
          </Link>
          <div className="flex items-center gap-3">
            <nav className="hidden sm:flex gap-4 text-sm text-zinc-300">
              <NavLink className={({ isActive }) => (isActive ? "font-semibold text-white" : "hover:text-white")} to="/admin">
                Review
              </NavLink>
              <NavLink className={({ isActive }) => (isActive ? "font-semibold text-white" : "hover:text-white")} to="/chats">
                Chats
              </NavLink>
            </nav>

            <div className="hidden md:flex items-center gap-2 text-xs text-zinc-300">
              <span className="px-3 py-1 rounded-full border border-white/10 bg-white/5">{user?.email ?? "..."}</span>
            </div>

            <Button
              variant="secondary"
              onClick={() => {
                logout();
                nav("/admin/login");
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
