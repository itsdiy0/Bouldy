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
      <div className="h-full flex items-start justify-center p-8 pt-12">
        <div className="w-full max-w-4xl">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-xl font-bold" style={{ color: "#D3DAD9" }}>Settings</h1>
            <p className="text-xs mt-1" style={{ color: "#D3DAD9", opacity: 0.4 }}>
              Manage your account and preferences
            </p>
          </div>

          {/* Main container */}
          <div
            className="rounded-xl overflow-hidden"
            style={{ backgroundColor: "#2D2B33", border: "1px solid #715A5A40" }}
          >
            {/* Tabs */}
            <div className="flex" style={{ borderBottom: "1px solid #715A5A30" }}>
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="flex items-center justify-center gap-2 flex-1 py-3.5 text-sm font-medium transition-all relative cursor-pointer hover:opacity-80"
                  style={{
                    color: tab.id === "danger" && activeTab === tab.id ? "#ef4444" : "#D3DAD9",
                    opacity: activeTab === tab.id ? 1 : 0.4,
                  }}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                  {activeTab === tab.id && (
                    <div
                      className="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 w-12 rounded-full"
                      style={{ backgroundColor: tab.id === "danger" ? "#ef4444" : "#715A5A" }}
                    />
                  )}
                </button>
              ))}
            </div>

            <div className="p-6">
              {/* Profile Tab */}
              {activeTab === "profile" && (
                <div className="space-y-5">
                  {/* User Info */}
                  <div
                    className="flex items-center gap-4 px-5 py-5 rounded-lg"
                    style={{ backgroundColor: "#37353E", border: "1px solid #715A5A" }}
                  >
                    <div
                      className="w-14 h-14 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: "#715A5A30" }}
                    >
                      <User className="w-6 h-6" style={{ color: "#715A5A" }} />
                    </div>
                    <div>
                      <p className="text-base font-semibold" style={{ color: "#D3DAD9" }}>
                        {session?.user?.name || "User"}
                      </p>
                      <p className="text-xs" style={{ color: "#D3DAD9", opacity: 0.4 }}>
                        {session?.user?.email || "—"}
                      </p>
                    </div>
                  </div>

                  {/* Profile Fields */}
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

                  {/* Security */}
                  <div
                    className="flex items-center justify-between px-5 py-4 rounded-lg"
                    style={{ backgroundColor: "#37353E", border: "1px solid #715A5A" }}
                  >
                    <div className="flex items-center gap-3">
                      <Shield className="w-4 h-4" style={{ color: "#D3DAD9", opacity: 0.5 }} />
                      <div>
                        <p className="text-sm font-medium" style={{ color: "#D3DAD9" }}>Password</p>
                        <p className="text-xs" style={{ color: "#D3DAD9", opacity: 0.4 }}>
                          Change your account password
                        </p>
                      </div>
                    </div>
                    <button
                      className="px-3 py-1.5 rounded-lg text-xs cursor-pointer transition-all hover:brightness-110"
                      style={{ backgroundColor: "#715A5A40", color: "#D3DAD9" }}
                    >
                      Change Password
                    </button>
                  </div>
                </div>
              )}

              {/* Appearance Tab */}
              {activeTab === "appearance" && (
                <div className="space-y-5">
                  <div
                    className="flex items-center justify-between px-5 py-4 rounded-lg"
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
                        className="px-3 py-1.5 rounded-lg text-xs cursor-pointer"
                        style={{ backgroundColor: "#715A5A", color: "#D3DAD9" }}
                      >
                        Dark
                      </button>
                      <button
                        className="px-3 py-1.5 rounded-lg text-xs cursor-pointer"
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

              {/* Danger Zone Tab */}
              {activeTab === "danger" && (
                <div className="space-y-4">
                  <div
                    className="flex items-center justify-between px-5 py-4 rounded-lg"
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
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs cursor-pointer transition-all hover:brightness-110"
                      style={{ backgroundColor: "#715A5A", color: "#D3DAD9" }}
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Sign Out
                    </button>
                  </div>

                  <div
                    className="flex items-center justify-between px-5 py-4 rounded-lg"
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
                      className="px-3 py-1.5 rounded-lg text-xs cursor-pointer transition-all hover:brightness-110"
                      style={{ backgroundColor: "#ef4444", color: "#ffffff" }}
                    >
                      Delete Account
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer links */}
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

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "#00000080" }}>
          <div className="rounded-xl p-6 max-w-sm w-full mx-4" style={{ backgroundColor: "#2D2B33", border: "1px solid #715A5A" }}>
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