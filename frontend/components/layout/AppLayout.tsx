"use client";

import { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useUser } from "@/lib/UserContext";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { FiBox, FiSettings, FiLogOut, FiBell, FiUser, FiArrowLeft, FiMap, FiGrid, FiShield } from "react-icons/fi";

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
}: { 
    href?: string; 
    isActive?: boolean; 
    icon: React.ElementType; 
    title: string;
    onClick?: () => void;
}) {
    const baseClass = "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200";
    const activeClass = isActive ? "bg-brand-2" : "hover:bg-surface-secondary";
    const iconClass = `w-5 h-5 ${isActive ? "text-white" : "text-text-secondary"}`;

    const button = onClick ? (
        <button onClick={onClick} className={`${baseClass} ${activeClass}`}>
            <Icon className={iconClass} />
        </button>
    ) : (
        <Link href={href || "#"} className={`${baseClass} ${activeClass}`}>
            <Icon className={iconClass} />
        </Link>
    );

    return <Tooltip text={title}>{button}</Tooltip>;
}

export default function AppLayout({ children }: AppLayoutProps) {
    const pathname = usePathname();
    const router = useRouter();
    const { user, loading, logout } = useUser();

    const isEnvironmentsList = pathname === "/environments";
    
    // Extract environment ID for dynamic navigation
    const envMatch = pathname.match(/\/environments\/([^/]+)/);
    const envId = envMatch ? envMatch[1] : null;
    
    // Check which environment sub-page we're on
    const isInEnvironment = !!envId;
    const isInDashboard = pathname.endsWith("/dashboard");
    const isInMap = pathname.endsWith("/map");

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
                                href={`/environments/${envId}/dashboard?tab=security`}
                                icon={FiShield}
                                title="Security"
                            />
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
        </div>
    );
}

