import { Component, type ReactNode } from 'react';

// Catches render/lifecycle errors in a page so one broken screen shows a fallback
// instead of blanking the whole app. Give it a `resetKey` (e.g. current page) so
// navigating to another screen clears the error state.
interface Props { children: ReactNode; resetKey?: string }
interface State { error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidUpdate(prev: Props) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  componentDidCatch(error: Error, info: unknown) {
    console.error('Sidan kraschade:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex-1 min-h-[60vh] flex items-center justify-center p-8">
          <div className="vh-card max-w-md w-full p-7 text-center">
            <div className="vh-tile vh-tile--coral w-12 h-12 mx-auto mb-4 flex items-center justify-center">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="#1a1206" aria-hidden="true">
                <path d="M12 2 1 21h22L12 2zm0 6 6.5 11h-13L12 8zm-1 4v3h2v-3h-2zm0 4v2h2v-2h-2z" />
              </svg>
            </div>
            <h2 className="font-display text-xl text-ink mb-1">Något gick fel här</h2>
            <p className="text-sm text-mut mb-5">
              Den här vyn kraschade, men resten av appen fungerar. Byt flik eller försök igen.
            </p>
            <button
              onClick={() => this.setState({ error: null })}
              className="font-semibold text-sm rounded-xl px-5 py-2.5 text-[#2a1d08]"
              style={{ background: 'linear-gradient(135deg,#f4d79a,#cf9a3f)' }}
            >
              Försök igen
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
