"use client";

import { useTheme } from "@/lib/ThemeContext";
import { FiSun, FiMoon } from "react-icons/fi";
import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Prevent hydration mismatch
  if (!mounted) {
    return (
      <div className="flex flex-col items-center gap-2 p-2 rounded-full bg-surface-secondary">
        <div className="p-2 rounded-full w-10 h-10" />
        <div className="p-2 rounded-full w-10 h-10" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 p-2 rounded-full ">
      <button
        onClick={() => theme === "dark" && toggleTheme()}
        className={`p-2 rounded-full transition-all duration-200 ${
          theme === "light" 
            ? "bg-brand-1 shadow-md" 
            : "hover:bg-surface-secondary hover:scale-110"
        }`}
        aria-label="Switch to light mode"
      >
        <FiSun className={`w-6 h-6 transition-colors duration-200 ${
          theme === "light" ? "text-brand-2" : "text-text-muted hover:text-brand-1"
        }`} />
      </button>
      <button
        onClick={() => theme === "light" && toggleTheme()}
        className={`p-2 rounded-full transition-all duration-200 ${
          theme === "dark" 
            ? "bg-brand-1 shadow-md" 
            : "hover:bg-surface-secondary hover:scale-110"
        }`}
        aria-label="Switch to dark mode"
      >
        <FiMoon className={`w-6 h-6 transition-colors duration-200 ${
          theme === "dark" ? "text-brand-2" : "text-text-muted hover:text-brand-1"
        }`} />
      </button>
    </div>
  );
}
