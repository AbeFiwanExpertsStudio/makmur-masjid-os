"use client";

import React, { Component, type ReactNode, type ErrorInfo } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  /** Optional custom fallback — receives error and a reset() function */
  fallback?: (error: Error, reset: () => void) => ReactNode;
  /** Display name used in the error message (e.g. "Prayer Times") */
  section?: string;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    const { children, fallback, section } = this.props;

    if (error) {
      if (fallback) return fallback(error, this.reset);

      return (
        <div className="flex flex-col items-center justify-center gap-4 py-16 px-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
            <AlertTriangle size={28} className="text-red-500" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-text mb-1">
              {section ? `${section} failed to load` : "Something went wrong"}
            </h2>
            <p className="text-sm text-text-muted max-w-xs">
              {error.message || "An unexpected error occurred. Please try again."}
            </p>
          </div>
          <button
            onClick={this.reset}
            className="flex items-center gap-2 px-5 py-2 btn-primary text-sm"
          >
            <RefreshCw size={14} />
            Try again
          </button>
        </div>
      );
    }

    return children;
  }
}
