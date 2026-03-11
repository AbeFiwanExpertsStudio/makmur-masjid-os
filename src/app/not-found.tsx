"use client";

import Link from "next/link";
import { Ghost, Home, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-6 text-center bg-background">
      <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center relative">
        <Ghost size={40} className="text-primary animate-bounce" />
      </div>
      
      <div>
        <h1 className="text-4xl font-black text-text tracking-tight mb-2">404</h1>
        <h2 className="text-xl font-bold text-text mb-2">Page Not Found</h2>
        <p className="text-sm text-text-muted max-w-sm mx-auto">
          We couldn't find the page you're looking for. It might have been moved or doesn't exist.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-3 mt-4 w-full sm:w-auto">
        <button
          onClick={() => router.back()}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-border text-text font-semibold hover:bg-surface transition-colors"
        >
          <ArrowLeft size={16} />
          Go Back
        </button>
        <Link
          href="/"
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 btn-primary font-semibold"
        >
          <Home size={16} />
          Back Home
        </Link>
      </div>
    </div>
  );
}
