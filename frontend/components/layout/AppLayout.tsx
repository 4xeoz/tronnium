"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useUser } from "@/lib/UserContext";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { FiBox, FiSettings, FiLogOut, FiBell, FiUser, FiArrowLeft } from "react-icons/fi";

interface AppLayoutProps {
    children: React.ReactNode;
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

    if (onClick) {
        return (
            <button onClick={onClick} className={`${baseClass} ${activeClass}`} title={title}>
                <Icon className={iconClass} />
            </button>
        );
    }

    return (
        <Link href={href || "#"} className={`${baseClass} ${activeClass}`} title={title}>
            <Icon className={iconClass} />
        </Link>
    );
}

export default function AppLayout({ children }: AppLayoutProps) {
    const pathname = usePathname();
    const { user, logout } = useUser();

    const isInEnvironment = pathname.match(/\/environments\/[^/]+/);
    const isEnvironmentsList = pathname === "/environments";

    return (
        <div className="h-[calc(100vh)] bg-background-secondary flex">
            {/* Sidebar */}
            <aside className="w-16 flex flex-col items-center py-4 gap-4">
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
                            title="Back" 
                        />
                    )}
                    <NavButton 
                        href="/environments" 
                        icon={FiBox} 
                        title="Environments" 
                        isActive={isEnvironmentsList}
                    />
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
                    
                    {/* User Avatar */}
                    <div className="relative w-10 h-10 rounded-full bg-brand-1 flex items-center justify-center overflow-hidden">
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

                    <button 
                        onClick={logout}
                        className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-red-100 transition-colors group"
                        title="Logout"
                    >
                        <FiLogOut className="w-5 h-5 text-text-secondary group-hover:text-red-500" />
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 bg-surface rounded-l-3xl overflow-auto">
                {children}
            </main>
        </div>
    );
}

