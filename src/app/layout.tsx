import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/providers/AuthContext";
import { AuthModal } from "@/components/auth/AuthModal";
import { Navbar } from "@/components/layout/Navbar";
import { BottomNav } from "@/components/layout/BottomNav";
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
