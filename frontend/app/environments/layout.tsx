import { ThemeProvider } from "@/lib/ThemeContext";
import { ScanProvider } from "@/lib/ScanContext";
import AppLayout from "@/components/layout/AppLayout";

interface Props {
  children: React.ReactNode;
}

export default function EnvironmentsLayout({ children }: Props) {
  return (
    <ScanProvider>
      <ThemeProvider>
        <AppLayout>
          {children}
        </AppLayout>
      </ThemeProvider>
    </ScanProvider>
  );
}
