"use client";

import { useState } from "react";
import Image from "next/image";
import { FiCode, FiUser, FiMail, FiShield, FiCheck } from "react-icons/fi";
import { PageHeader } from "@/components/ui/PageHeader";
import { useUser } from "@/lib/UserContext";

export default function SettingsPage() {
  const { user, toggleDevMode } = useUser();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleToggleDevMode() {
    setSaving(true);
    setSaved(false);
    try {
      await toggleDevMode();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // Error is logged in UserContext
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-8 max-w-2xl">
      <PageHeader
        title="Settings"
        subtitle="Manage your account preferences and platform options"
      />

      {/* Profile Card */}
      <div className="bg-surface border border-border rounded-[16px] p-6 mb-6">
        <h2 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
          <FiUser className="w-4 h-4 text-text-muted" />
          Profile
        </h2>
        <div className="flex items-center gap-4">
          <div className="relative w-14 h-14 rounded-full overflow-hidden border-2 border-border shrink-0">
            {user?.avatarUrl ? (
              <Image
                src={user.avatarUrl}
                alt={user.name || "User"}
                fill
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full bg-brand-1/10 flex items-center justify-center text-brand-1">
                <FiUser className="w-6 h-6" />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-base font-semibold text-text-primary">{user?.name || "User"}</p>
            <div className="flex items-center gap-3 mt-1">
              <span className="flex items-center gap-1.5 text-xs text-text-muted">
                <FiMail className="w-3 h-3" />
                {user?.email || "—"}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-text-muted">
                <FiShield className="w-3 h-3" />
                {user?.role || "user"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Platform Options */}
      <div className="bg-surface border border-border rounded-[16px] p-6">
        <h2 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
          <FiCode className="w-4 h-4 text-text-muted" />
          Platform
        </h2>

        <div className="flex items-center justify-between p-3.5 bg-surface-secondary rounded-[10px] border border-border">
          <div className="flex items-center gap-2.5">
            <FiCode className="w-4 h-4 text-text-muted" />
            <div>
              <span className="text-sm text-text-secondary block">Dev Mode</span>
              <span className="text-[11px] text-text-muted">
                Enables experimental features and mock data options
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {saved && (
              <span className="flex items-center gap-1 text-xs text-success-text">
                <FiCheck className="w-3 h-3" />
                Saved
              </span>
            )}
            <button
              type="button"
              onClick={handleToggleDevMode}
              disabled={saving}
              className={`relative w-11 h-6 rounded-full transition-colors duration-200 ease-out focus:outline-none focus:ring-2 focus:ring-brand-1/30 ${
                user?.devMode
                  ? "bg-brand-1"
                  : "bg-surface-tertiary border border-border"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-out ${
                  user?.devMode ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>

        {user?.devMode && (
          <div className="mt-3 p-3 bg-brand-1/10 border border-brand-1/20 rounded-[10px] text-sm text-text-secondary">
            Dev mode is active. You now have access to experimental features across your environments.
          </div>
        )}
      </div>
    </div>
  );
}
