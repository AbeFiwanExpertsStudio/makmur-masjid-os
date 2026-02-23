import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/providers/AuthContext";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { Toaster } from "react-hot-toast";
import { AuthModal } from "@/components/auth/AuthModal";
import { Navbar } from "@/components/layout/Navbar";
import { BottomNav } from "@/components/layout/BottomNav";
import { GlobalBackground } from "@/components/layout/GlobalBackground";
import { createClient } from "@supabase/supabase-js";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const supabase = createClient(supabaseUrl, supabaseKey);

  let title = "Project Makmur";
  let description = "Centralized Mosque Operating System";

  try {
    const { data } = await supabase.from("system_settings").select("system_name, system_desc").eq("id", 1).single();
    if (data) {
      title = `${data.system_name} - ${data.system_desc}`;
      description = `Welcome to ${data.system_name} Platform`;
    }
  } catch (e) { }

  return {
    title,
    description,
    manifest: "/manifest.json",
  };
}

export const viewport: Viewport = {
  themeColor: "#3D6D63",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased islamic-pattern text-text bg-background transition-colors duration-300`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <AuthProvider>
            <GlobalBackground />
            <div className="flex flex-col min-h-screen pb-16 md:pb-0">
              <Navbar />
              <main className="flex-1 relative">
                {children}
              </main>
              <BottomNav />
            </div>
            <AuthModal />
            <Toaster
              position="top-center"
              toastOptions={{
                className: "bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-50 border border-slate-100 dark:border-slate-800",
                success: {
                  iconTheme: {
                    primary: "#059669", 
                    secondary: "white",
                  },
                },
                error: {
                  iconTheme: {
                    primary: "#f59e0b", 
                    secondary: "white",
                  },
                },
              }}
            />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
