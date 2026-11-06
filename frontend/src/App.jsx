import Dashboard from './pages/Dashboard.jsx';
import PublicBlog from './pages/PublicBlog.jsx';

export default function App() {
  return window.location.pathname === '/blog' ? <PublicBlog /> : <Dashboard />;
}
