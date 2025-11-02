"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@heroui/react";

const navigation = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: "🏠",
  },
  {
    name: "Create Chatbot",
    href: "/create",
    icon: "➕",
  },
  {
    name: "My Chatbots",
    href: "/chatbots",
    icon: "🤖",
  },
  {
    name: "Settings",
    href: "/settings",
    icon: "⚙️",
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside 
      className="w-64 min-h-screen flex flex-col"
      style={{ backgroundColor: '#37353E' }}
    >
      {/* Logo/Brand */}
      <div className="p-6 border-b" style={{ borderColor: '#715A5A40' }}>
        <Link href="/dashboard">
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: '#715A5A' }}>
            <span className="text-3xl">🪨</span>
            <span>Bouldy</span>
          </h1>
        </Link>
        <p className="text-xs mt-1" style={{ color: '#D3DAD9', opacity: 0.6 }}>
          AI Chatbot Platform
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            
            return (
              <li key={item.name}>
                <Link href={item.href}>
                  <div
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all cursor-pointer"
                    style={{
                      backgroundColor: isActive ? '#715A5A' : 'transparent',
                      color: '#D3DAD9',
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.backgroundColor = '#715A5A80';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    <span className="text-xl">{item.icon}</span>
                    <span className="font-medium">{item.name}</span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Bottom Section */}
      <div className="p-4 border-t" style={{ borderColor: '#715A5A40' }}>
        <div className="flex items-center gap-3 px-4 py-3">
          <div 
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ backgroundColor: '#715A5A' }}
          >
            <span className="text-lg">👤</span>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium" style={{ color: '#D3DAD9' }}>
              User Name
            </p>
            <p className="text-xs" style={{ color: '#D3DAD9', opacity: 0.6 }}>
              user@email.com
            </p>
          </div>
        </div>
        
        <Button
          className="w-full mt-2"
          variant="light"
          style={{ color: '#D3DAD9' }}
        >
          🚪 Logout
        </Button>
      </div>
    </aside>
  );
}