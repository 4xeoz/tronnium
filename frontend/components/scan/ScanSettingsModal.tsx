"use client";

import { useState, useEffect } from "react";
import {
  FiX, FiClock, FiRefreshCw, FiAlertCircle, FiCheck, FiArrowRight, FiCalendar, FiTrash2,
} from "react-icons/fi";
import { fetchScanSettings, type ScanSettings, type ScanFromDateOption } from "@/lib/api/scans";
import {
  fetchSchedule, upsertSchedule, deleteSchedule,
  type ScanSchedule, type ScheduleFrequency, type UpsertScheduleInput,
} from "@/lib/api/schedule";
import { formatDateTime } from "@/lib/utils/format";

interface ScanSettingsModalProps {
  environmentId: string;
  isOpen: boolean;
  onClose: () => void;
  onStartScan: (fromDate?: string) => void;
}

type Tab = "run" | "schedule";

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAYS_OF_MONTH = Array.from({ length: 31 }, (_, i) => i + 1);

function formatNextRun(date: string | null): string {
  if (!date) return "—";
  const d = new Date(date);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffH = Math.round(diffMs / (1000 * 60 * 60));
  if (diffH < 1) return "in less than an hour";
  if (diffH < 24) return `in ${diffH}h`;
  const diffD = Math.round(diffH / 24);
  if (diffD === 1) return "tomorrow";
  return `in ${diffD} days`;
}

