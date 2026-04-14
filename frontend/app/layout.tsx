'use client'
import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";
import { UserProvider } from "@/lib/UserContext";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "600", "800", "900"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [queryClient] = useState(() => new QueryClient())

  return (
    <html lang="en">
      <body className={`${inter.variable} ${geistMono.variable} antialiased`}>
        <UserProvider>
          <QueryClientProvider client={queryClient}>
            {children}
          </QueryClientProvider>
        </UserProvider>
      </body>
    </html>
  );
}
