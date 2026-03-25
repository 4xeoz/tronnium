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

// Custom tooltip wrapper for instant tooltips
function Tooltip({ children, text }: { children: React.ReactNode; text: string }) {
    return (
        <div className="relative group">
            {children}
            <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-surface-tertiary text-text-primary text-xs font-medium rounded-md whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity duration-75 z-50 border border-border shadow-lg">
                {text}
            </div>
        </div>
    );
}

// Reusable nav button component for consistency
function NavButton({ 
    href, 
    isActive, 
    icon: Icon, 
    title,
    onClick,
    indicator,
    variant = "default",
}: { 
    href?: string; 
    isActive?: boolean; 
    icon: React.ElementType; 
    title: string;
    onClick?: () => void;
    indicator?: React.ReactNode;
    variant?: "default" | "dev";
}) {
    const baseClass = "relative w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200";
    
    // Variant-based styling
    const getActiveClass = () => {
        if (isActive) return "bg-brand-2";
        if (variant === "dev") return "hover:bg-purple-500/10";
        return "hover:bg-surface-secondary";
    };
    
    const getIconClass = () => {
        if (isActive) return "text-white";
        if (variant === "dev") return "text-purple-500";
        return "text-text-secondary";
    };

    const button = onClick ? (
        <button onClick={onClick} className={`${baseClass} ${getActiveClass()}`}>
            <Icon className={`w-5 h-5 ${getIconClass()}`} />
            {indicator}
        </button>
    ) : (
        <Link href={href || "#"} className={`${baseClass} ${getActiveClass()}`}>
            <Icon className={`w-5 h-5 ${getIconClass()}`} />
            {indicator}
        </Link>
    );

    return <Tooltip text={title}>{button}</Tooltip>;
}

// Pulsing dot indicator for active operations
function PulsingDot({ color = "bg-brand-1" }: { color?: string }) {
    return (
        <span className="absolute top-1 right-1 flex h-2.5 w-2.5">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${color} opacity-75`}></span>
            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${color}`}></span>
        </span>
    );
}

// Badge with count
function Badge({ count, color = "bg-error-text" }: { count: number; color?: string }) {
    return (
        <span className={`absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full ${color} px-1 text-[9px] font-bold text-white`}>
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
    
    // Extract environment ID for dynamic navigation
    const envMatch = pathname.match(/\/environments\/([^/]+)/);
    const envId = envMatch ? envMatch[1] : null;
    
    // Check which environment sub-page we're on
    const isInEnvironment = !!envId;
    const isInDashboard = pathname.endsWith("/dashboard");
    const isInMap = pathname.endsWith("/map");
    const isInSecurity = pathname.endsWith("/security");
    const isInDev = pathname.endsWith("/dev");
    
    // Check if scanning current environment
    const isScanningThisEnv = isScanning && environmentId === envId;
    const hasScanResult = scanResult && environmentId === envId;
    const hasScanError = error && environmentId === envId;

    // Redirect to home if not authenticated
    useEffect(() => {
        if (!loading && !user) {
            router.replace("/");
        }
    }, [user, loading, router]);

    // Show loading state while checking auth
    if (loading) {
        return (
            <div className="h-screen bg-background flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-4 border-brand-1 border-t-transparent rounded-full" />
            </div>
        );
    }

    // Don't render layout if not authenticated
    if (!user) {
        return null;
    }

    return (
        <div className="h-[calc(100vh)] bg-background-secondary flex">
            {/* Sidebar */}
            <aside className="w-16 flex flex-col items-center py-4 gap-4 border-r border-border bg-surface">
                {/* Logo */}
                <Link href="/environments" className="relative w-10 h-10 rounded-full overflow-hidden">
                    <Image
                        src="/Tronnium_Main.png"
                        alt="Tronnium"
                        fill
                        className="object-cover"
                    />
                </Link>

                {/* Theme Toggle */}
                <ThemeToggle />

                {/* Main Navigation */}
                <nav className="flex-1 flex flex-col items-center gap-2 py-4">
                    {isInEnvironment && (
                        <NavButton 
                            href="/environments" 
                            icon={FiArrowLeft} 
                            title="Back to Environments" 
                        />
                    )}
                    {isInEnvironment && envId && (
                        <>
                            <NavButton
                                href={`/environments/${envId}/dashboard`}
                                icon={FiGrid}
                                title="Dashboard"
                                isActive={isInDashboard}
                            />
                            <NavButton
                                href={`/environments/${envId}/map`}
                                icon={FiMap}
                                title="Map View"
                                isActive={isInMap}
                            />
                            <NavButton
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
                                <NavButton
                                    href={`/environments/${envId}/dev`}
                                    icon={FiCode}
                                    title="Dev Mode"
                                    isActive={isInDev}
                                    variant="dev"
                                />
                            )}
                        </>
                    )}
                    {!isInEnvironment && (
                        <NavButton 
                            href="/environments" 
                            icon={FiBox} 
                            title="Environments" 
                            isActive={isEnvironmentsList}
                        />
                    )}
                    <NavButton 
                        href="/settings" 
                        icon={FiSettings} 
                        title="Settings" 
                        isActive={pathname === "/settings"}
                    />
                </nav>

                {/* Bottom Section */}
                <div className="flex flex-col items-center gap-2">
                    <NavButton icon={FiBell} title="Notifications" />
                    
                    

                    <Tooltip text="Logout">
                        <button 
                            onClick={logout}
                            className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-error-bg transition-colors group"
                        >
                            <FiLogOut className="w-5 h-5 text-text-secondary group-hover:text-error-text" />
                        </button>
                    </Tooltip>

                    {/* User Avatar */}
                    <Tooltip text={user?.name || "Profile"}>
                        <div className="relative w-10 h-10 rounded-full bg-brand-1 flex items-center justify-center overflow-hidden border-brand-2 border-4">
                            {user?.avatarUrl ? (
                                <Image
                                    src={user.avatarUrl}
                                    alt={user.name || "User"}
                                    fill
                                    className="object-cover"
                                />
                            ) : (
                                <FiUser className="w-5 h-5 text-brand-2" />
                            )}
                        </div>
                    </Tooltip>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 bg-surface overflow-auto">
                {children}
            </main>

            {/* Scan Progress Popup - shows across all environment pages */}
            <ScanProgressPopup />
        </div>
    );
}

