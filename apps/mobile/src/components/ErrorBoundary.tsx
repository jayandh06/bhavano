import { Component, type ErrorInfo, type ReactNode } from "react";
import Constants from "expo-constants";
import { reportClientError } from "../lib/bffClient";

/**
 * A render-time crash in `children` shows `fallback` instead of taking down everything above it
 * in the tree. React only offers this via a class component (`componentDidCatch`/
 * `getDerivedStateFromError`) — there is still no hooks equivalent.
 *
 * First use: wrapping `LocationMapPicker` in PostAdWizard's "details" step, where a missing/
 * invalid Google Maps API key can throw from `react-native-maps`' native view itself. That pin
 * picker is explicitly optional (the form already says so, and City/Area pickers sit right below
 * it as the real fallback), so a crash there shouldn't take the rest of the form down with it.
 *
 * Also now wraps the whole app in app/_layout.tsx, so `componentDidCatch` below (previously
 * missing — this boundary could only ever see *that* a child crashed, never the error itself) is
 * what feeds render-time crashes into the Loki-backed reporting added for
 * docs/plans/client-error-reporting-loki-grafana.md. A crash outside any render boundary (an
 * event handler, async code) is caught separately, by the ErrorUtils.setGlobalHandler in
 * _layout.tsx.
 */
export class ErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode; userId?: string | null },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    void reportClientError({
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack ?? undefined,
      appVersion: Constants.expoConfig?.version,
      userId: this.props.userId ?? undefined,
    });
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}
