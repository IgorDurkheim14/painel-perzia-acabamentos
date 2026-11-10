import { Component } from 'react';
import Dashboard from './pages/Dashboard.jsx';
import PublicBlog from './pages/PublicBlog.jsx';

class ErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('Falha inesperada ao renderizar a aplicação:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main role="alert" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#f7f5f2', fontFamily: 'system-ui, sans-serif' }}>
          <section style={{ maxWidth: 460, padding: 32, border: '1px solid #e8e1db', borderRadius: 14, background: '#fff', textAlign: 'center', boxShadow: '0 12px 40px #39271912' }}>
            <p style={{ margin: '0 0 8px', color: '#a5664b', fontSize: 12, fontWeight: 700, letterSpacing: 1 }}>PÉRZIA ACABAMENTOS</p>
            <h1 style={{ margin: '0 0 10px', color: '#342a25', fontSize: 23 }}>Não foi possível abrir o painel</h1>
            <p style={{ margin: '0 0 22px', color: '#756a62', fontSize: 14, lineHeight: 1.6 }}>Ocorreu um erro inesperado ao carregar esta página. Tente recarregá-la.</p>
            <button type="button" onClick={() => window.location.reload()} style={{ border: 0, borderRadius: 8, padding: '11px 18px', background: '#a5664b', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Recarregar página</button>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      {window.location.pathname === '/blog' ? <PublicBlog /> : <Dashboard />}
    </ErrorBoundary>
  );
}
