import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/providers/AuthContext";
import { AuthModal } from "@/components/auth/AuthModal";
import { Navbar } from "@/components/layout/Navbar";
import { BottomNav } from "@/components/layout/BottomNav";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Project Makmur - Mosque OS",
  description: "Centralized Mosque Operating System for Ramadan",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#3D6D63",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased islamic-pattern`}>
        <AuthProvider>
          <div className="flex flex-col min-h-screen pb-16 md:pb-0">
            <Navbar />
            <main className="flex-1 relative">
              {children}
            </main>
            <BottomNav />
          </div>
          <AuthModal />
        </AuthProvider>
      </body>
    </html>
  );
}
