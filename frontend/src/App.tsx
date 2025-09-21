import { NavLink, Navigate, Route, Routes } from "react-router-dom";

import { ChatPage } from "@/components/ChatPage";
import { KeyStatusPage } from "@/components/KeyStatusPage";
import { ChatProvider } from "@/contexts/ChatContext";

function navLinkClasses(isActive: boolean) {
  return `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    isActive
      ? "bg-white/10 text-white shadow-sm"
      : "text-neutral-300 hover:text-white hover:bg-white/5"
  }`;
}

export default function App() {
  return (
    <ChatProvider>
      <div className="min-h-screen bg-neutral-900 text-neutral-100">
        <header className="border-b border-white/10 bg-neutral-900/80 backdrop-blur">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
            <span className="text-lg font-semibold tracking-tight">
              DeepResearch Agent
            </span>
            <nav className="flex items-center gap-2">
              <NavLink to="/" end className={({ isActive }) => navLinkClasses(isActive)}>
                Research
              </NavLink>
              <NavLink
                to="/keys"
                className={({ isActive }) => navLinkClasses(isActive)}
              >
                Gemini Keys
              </NavLink>
            </nav>
          </div>
        </header>
        <main className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-6xl flex-1 px-6 py-6">
          <Routes>
            <Route path="/" element={<ChatPage />} />
            <Route path="/keys" element={<KeyStatusPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </ChatProvider>
  );
}
