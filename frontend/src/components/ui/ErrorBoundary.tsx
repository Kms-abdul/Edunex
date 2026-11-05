import React from 'react';
import { AlertTriangle, RotateCw, Home } from 'lucide-react';

interface Props { children: React.ReactNode; onHome?: () => void }
interface State { error: Error | null }

/**
 * Keeps one broken screen from blanking the whole app: shows a friendly message
 * with "Try again" / "Go to Home" while the menu and header keep working.
 */
class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Screen error:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="p-4 sm:p-6">
        <div className="card mx-auto max-w-lg p-6 text-center">
          <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
            <AlertTriangle className="h-6 w-6" />
          </span>
          <h2 className="text-base font-semibold text-slate-900">This screen had a problem</h2>
          <p className="mt-1 text-sm text-slate-600">The rest of the app still works. Try again, or go back to Home.</p>
          <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-left text-xs text-slate-500 break-words">{this.state.error.message}</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button type="button" className="btn-primary" onClick={() => this.setState({ error: null })}>
              <RotateCw className="h-4 w-4" /> Try again
            </button>
            {this.props.onHome && (
              <button type="button" className="btn-secondary" onClick={() => { this.setState({ error: null }); this.props.onHome?.(); }}>
                <Home className="h-4 w-4" /> Go to Home
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
