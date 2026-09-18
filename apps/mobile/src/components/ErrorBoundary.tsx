import { Component, type ReactNode } from "react";

/**
 * A render-time crash in `children` shows `fallback` instead of taking down everything above it
 * in the tree. React only offers this via a class component (`componentDidCatch`/
 * `getDerivedStateFromError`) — there is still no hooks equivalent.
 *
 * First use: wrapping `LocationMapPicker` in PostAdWizard's "details" step, where a missing/
 * invalid Google Maps API key can throw from `react-native-maps`' native view itself. That pin
 * picker is explicitly optional (the form already says so, and City/Area pickers sit right below
 * it as the real fallback), so a crash there shouldn't take the rest of the form down with it.
 */
export class ErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}
