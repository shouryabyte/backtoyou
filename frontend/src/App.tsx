import { Routes, Route, Navigate } from "react-router-dom";
import HomePage from "./pages/HomePage";
import UserLoginPage from "./pages/UserLoginPage";
import UserRegisterPage from "./pages/UserRegisterPage";
import AdminLoginPage from "./pages/AdminLoginPage";
import DashboardPage from "./pages/DashboardPage";
import AdminPageNew from "./pages/AdminPageNew";
import MatchesPageNew from "./pages/MatchesPageNew";
import ClaimsPage from "./pages/ClaimsPage";
import { useAuthStore } from "./store/auth";
import DashboardShell from "./components/DashboardShell";
import AdminShell from "./components/AdminShell";
import ReportPage from "./pages/ReportPage";
import MatchDetailPageNew from "./pages/MatchDetailPageNew";
import VerifyPage from "./pages/VerifyPage";
import ChatsPage from "./pages/ChatsPage";
import ChatRoomPage from "./pages/ChatRoomPage";

function RequireAuth({ children }: { children: JSX.Element }) {
  const token = useAuthStore((s) => s.token);
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<UserLoginPage />} />
      <Route path="/register" element={<UserRegisterPage />} />

      <Route path="/admin/login" element={<AdminLoginPage />} />

      <Route
        element={
          <RequireAuth>
            <DashboardShell />
          </RequireAuth>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/report" element={<ReportPage />} />
        <Route path="/matches" element={<MatchesPageNew />} />
        <Route path="/matches/:matchId" element={<MatchDetailPageNew />} />
        <Route path="/verify/:matchId" element={<VerifyPage />} />
        <Route path="/claims" element={<ClaimsPage />} />
        <Route path="/chats" element={<ChatsPage />} />
        <Route path="/chat/:chatRoomId" element={<ChatRoomPage />} />
      </Route>

      <Route
        element={
          <RequireAuth>
            <AdminShell />
          </RequireAuth>
        }
      >
        <Route path="/admin" element={<AdminPageNew />} />
        <Route path="/chats" element={<ChatsPage />} />
        <Route path="/chat/:chatRoomId" element={<ChatRoomPage />} />
      </Route>

      {/* Legacy paths */}
      <Route path="/app" element={<Navigate to="/dashboard" replace />} />
      <Route path="/app/matches" element={<Navigate to="/matches" replace />} />
      <Route path="/app/claims" element={<Navigate to="/claims" replace />} />
      <Route path="/app/admin" element={<Navigate to="/admin" replace />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
