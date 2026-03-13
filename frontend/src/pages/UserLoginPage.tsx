import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import toast from "react-hot-toast";
import AppShell from "../components/AppShell";
import { Input } from "../components/Input";
import { ErrorAlert } from "../components/ErrorAlert";
import { PrimaryButton } from "../components/PrimaryButton";
import { SecondaryButton } from "../components/SecondaryButton";
import { api, apiErrorMessage } from "../lib/apiClient";
import { useAuthStore } from "../store/auth";

const schema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required")
});
type Form = z.infer<typeof schema>;

export default function UserLoginPage() {
  const nav = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const { register, handleSubmit, formState, setError } = useForm<Form>({ resolver: zodResolver(schema) });

  async function onSubmit(values: Form) {
    try {
      const res = await api<{ token: string; user: any }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(values)
      });
      setAuth(res.token, res.user);
      toast.success("Welcome back");
      nav(res.user?.role === "ADMIN" ? "/admin" : "/dashboard");
    } catch (e) {
      setError("root", { message: apiErrorMessage(e) });
    }
  }

  return (
    <AppShell>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-lg bty-card p-10">
        <div className="flex items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 text-xs px-3 py-1 rounded-full border border-white/10 bg-white/5 text-zinc-300">
            Sign in
          </div>
          <Link to="/" className="shrink-0">
            <SecondaryButton>Home</SecondaryButton>
          </Link>
        </div>

        <h1 className="mt-4 text-3xl font-bold text-zinc-100">Welcome back</h1>
        <p className="mt-2 text-zinc-400">Sign in to continue.</p>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
          <Input label="Email" autoComplete="email" error={formState.errors.email?.message} {...register("email")} />
          <Input
            label="Password"
            type="password"
            autoComplete="current-password"
            error={formState.errors.password?.message}
            {...register("password")}
          />

          {formState.errors.root?.message ? <ErrorAlert message={formState.errors.root.message} /> : null}

          <PrimaryButton full type="submit" disabled={formState.isSubmitting}>
            {formState.isSubmitting ? "Signing in..." : "Sign in ->"}
          </PrimaryButton>
        </form>

        <div className="mt-6 text-sm text-zinc-400 text-center space-y-2">
          <div>
            New here?{" "}
            <Link className="text-pink-300 hover:text-pink-200 font-semibold" to="/register">
              Create account
            </Link>
          </div>
          <div>
            Admin portal?{" "}
            <Link className="text-zinc-200 hover:text-white font-semibold" to="/admin/login">
              Admin sign in
            </Link>
          </div>
        </div>
      </motion.div>
    </AppShell>
  );
}
