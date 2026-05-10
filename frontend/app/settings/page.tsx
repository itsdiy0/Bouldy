"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { User, Shield, Palette, AlertTriangle, LogOut, ExternalLink } from "lucide-react";

export default function SettingsPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<"profile" | "appearance" | "danger">("profile");
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const tabs = [
    { id: "profile" as const, label: "Profile", icon: User },
    { id: "appearance" as const, label: "Appearance", icon: Palette },
    { id: "danger" as const, label: "Danger Zone", icon: AlertTriangle },
  ];

  return (
    <DashboardLayout>
      <div className="h-full flex items-start justify-center p-4 sm:p-6 md:p-8 pt-6 md:pt-12">
        <div className="w-full max-w-4xl">
          <div className="mb-5 sm:mb-6">
            <h1 className="text-lg sm:text-xl font-bold" style={{ color: "#D3DAD9" }}>Settings</h1>
            <p className="text-xs mt-1" style={{ color: "#D3DAD9", opacity: 0.4 }}>
              Manage your account and preferences
            </p>
          </div>

          <div
            className="rounded-xl overflow-hidden"
            style={{ backgroundColor: "#2D2B33", border: "1px solid #715A5A40" }}
          >
            <div className="flex overflow-x-auto" style={{ borderBottom: "1px solid #715A5A30" }}>
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="flex items-center justify-center gap-2 flex-1 min-w-[110px] py-3 sm:py-3.5 text-sm font-medium transition-all relative cursor-pointer hover:opacity-80 px-3 whitespace-nowrap"
                  style={{
                    color: tab.id === "danger" && activeTab === tab.id ? "#ef4444" : "#D3DAD9",
                    opacity: activeTab === tab.id ? 1 : 0.4,
                  }}
                >
                  <tab.icon className="w-4 h-4 flex-shrink-0" />
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">{tab.label === "Danger Zone" ? "Danger" : tab.label}</span>
                  {activeTab === tab.id && (
                    <div
                      className="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 w-12 rounded-full"
                      style={{ backgroundColor: tab.id === "danger" ? "#ef4444" : "#715A5A" }}
                    />
                  )}
                </button>
              ))}
            </div>

            <div className="p-4 sm:p-6">
              {activeTab === "profile" && (
                <div className="space-y-5">
                  <div
                    className="flex items-center gap-4 px-4 sm:px-5 py-4 sm:py-5 rounded-lg"
                    style={{ backgroundColor: "#37353E", border: "1px solid #715A5A" }}
                  >
                    <div
                      className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: "#715A5A30" }}
                    >
                      <User className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: "#715A5A" }} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm sm:text-base font-semibold truncate" style={{ color: "#D3DAD9" }}>
                        {session?.user?.name || "User"}
                      </p>
                      <p className="text-xs truncate" style={{ color: "#D3DAD9", opacity: 0.4 }}>
                        {session?.user?.email || "—"}
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm mb-2" style={{ color: "#D3DAD9", opacity: 0.7 }}>Name</label>
                    <input
                      type="text"
                      defaultValue={session?.user?.name || ""}
                      className="w-full px-4 py-3 rounded-lg outline-none text-sm"
                      style={{ backgroundColor: "#37353E", color: "#D3DAD9", border: "1px solid #715A5A" }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm mb-2" style={{ color: "#D3DAD9", opacity: 0.7 }}>Email</label>
                    <input
                      type="email"
                      defaultValue={session?.user?.email || ""}
                      disabled
                      className="w-full px-4 py-3 rounded-lg outline-none text-sm opacity-50"
                      style={{ backgroundColor: "#37353E", color: "#D3DAD9", border: "1px solid #715A5A" }}
                    />
                    <p className="text-[11px] mt-1" style={{ color: "#D3DAD9", opacity: 0.3 }}>
                      Email cannot be changed
                    </p>
                  </div>

                  <div
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 sm:px-5 py-4 rounded-lg"
                    style={{ backgroundColor: "#37353E", border: "1px solid #715A5A" }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Shield className="w-4 h-4 flex-shrink-0" style={{ color: "#D3DAD9", opacity: 0.5 }} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium" style={{ color: "#D3DAD9" }}>Password</p>
                        <p className="text-xs" style={{ color: "#D3DAD9", opacity: 0.4 }}>
                          Change your account password
                        </p>
                      </div>
                    </div>
                    <button
                      className="w-full sm:w-auto px-3 py-1.5 rounded-lg text-xs cursor-pointer transition-all hover:brightness-110 whitespace-nowrap"
                      style={{ backgroundColor: "#715A5A40", color: "#D3DAD9" }}
                    >
                      Change Password
                    </button>
                  </div>
                </div>
              )}

              {activeTab === "appearance" && (
                <div className="space-y-5">
                  <div
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 sm:px-5 py-4 rounded-lg"
                    style={{ backgroundColor: "#37353E", border: "1px solid #715A5A" }}
                  >
                    <div>
                      <p className="text-sm font-medium" style={{ color: "#D3DAD9" }}>Theme</p>
                      <p className="text-xs mt-0.5" style={{ color: "#D3DAD9", opacity: 0.4 }}>
                        Choose your preferred appearance
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        className="flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs cursor-pointer"
                        style={{ backgroundColor: "#715A5A", color: "#D3DAD9" }}
                      >
                        Dark
                      </button>
                      <button
                        className="flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs cursor-pointer"
                        style={{ backgroundColor: "#37353E", color: "#D3DAD9", opacity: 0.4 }}
                      >
                        Light
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-center py-6" style={{ color: "#D3DAD9", opacity: 0.2 }}>
                    More appearance options coming soon
                  </p>
                </div>
              )}

              {activeTab === "danger" && (
                <div className="space-y-4">
                  <div
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 sm:px-5 py-4 rounded-lg"
                    style={{ backgroundColor: "#37353E", border: "1px solid #ef444440" }}
                  >
                    <div>
                      <p className="text-sm font-medium" style={{ color: "#D3DAD9" }}>Sign Out</p>
                      <p className="text-xs mt-0.5" style={{ color: "#D3DAD9", opacity: 0.4 }}>
                        Sign out of your account on this device
                      </p>
                    </div>
                    <button
                      onClick={() => signOut({ callbackUrl: "/login" })}
                      className="w-full sm:w-auto flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-xs cursor-pointer transition-all hover:brightness-110 whitespace-nowrap"
                      style={{ backgroundColor: "#715A5A", color: "#D3DAD9" }}
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Sign Out
                    </button>
                  </div>

                  <div
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 sm:px-5 py-4 rounded-lg"
                    style={{ backgroundColor: "#37353E", border: "1px solid #ef444440" }}
                  >
                    <div>
                      <p className="text-sm font-medium" style={{ color: "#ef4444" }}>Delete Account</p>
                      <p className="text-xs mt-0.5" style={{ color: "#D3DAD9", opacity: 0.4 }}>
                        Permanently delete your account, all chatbots, documents, and data
                      </p>
                    </div>
                    <button
                      onClick={() => setShowDeleteModal(true)}
                      className="w-full sm:w-auto px-3 py-1.5 rounded-lg text-xs cursor-pointer transition-all hover:brightness-110 whitespace-nowrap"
                      style={{ backgroundColor: "#ef4444", color: "#ffffff" }}
                    >
                      Delete Account
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-center gap-6 mt-8">
            
            <a
              href="https://github.com/itsdiy0/Bouldy"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs cursor-pointer"
              style={{ color: "#D3DAD9", opacity: 0.3 }}
            >
              <ExternalLink className="w-3 h-3" />
              GitHub
            </a>
            <span className="text-xs" style={{ color: "#D3DAD9", opacity: 0.15 }}>
              Bouldy v1.0
            </span>
          </div>
        </div>
      </div>

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "#00000080" }}>
          <div className="rounded-xl p-6 max-w-sm w-full" style={{ backgroundColor: "#2D2B33", border: "1px solid #715A5A" }}>
            <h3 className="text-lg font-semibold mb-2" style={{ color: "#ef4444" }}>Delete Account</h3>
            <p className="text-sm mb-6" style={{ color: "#D3DAD9", opacity: 0.6 }}>
              This will permanently delete your account, all chatbots, documents, chat history, and vector indexes. This cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer"
                style={{ backgroundColor: "transparent", color: "#D3DAD9", border: "1px solid #715A5A" }}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer"
                style={{ backgroundColor: "#ef4444", color: "#ffffff" }}
              >
                Delete Everything
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}