export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen relative">
      <div className="absolute inset-0 -z-10 bty-bg" />
      <main className="flex min-h-screen items-center justify-center px-4 py-12">{children}</main>
    </div>
  );
}
