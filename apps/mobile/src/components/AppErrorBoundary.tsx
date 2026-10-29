import { Component, type ErrorInfo, type ReactNode } from "react";
import { CrashScreen } from "./CrashScreen";

// A React error boundary around the whole app, including the providers. expo-router also gives
// every route its own boundary (see the ErrorBoundary export in app/_layout.tsx); this one
// catches what happens outside any route, such as a crash while setting up the providers.
// It has to be a class: only class components can catch render errors.
export class AppErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // The one place to plug in crash reporting later (Sentry etc.).
    console.error("Unhandled app error", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return <CrashScreen error={this.state.error} onRetry={() => this.setState({ error: null })} />;
    }
    return this.props.children;
  }
}
