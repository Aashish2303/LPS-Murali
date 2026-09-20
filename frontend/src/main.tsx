import {Component, StrictMode, type ReactNode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

class ErrorBoundary extends Component<
  {children: ReactNode},
  {error: Error | null}
> {
  state = {error: null as Error | null};

  static getDerivedStateFromError(error: Error) {
    return {error};
  }

  componentDidCatch(error: Error) {
    console.error('Render error:', error);
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <div style={{padding: 24, color: '#f8fafc', background: '#0f172a', minHeight: '100vh'}}>
        <h2 style={{color: '#ef4444', fontWeight: 700}}>Something went wrong</h2>
        <pre style={{whiteSpace: 'pre-wrap', marginTop: 12, fontSize: 12}}>
          {this.state.error.stack || this.state.error.message}
        </pre>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{marginTop: 16, padding: '8px 16px', background: '#f59e0b', color: '#0f172a', fontWeight: 700, borderRadius: 8}}
        >
          Reload
        </button>
      </div>
    );
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
