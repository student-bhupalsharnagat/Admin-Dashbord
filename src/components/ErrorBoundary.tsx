import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught component error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-6 text-center bg-[#070e1b] border border-rose-500/30 rounded-2xl max-w-xl mx-auto my-8 shadow-2xl space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
            <AlertTriangle size={28} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">
              {this.props.fallbackTitle || 'Section Display Notice'}
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto leading-relaxed">
              An unexpected display issue occurred in this section. The platform remains fully operational.
            </p>
            {this.state.error && (
              <div className="mt-3 p-2.5 bg-black/40 border border-white/5 rounded-lg text-left overflow-auto max-h-32 text-[11px] font-mono text-rose-300">
                {this.state.error.message}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={this.handleReset}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-md shadow-blue-600/20 active:scale-95"
            >
              <RefreshCw size={14} />
              <span>Retry Section</span>
            </button>
            <button
              type="button"
              onClick={() => {
                this.handleReset();
                window.location.reload();
              }}
              className="px-4 py-2 bg-[#121d33] hover:bg-[#182745] text-slate-300 hover:text-white text-xs font-semibold rounded-xl border border-slate-700/60 flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
            >
              <Home size={14} />
              <span>Reload Page</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
