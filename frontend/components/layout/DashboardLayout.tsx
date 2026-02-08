"use client";

import { ReactNode } from "react";
import Sidebar from "./Sidebar";

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="flex min-h-screen">
      {/* Sidebar - Fixed on left */}
      <Sidebar />
      
      {/* Main Content Area */}
      <main 
        className="flex-1 overflow-auto"
        style={{ backgroundColor: '#44444E' }} // Dark mode background
      >
        {children}
      </main>
    </div>
  );
}