export default function ScanSettingsModal({
  environmentId,
  isOpen,
  onClose,
  onStartScan,
}: ScanSettingsModalProps) {
  const [tab, setTab] = useState<Tab>("run");

  // ── Run Now state ────────────────────────────────────────────
  const [settings, setSettings] = useState<ScanSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fromDateOption, setFromDateOption] = useState<ScanFromDateOption>("last-scan");
  const [customDate, setCustomDate] = useState("");
  const [dateError, setDateError] = useState<string | null>(null);

  // ── Schedule state ───────────────────────────────────────────
  const [schedule, setSchedule] = useState<ScanSchedule | null>(null);
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [frequency, setFrequency] = useState<ScheduleFrequency>("WEEKLY");
  const [hour, setHour] = useState(2);
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [schedFromDate, setSchedFromDate] = useState<string>("last-scan");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!isOpen || !environmentId) return;
    loadRunSettings();
    loadSchedule();
  }, [isOpen, environmentId]);

  useEffect(() => {
    if (settings?.maxLookbackDate) {
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      const maxLookback = new Date(settings.maxLookbackDate);
      const defaultDate = oneYearAgo > maxLookback ? oneYearAgo : maxLookback;
      setCustomDate(defaultDate.toISOString().split("T")[0]);
    }
  }, [settings]);

  const loadRunSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchScanSettings(environmentId);
      if (res) {
        setSettings(res.data);
        setFromDateOption(res.data.hasPreviousScan ? "last-scan" : "all");
      }
    } catch (e: any) {
      setError(e.message ?? "Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  const loadSchedule = async () => {
    setScheduleLoading(true);
    setScheduleError(null);
    try {
      const res = await fetchSchedule(environmentId);
      if (res?.data) {
        const s = res.data;
        setSchedule(s);
        setFrequency(s.frequency);
        setHour(s.hour);
        setDayOfWeek(s.dayOfWeek ?? 1);
        setDayOfMonth(s.dayOfMonth ?? 1);
        setSchedFromDate(s.fromDate ?? "last-scan");
        setIsActive(s.isActive);
      }
    } catch (e: any) {
      setScheduleError(e.message ?? "Failed to load schedule");
    } finally {
      setScheduleLoading(false);
    }
  };

  // ── Run Now handlers ─────────────────────────────────────────

  const validateCustomDate = (date: string): boolean => {
    if (!date) { setDateError("Please select a date"); return false; }
    const selected = new Date(date);
    if (isNaN(selected.getTime())) { setDateError("Invalid date"); return false; }
    if (selected > new Date()) { setDateError("Date cannot be in the future"); return false; }
    if (settings?.maxLookbackDate && selected < new Date(settings.maxLookbackDate)) {
      setDateError(`Cannot be more than 5 years ago`);
      return false;
    }
    setDateError(null);
    return true;
  };

  const handleStartScan = () => {
    let fromDate: string | undefined;
    if (fromDateOption === "last-scan") fromDate = "last-scan";
    else if (fromDateOption === "custom") {
      if (!validateCustomDate(customDate)) return;
      fromDate = new Date(customDate).toISOString();
    }
    onStartScan(fromDate);
    onClose();
  };

  // ── Schedule handlers ────────────────────────────────────────

  const handleSaveSchedule = async () => {
    setSaving(true);
    setScheduleError(null);
    try {
      const input: UpsertScheduleInput = {
        frequency,
        hour,
        minute: 0,
        dayOfWeek: frequency === "WEEKLY" ? dayOfWeek : null,
        dayOfMonth: frequency === "MONTHLY" ? dayOfMonth : null,
        fromDate: schedFromDate === "all" ? null : schedFromDate,
        isActive,
      };
      const res = await upsertSchedule(environmentId, input);
      setSchedule(res.data);
    } catch (e: any) {
      setScheduleError(e.message ?? "Failed to save schedule");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSchedule = async () => {
    setSaving(true);
    try {
      await deleteSchedule(environmentId);
      setSchedule(null);
      setIsActive(true);
      setFrequency("WEEKLY");
      setHour(2);
    } catch (e: any) {
      setScheduleError(e.message ?? "Failed to delete schedule");
    } finally {
      setSaving(false);
    }
  };

  // ── Shared classes ───────────────────────────────────────────

  const cardBase = "w-full p-4 rounded-xl border-2 text-left transition-all cursor-pointer";
  const cardActive = "border-brand-1 bg-brand-1/5";
  const cardIdle = "border-border hover:border-border-secondary";
  const dotBase = "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5";
  const dotActive = "border-brand-1 bg-brand-1";
  const dotIdle = "border-border";

  const daysSince = settings?.lastScanDate
    ? Math.floor((Date.now() - new Date(settings.lastScanDate).getTime()) / 86400000)
    : null;

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      <div
        className={`fixed right-0 top-0 h-full w-full max-w-md bg-surface shadow-2xl z-50
          flex flex-col transform transition-transform duration-300 ease-in-out
          ${isOpen ? "translate-x-0" : "translate-x-full"}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-1/10 rounded-xl flex items-center justify-center">
              <FiRefreshCw className="w-5 h-5 text-brand-1" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-text-primary">Scan Settings</h2>
              <p className="text-sm text-text-secondary">Configure vulnerability scanning</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-surface-secondary transition-colors">
            <FiX className="w-5 h-5 text-text-secondary" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex shrink-0 border-b border-border">
          <button
            onClick={() => setTab("run")}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              tab === "run"
                ? "text-brand-1 border-b-2 border-brand-1"
                : "text-text-muted hover:text-text-primary"
            }`}
          >
            Run Now
          </button>
          <button
            onClick={() => setTab("schedule")}
            className={`flex-1 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
              tab === "schedule"
                ? "text-brand-1 border-b-2 border-brand-1"
                : "text-text-muted hover:text-text-primary"
            }`}
          >
            <FiCalendar className="w-3.5 h-3.5" />
            Schedule
            {schedule?.isActive && (
              <span className="w-1.5 h-1.5 rounded-full bg-brand-1 ml-0.5" />
            )}
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* ── Run Now tab ─────────────────────────────────── */}
          {tab === "run" && (
            loading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="w-8 h-8 border-2 border-brand-1 border-t-transparent rounded-full animate-spin mb-3" />
                <p className="text-text-secondary text-sm">Loading settings…</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <FiAlertCircle className="w-6 h-6 text-error-text mb-2" />
                <p className="text-error-text text-sm mb-2">{error}</p>
                <button onClick={loadRunSettings} className="text-brand-1 text-sm hover:underline">Try again</button>
              </div>
            ) : (
              <div className="space-y-6">
                {settings?.hasPreviousScan && (
                  <div className="bg-surface-secondary rounded-xl p-4 border border-border">
                    <div className="flex items-center gap-2 mb-1">
                      <FiClock className="w-4 h-4 text-text-muted" />
                      <span className="text-sm font-medium text-text-primary">Last Scan</span>
                    </div>
                    <p className="text-sm text-text-secondary">
                      {formatDateTime(settings.lastScanDate)}
                      {daysSince !== null && (
                        <span className="text-text-muted">
                          {" "}({daysSince === 0 ? "today" : daysSince === 1 ? "yesterday" : `${daysSince} days ago`})
                        </span>
                      )}
                    </p>
                  </div>
                )}

                <div>
                  <p className="text-sm font-semibold text-text-primary mb-3">Scan For CVEs Published</p>
                  <div className="space-y-2">
                    {settings?.hasPreviousScan && (
                      <button
                        onClick={() => setFromDateOption("last-scan")}
                        className={`${cardBase} ${fromDateOption === "last-scan" ? cardActive : cardIdle}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`${dotBase} ${fromDateOption === "last-scan" ? dotActive : dotIdle}`}>
                            {fromDateOption === "last-scan" && <FiCheck className="w-3 h-3 text-brand-2" />}
                          </div>
                          <div>
                            <p className="font-medium text-text-primary">Since Last Scan</p>
                            <p className="text-sm text-text-secondary mt-0.5">
                              Only new CVEs since {formatDateTime(settings.lastScanDate)}
                            </p>
                          </div>
                        </div>
                      </button>
                    )}

                    <button
                      onClick={() => setFromDateOption("all")}
                      className={`${cardBase} ${fromDateOption === "all" ? cardActive : cardIdle}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`${dotBase} ${fromDateOption === "all" ? dotActive : dotIdle}`}>
                          {fromDateOption === "all" && <FiCheck className="w-3 h-3 text-brand-2" />}
                        </div>
                        <div>
                          <p className="font-medium text-text-primary">All CVEs</p>
                          <p className="text-sm text-text-secondary mt-0.5">Full scan — every known CVE</p>
                        </div>
                      </div>
                    </button>

                    <button
                      onClick={() => setFromDateOption("custom")}
                      className={`${cardBase} ${fromDateOption === "custom" ? cardActive : cardIdle}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`${dotBase} ${fromDateOption === "custom" ? dotActive : dotIdle}`}>
                          {fromDateOption === "custom" && <FiCheck className="w-3 h-3 text-brand-2" />}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-text-primary">From Specific Date</p>
                          <p className="text-sm text-text-secondary mt-0.5">CVEs published after a date you choose</p>
                          {fromDateOption === "custom" && (
                            <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="date"
                                value={customDate}
                                onChange={(e) => { setCustomDate(e.target.value); setDateError(null); }}
                                max={new Date().toISOString().split("T")[0]}
                                min={settings?.maxLookbackDate?.split("T")[0]}
                                className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:border-brand-1"
                              />
                              {dateError && (
                                <p className="text-error-text text-xs mt-1.5 flex items-center gap-1">
                                  <FiAlertCircle className="w-3 h-3 shrink-0" />{dateError}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  </div>
                </div>

                <div className="bg-info-bg border border-info-border rounded-xl p-4">
                  <div className="flex gap-3">
                    <FiAlertCircle className="w-5 h-5 text-info-text shrink-0 mt-0.5" />
                    <p className="text-sm text-text-secondary">
                      <span className="font-medium text-text-primary">Tip:</span>{" "}
                      Scanning since last scan is faster and focuses on newly discovered vulnerabilities.
                    </p>
                  </div>
                </div>
              </div>
            )
          )}

          {/* ── Schedule tab ─────────────────────────────────── */}
          {tab === "schedule" && (
            scheduleLoading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="w-8 h-8 border-2 border-brand-1 border-t-transparent rounded-full animate-spin mb-3" />
                <p className="text-text-secondary text-sm">Loading schedule…</p>
              </div>
            ) : (
              <div className="space-y-6">
                {schedule?.isActive && (
                  <div className="bg-surface-secondary rounded-xl p-4 border border-border">
                    <div className="flex items-center gap-2 mb-1">
                      <FiCalendar className="w-4 h-4 text-brand-1" />
                      <span className="text-sm font-medium text-text-primary">Active Schedule</span>
                      <span className="ml-auto text-xs text-brand-1 font-medium">ON</span>
                    </div>
                    <p className="text-sm text-text-secondary">
                      Next run: <span className="text-text-primary font-medium">{formatNextRun(schedule.nextRunAt)}</span>
                      {schedule.nextRunAt && (
                        <span className="text-text-muted"> · {formatDateTime(schedule.nextRunAt)}</span>
                      )}
                    </p>
                    {schedule.lastRunAt && (
                      <p className="text-xs text-text-muted mt-0.5">Last ran: {formatDateTime(schedule.lastRunAt)}</p>
                    )}
                  </div>
                )}

                {scheduleError && (
                  <div className="bg-error-bg border border-error-border rounded-xl px-4 py-3 text-sm text-error-text">
                    {scheduleError}
                  </div>
                )}

                {/* Frequency */}
                <div>
                  <p className="text-sm font-semibold text-text-primary mb-3">Frequency</p>
                  <div className="grid grid-cols-3 gap-2">
                    {(["DAILY", "WEEKLY", "MONTHLY"] as ScheduleFrequency[]).map((f) => (
                      <button
                        key={f}
                        onClick={() => setFrequency(f)}
                        className={`py-2 rounded-lg text-sm font-medium border transition-all ${
                          frequency === f
                            ? "border-brand-1 bg-brand-1/10 text-brand-1"
                            : "border-border text-text-muted hover:border-border-secondary"
                        }`}
                      >
                        {f.charAt(0) + f.slice(1).toLowerCase()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Day picker */}
                {frequency === "WEEKLY" && (
                  <div>
                    <p className="text-sm font-semibold text-text-primary mb-3">Day of Week</p>
                    <div className="flex gap-1.5">
                      {DAYS_OF_WEEK.map((d, i) => (
                        <button
                          key={i}
                          onClick={() => setDayOfWeek(i)}
                          className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-all ${
                            dayOfWeek === i
                              ? "border-brand-1 bg-brand-1/10 text-brand-1"
                              : "border-border text-text-muted hover:border-border-secondary"
                          }`}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {frequency === "MONTHLY" && (
                  <div>
                    <p className="text-sm font-semibold text-text-primary mb-3">Day of Month</p>
                    <select
                      value={dayOfMonth}
                      onChange={(e) => setDayOfMonth(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-background-secondary border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:border-brand-1"
                    >
                      {DAYS_OF_MONTH.map((d) => (
                        <option key={d} value={d}>Day {d}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Time */}
                <div>
                  <p className="text-sm font-semibold text-text-primary mb-3">Time</p>
                  <select
                    value={hour}
                    onChange={(e) => setHour(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-background-secondary border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:border-brand-1"
                  >
                    {HOURS.map((h) => (
                      <option key={h} value={h}>
                        {h === 0 ? "12:00 AM" : h < 12 ? `${h}:00 AM` : h === 12 ? "12:00 PM" : `${h - 12}:00 PM`}
                      </option>
                    ))}
                  </select>
                </div>

                {/* CVE range */}
                <div>
                  <p className="text-sm font-semibold text-text-primary mb-3">Scan Range</p>
                  <div className="space-y-2">
                    {(["last-scan", "all"] as const).map((opt) => (
                      <button
                        key={opt}
                        onClick={() => setSchedFromDate(opt)}
                        className={`${cardBase} ${schedFromDate === opt ? cardActive : cardIdle}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`${dotBase} ${schedFromDate === opt ? dotActive : dotIdle}`}>
                            {schedFromDate === opt && <FiCheck className="w-3 h-3 text-brand-2" />}
                          </div>
                          <div>
                            <p className="font-medium text-text-primary text-sm">
                              {opt === "last-scan" ? "Since Last Scan" : "All CVEs"}
                            </p>
                            <p className="text-xs text-text-secondary mt-0.5">
                              {opt === "last-scan" ? "Only new CVEs each run" : "Full scan every time"}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Delete */}
                {schedule && (
                  <button
                    onClick={handleDeleteSchedule}
                    disabled={saving}
                    className="flex items-center gap-2 text-sm text-error-text hover:underline disabled:opacity-50"
                  >
                    <FiTrash2 className="w-3.5 h-3.5" />
                    Remove schedule
                  </button>
                )}
              </div>
            )
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-6 py-4 border-t border-border bg-surface-secondary/50 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-border text-text-secondary hover:bg-surface-secondary transition-colors font-medium"
          >
            Cancel
          </button>

          {tab === "run" ? (
            <button
              onClick={handleStartScan}
              disabled={loading || !!error || !!dateError}
              className="flex-1 px-4 py-2.5 rounded-xl bg-brand-1 text-brand-2 font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
            >
              Start Scan <FiArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSaveSchedule}
              disabled={saving || scheduleLoading}
              className="flex-1 px-4 py-2.5 rounded-xl bg-brand-1 text-brand-2 font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
            >
              {saving ? "Saving…" : schedule ? "Update Schedule" : "Save Schedule"}
              {!saving && <FiCheck className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
