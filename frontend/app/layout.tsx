import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { UserProvider } from "@/lib/UserContext";
import { fetchUserServerSide, fetchUserServerSideAPIREQUEST } from "@/lib/UserSessionClient";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Tronnium",
  description: "Frontend for the Tronnium platform",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {

  const user = await fetchUserServerSide();
  console.log("RootLayout fetched user:", user);

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <UserProvider initUser={user}>
          {children}
        </UserProvider>
      </body>
    </html>
  );
}
