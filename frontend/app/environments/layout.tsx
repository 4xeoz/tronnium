import { ThemeProvider } from "@/lib/ThemeContext";
import AppLayout from "@/components/layout/AppLayout";

interface Props {
  children: React.ReactNode;
}

export default function EnvironmentsLayout({ children }: Props) {
  return (
    <ThemeProvider>
      <AppLayout>
        {children}
      </AppLayout>
    </ThemeProvider>
  );
}
