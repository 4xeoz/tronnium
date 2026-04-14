"use client";

import { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useUser } from "@/lib/UserContext";
import { useScan } from "@/lib/ScanContext";
import ThemeToggle from "@/components/ui/ThemeToggle";
import ScanProgressPopup from "@/components/scan/ScanProgressPopup";
import { FiBox, FiSettings, FiLogOut, FiBell, FiUser, FiArrowLeft, FiMap, FiGrid, FiShield, FiCode } from "react-icons/fi";

interface AppLayoutProps {
    children: React.ReactNode;
}

function NavItem({
    href,
    isActive,
    icon: Icon,
    title,
    onClick,
    indicator,
}: {
    href?: string;
    isActive?: boolean;
    icon: React.ElementType;
    title: string;
    onClick?: () => void;
    indicator?: React.ReactNode;
}) {
    const baseClass = "relative flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-sm font-medium transition-all duration-150";
    const activeClass = isActive
        ? "bg-brand-1/18 text-brand-2 font-semibold"
        : "text-text-secondary hover:bg-brand-1/12 hover:text-text-primary";

    const content = (
        <>
            <div className="relative">
                <Icon className="w-5 h-5" />
                {indicator}
            </div>
            <span>{title}</span>
        </>
    );

    if (onClick) {
        return (
            <button onClick={onClick} className={`${baseClass} ${activeClass} w-full text-left`}>
                {content}
            </button>
        );
    }

    return (
        <Link href={href || "#"} className={`${baseClass} ${activeClass} w-full`}>
            {content}
        </Link>
    );
}

function PulsingDot({ color = "bg-brand-1" }: { color?: string }) {
    return (
        <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${color} opacity-75`}></span>
            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${color}`}></span>
        </span>
    );
}

function Badge({ count, color = "bg-error-text" }: { count: number; color?: string }) {
    return (
        <span className={`absolute -top-1.5 -right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full ${color} px-1 text-[9px] font-bold text-white`}>
            {count > 99 ? "99+" : count}
        </span>
    );
}

export default function AppLayout({ children }: AppLayoutProps) {
    const pathname = usePathname();
    const router = useRouter();
    const { user, loading, logout } = useUser();
    const { isScanning, scanResult, error, environmentId } = useScan();

    const isEnvironmentsList = pathname === "/environments";
    const envMatch = pathname.match(/\/environments\/([^/]+)/);
    const envId = envMatch ? envMatch[1] : null;
    const isInEnvironment = !!envId;
    const isInDashboard = pathname.endsWith("/dashboard");
    const isInMap = pathname.endsWith("/map");
    const isInSecurity = pathname.endsWith("/security");
    const isInDev = pathname.endsWith("/dev");
    const isScanningThisEnv = isScanning && environmentId === envId;
    const hasScanResult = scanResult && environmentId === envId;
    const hasScanError = error && environmentId === envId;

    useEffect(() => {
        if (!loading && !user) {
            router.replace("/");
        }
    }, [user, loading, router]);

    if (loading) {
        return (
            <div className="h-screen bg-background flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-4 border-brand-1 border-t-transparent rounded-full" />
            </div>
        );
    }

    if (!user) {
        return null;
    }

    return (
        <div className="min-h-screen bg-background flex">
            {/* Sidebar */}
            <aside className="w-[240px] h-screen bg-background-secondary border-r border-border flex flex-col px-3 py-4 fixed top-0 left-0 z-20">
                {/* Logo */}
                <Link href="/environments" className="flex items-center gap-3 px-3 py-2 mb-6">
                    <div className="relative w-9 h-9 rounded-full overflow-hidden shrink-0">
                        <Image src="/Tronnium_Main.png" alt="Tronnium" fill className="object-cover" />
                    </div>
                    <span className="text-[18px] font-extrabold text-text-primary tracking-[-0.5px]">Tronnium</span>
                </Link>

                {/* Main Navigation */}
                <nav className="flex-1 flex flex-col gap-1">
                    <div className="px-3 pb-2">
                        <span className="text-[11px] font-semibold text-text-muted uppercase tracking-[0.6px]">
                            {isInEnvironment ? "Environment" : "Main"}
                        </span>
                    </div>

                    {isInEnvironment && (
                        <NavItem href="/environments" icon={FiArrowLeft} title="Back to Environments" />
                    )}

                    {isInEnvironment && envId && (
                        <>
                            <NavItem
                                href={`/environments/${envId}/dashboard`}
                                icon={FiGrid}
                                title="Dashboard"
                                isActive={isInDashboard}
                            />
                            <NavItem
                                href={`/environments/${envId}/map`}
                                icon={FiMap}
                                title="Map View"
                                isActive={isInMap}
                            />
                            <NavItem
                                href={`/environments/${envId}/security`}
                                icon={FiShield}
                                title="Security"
                                isActive={isInSecurity}
                                indicator={
                                    isScanningThisEnv ? (
                                        <PulsingDot color="bg-brand-1" />
                                    ) : hasScanError ? (
                                        <PulsingDot color="bg-error-text" />
                                    ) : hasScanResult && scanResult.vulnerabilitiesFound > 0 ? (
                                        <Badge
                                            count={scanResult.vulnerabilitiesFound}
                                            color={scanResult.criticalCount > 0 ? "bg-red-500" : "bg-orange-500"}
                                        />
                                    ) : null
                                }
                            />
                            {user?.devMode && (
                                <NavItem
                                    href={`/environments/${envId}/dev`}
                                    icon={FiCode}
                                    title="Dev Mode"
                                    isActive={isInDev}
                                />
                            )}
                        </>
                    )}

                    {!isInEnvironment && (
                        <NavItem href="/environments" icon={FiBox} title="Environments" isActive={isEnvironmentsList} />
                    )}

                    <div className="px-3 pt-4 pb-2">
                        <span className="text-[11px] font-semibold text-text-muted uppercase tracking-[0.6px]">Account</span>
                    </div>
                    <NavItem href="/settings" icon={FiSettings} title="Settings" isActive={pathname === "/settings"} />
                    <NavItem icon={FiBell} title="Notifications" />
                </nav>

                {/* Bottom Section */}
                <div className="flex flex-col gap-1 pt-4 border-t border-border">
                    <div className="px-3 py-2 flex items-center gap-3">
                        <ThemeToggle />
                        <span className="text-sm text-text-secondary">Theme</span>
                    </div>
                    <button
                        onClick={logout}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-sm font-medium text-text-secondary hover:bg-error-bg hover:text-error-text transition-all duration-150 w-full text-left"
                    >
                        <FiLogOut className="w-5 h-5" />
                        Logout
                    </button>
                    <div className="flex items-center gap-3 px-3 py-3 mt-1">
                        <div className="relative w-9 h-9 rounded-full bg-brand-1 flex items-center justify-center overflow-hidden border-2 border-brand-2 shrink-0">
                            {user?.avatarUrl ? (
                                <Image src={user.avatarUrl} alt={user.name || "User"} fill className="object-cover" />
                            ) : (
                                <FiUser className="w-4 h-4 text-brand-2" />
                            )}
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-semibold text-text-primary truncate">{user?.name || "User"}</p>
                            <p className="text-[11px] text-text-muted truncate">{user?.email || ""}</p>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 bg-background ml-[240px] overflow-auto">
                {children}
            </main>

            {/* Scan Progress Popup */}
            <ScanProgressPopup />
        </div>
    );
}
