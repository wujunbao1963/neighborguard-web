// src/App.tsx
import { Routes, Route, Navigate, Link } from "react-router-dom";
import { GuardHomePage } from "./pages/GuardHomePage";
import { CircleDashboardPage } from "./pages/CircleDashboardPage";
import { CircleEventsPage } from "./pages/CircleEventsPage";
import { EventDetailPage } from "./pages/EventDetailPage";
import { NotificationBell } from "./components/NotificationBell";

function App() {
  return (
    <div className="app-root">
      {/* Global Header (shows on every page) */}
      <header className="app-header">
        <Link to="/" className="app-logo">
          NeighborGuard
        </Link>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center" }}>
          <NotificationBell />
        </div>
      </header>

      <main className="app-main">
        <Routes>
          <Route path="/" element={<GuardHomePage />} />
          <Route path="/circles/:circleId" element={<CircleDashboardPage />} />
          <Route path="/circles/:circleId/events" element={<CircleEventsPage />} />
          <Route path="/events/:eventId" element={<EventDetailPage />} />
          {/* 兜底：未知路由跳回首页 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;

