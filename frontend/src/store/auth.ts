import { create } from "zustand";
import { setToken as persistToken } from "../lib/apiClient";

export type Role = "USER" | "ADMIN";
export type User = {
  id: string;
  email: string;
  name?: string | null;
  role: Role;
  trustScore?: number;
  suspicionScore?: number;
  flags?: Record<string, unknown>;
};

type State = {
  token: string | null;
  user: User | null;
  setAuth: (token: string, user?: User | null) => void;
  setUser: (user: User | null) => void;
  logout: () => void;
};

export const useAuthStore = create<State>((set) => ({
  token: localStorage.getItem("bty_token"),
  user: null,
  setAuth: (token, user) =>
    set(() => {
      persistToken(token);
      return { token, user: user ?? null };
    }),
  setUser: (user) => set(() => ({ user })),
  logout: () =>
    set(() => {
      persistToken(null);
      return { token: null, user: null };
    })
}));

