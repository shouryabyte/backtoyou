import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import AppShell from "../components/AppShell";
import { Card } from "../components/Card";
import { PrimaryButton } from "../components/PrimaryButton";
import { SecondaryButton } from "../components/SecondaryButton";
import { CheckCircle2, ShieldCheck, Sparkles, UserCheck } from "lucide-react";

function FeatureGrid() {
  const items = [
    { icon: Sparkles, title: "Explainable ML", desc: "TF-IDF + cosine + rules with a transparent breakdown." },
    { icon: UserCheck, title: "Ownership verification", desc: "Private K-out-of-N questions to block false claims." },
    { icon: ShieldCheck, title: "Admin approval", desc: "Human-in-the-loop returns. No auto-return ever." }
  ];

  return (
    <div className="grid gap-4">
      {items.map((it) => (
        <Card key={it.title} className="rounded-3xl">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-fuchsia-500 via-pink-500 to-indigo-500 text-white flex items-center justify-center shadow-xl shadow-pink-500/20">
              <it.icon className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-zinc-100">{it.title}</div>
              <div className="text-zinc-400 mt-1">{it.desc}</div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

export default function HomePage() {
  return (
    <AppShell>
      <div className="max-w-6xl w-full">
        <header className="w-full flex items-center justify-between gap-3 mb-10">
          <Link to="/" className="font-bold text-zinc-100 tracking-tight text-lg">
            BackToYou
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/login">
              <SecondaryButton>Sign in</SecondaryButton>
            </Link>
            <Link to="/register">
              <PrimaryButton>Get started</PrimaryButton>
            </Link>
            <Link to="/admin/login" className="hidden sm:inline-flex">
              <SecondaryButton>Admin</SecondaryButton>
            </Link>
          </div>
        </header>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h1 className="text-5xl font-bold leading-tight text-zinc-100">
              Lost something on campus?
              <span className="block bg-gradient-to-r from-fuchsia-400 via-pink-400 to-indigo-400 bg-clip-text text-transparent">
                Get it back. Safely.
              </span>
            </h1>

            <p className="mt-6 text-lg text-zinc-300">
              BackToYou suggests candidates using explainable ML, verifies ownership, and requires admin approval.
            </p>

            <ul className="mt-6 space-y-2 text-zinc-300">
              {["Matching suggests (never decides)", "Private verification blocks false claims", "Admin approves every return"].map((t) => (
                <li key={t} className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 mt-0.5 text-pink-400" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>

            <div className="mt-8 flex flex-wrap gap-4">
              <Link to="/register">
                <PrimaryButton>Report your first item</PrimaryButton>
              </Link>
              <a href="#how-it-works">
                <SecondaryButton>How it works</SecondaryButton>
              </a>
              <Link to="/admin/login" className="sm:hidden">
                <SecondaryButton>Admin</SecondaryButton>
              </Link>
            </div>

            <div className="mt-10 grid sm:grid-cols-2 gap-4">
              <Card className="rounded-3xl">
                <div className="text-xs text-zinc-400">For students</div>
                <div className="mt-2 font-bold text-zinc-100">Report lost/found</div>
                <div className="mt-1 text-zinc-400">Track matches, submit verified claims, and stay safe.</div>
                <div className="mt-4">
                  <Link to="/register" className="inline-flex">
                    <SecondaryButton>Create account</SecondaryButton>
                  </Link>
                </div>
              </Card>
              <Card className="rounded-3xl">
                <div className="text-xs text-zinc-400">For admin desk</div>
                <div className="mt-2 font-bold text-zinc-100">Review + approve</div>
                <div className="mt-1 text-zinc-400">See score breakdowns and verification before deciding.</div>
                <div className="mt-4">
                  <Link to="/admin/login" className="inline-flex">
                    <SecondaryButton>Admin sign in</SecondaryButton>
                  </Link>
                </div>
              </Card>
            </div>
          </div>

          <div id="how-it-works">
            <FeatureGrid />
          </div>
        </motion.div>
      </div>
    </AppShell>
  );
}
