
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // You can also log the error to an error reporting service
    console.error("Uncaught error in ErrorBoundary:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-secondary-100 p-4 text-center" role="alert">
          <img src="https://tailwindui.com/img/logos/mark.svg?color=red&shade=600" alt="Error" className="h-12 w-auto mb-4" />
          <h1 className="text-2xl font-bold text-red-700 mb-4">Oops! Something went wrong.</h1>
          <p className="text-secondary-700 mb-2">
            We're sorry for the inconvenience. An unexpected error occurred.
          </p>
          <p className="text-secondary-600 mb-6">
            Please try refreshing the page. If the problem persists, please contact support.
          </p>
          {this.state.error && (
             <pre className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-left text-xs text-red-700 overflow-auto max-h-48">
                {this.state.error.toString()}
             </pre>
          )}
          <button
            onClick={() => window.location.reload()}
            className="mt-8 px-6 py-2 bg-primary-600 text-white font-semibold rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors"
          >
            Refresh Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;