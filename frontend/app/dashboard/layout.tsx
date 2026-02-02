import { ThemeProvider } from "@/lib/ThemeContext";
import DashboardContent from "@/components/DashboardContent";

interface DashboardLayoutProps {
    children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
    return (
        <ThemeProvider>
            <DashboardContent>
                {children}
            </DashboardContent>
        </ThemeProvider>
    );
}       