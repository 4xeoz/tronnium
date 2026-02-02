"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useTheme } from "@/lib/ThemeContext";
import ThemeToggle from "@/components/ThemeToggle";
import { FiHome, FiBox, FiSettings, FiLogOut, FiBell } from "react-icons/fi";

interface DashboardContentProps {
    children: React.ReactNode;
}

export default function DashboardContent({ children }: DashboardContentProps) {
    const pathname = usePathname();
    
    return (
        <div className="h-[calc(100vh-2rem)] bg-background-secondary m-4">
            {/* Top Nav */}
            <div className="h-28 w-full p-4 flex items-center justify-between ">
                {/* Logo Section */}
                <div className="relative rounded-full bg-surface h-20 w-20 flex items-center justify-center overflow-hidden ">
                    <Image 
                        src="/Tronnium_Main.png" 
                        alt="Tronnium Logo" 
fill
                        className="object-cover"
                    />
                    
                </div>
                
                {/* Nav Bar */}
                <div className=" h-full flex-1 flex items-center justify-center ">
                    <div className=" rounded-full bg-surface h-20 w-fit px-4 flex items-center justify-center gap-20">

                    <Link href="/dashboard" className={`px-6 py-4 rounded-full transition-all duration-200 font-medium ${
                        pathname === "/dashboard" 
                            ? "bg-brand-2 text-white" 
                            : "text-text-secondary hover:bg-surface-secondary hover:text-brand-2"
                    }`}>
                        Dashboard
                    </Link>
                    <Link href="/dashboard/assets" className={`px-6 py-4 rounded-full transition-all duration-200 font-medium ${
                        pathname === "/dashboard/assets" 
                            ? "bg-brand-2 text-white" 
                            : "text-text-secondary hover:bg-surface-secondary hover:text-brand-2"
                    }`}>
                        Assets
                    </Link>
                    <Link href="/dashboard/reports" className={`px-6 py-4 rounded-full transition-all duration-200 font-medium ${
                        pathname === "/dashboard/reports" 
                            ? "bg-brand-2 text-white" 
                            : "text-text-secondary hover:bg-surface-secondary hover:text-brand-2"
                    }`}>
                        Reports
                    </Link>
                    <Link href="/dashboard/settings" className={`px-6 py-4 rounded-full transition-all duration-200 font-medium ${
                        pathname === "/dashboard/settings" 
                            ? "bg-brand-2 text-white" 
                            : "text-text-secondary hover:bg-surface-secondary hover:text-brand-2"
                    }`}>
                        Settings
                    </Link>
                    </div>
                </div>
                
                {/* Profile Section */}
                <div className=" h-full w-80 flex items-center justify-center gap-3 ">
                    {/* Notification Icon */}
                    <div className="rounded-full bg-surface h-20 w-28 px-4 flex items-center justify-center">
                        <FiBell className="w-5 h-5 text-text-secondary" />
                    </div>
                    {/* User Image and Name */}
                    <div className="rounded-full bg-surface h-20 w-full px-4 flex items-center justify-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-brand-1 flex items-center justify-center">
                            {/* User image placeholder */}
                        </div>
                        <span className="text-text-primary text-sm font-medium truncate">User Name</span>
                    </div>
                </div>
            </div>
            <div className="flex h-[calc(100%-7rem)]">

            {/* Sidebar */}
            <aside className="flex flex-col justify-between">
                <div className="w-28 min-h-[70%] p-4 flex flex-col items-center gap-4">
                    {/* Switch between light and dark mode */}
                    <div className="rounded-full bg-surface w-full py-4 flex items-center justify-center">
                        <ThemeToggle />
                    </div>

                    {/* Vertical nav icons */}
                    <div className=" w-full flex-1 flex flex-col items-center justify-center">
                        <div className=" rounded-full bg-surface flex flex-col items-center justify-center gap-6 p-4 py-6">
                        <Link href="/dashboard" className={`p-3 rounded-full transition-all duration-200 ${
                            pathname === "/dashboard" 
                                ? "bg-brand-2" 
                                : "hover:bg-brand-1"
                        }`}>
                            <FiHome className={`w-6 h-6 ${
                                pathname === "/dashboard" 
                                    ? "text-white" 
                                    : "text-text-secondary hover:text-brand-2"
                            }`} />
                        </Link>
                        <Link href="/dashboard/assets" className={`p-3 rounded-full transition-all duration-200 ${
                            pathname === "/dashboard/assets" 
                                ? "bg-brand-2" 
                                : "hover:bg-brand-1"
                        }`}>
                            <FiBox className={`w-6 h-6 ${
                                pathname === "/dashboard/assets" 
                                    ? "text-white" 
                                    : "text-text-secondary hover:text-brand-2"
                            }`} />
                        </Link>
                        <Link href="/dashboard/settings" className={`p-3 rounded-full transition-all duration-200 ${
                            pathname === "/dashboard/settings" 
                                ? "bg-brand-2" 
                                : "hover:bg-brand-1"
                        }`}>
                            <FiSettings className={`w-6 h-6 ${
                                pathname === "/dashboard/settings" 
                                    ? "text-white" 
                                    : "text-text-secondary hover:text-brand-2"
                            }`} />
                        </Link>
                        
                        </div>
                    </div>
                </div>

                <div className="w-28 h-28 p-4">
                    <div className="rounded-full bg-surface w-full h-full flex items-center justify-center">
                        <Link href="/api/logout" className="p-3 rounded-full hover:bg-red-100 transition-colors group">
                            <FiLogOut className="w-6 h-6 text-text-secondary group-hover:text-red-500" />
                        </Link>
                    </div>
                </div>
            </aside>

                {/* Main Content */}
                <main className="flex-1  rounded-tl-3xl p-6 overflow-auto">
                    {children}
                </main>
            </div>
        </div>
    );
}
