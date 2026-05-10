"use client";

import { ReactNode, useState } from "react";
import Image from "next/image";
import { Menu } from "lucide-react";
import Sidebar from "./Sidebar";

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen relative">
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Backdrop overlay (mobile only, when sidebar is open) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Main Content Area */}
      <main
        className="flex-1 overflow-auto min-w-0"
        style={{ backgroundColor: "#44444E" }}
      >
        {/* Mobile header with hamburger — only visible on mobile */}
        <header
          className="md:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-3 border-b"
          style={{ backgroundColor: "#37353E", borderColor: "#715A5A40" }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2"
            style={{ color: "#D3DAD9" }}
            aria-label="Open menu"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-2">
            <Image src="/Bouldy.svg" alt="Bouldy" width={28} height={28} />
            <span className="font-bold text-lg" style={{ color: "#D3DAD9" }}>Bouldy</span>
          </div>
          <div className="w-10" /> {/* Spacer to balance the header */}
        </header>

        {children}
      </main>
    </div>
  );
}