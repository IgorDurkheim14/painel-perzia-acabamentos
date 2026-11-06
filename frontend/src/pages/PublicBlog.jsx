import { useEffect, useState } from 'react';
import { getPosts } from '../services/api.js';
import MarkdownContent from '../components/MarkdownContent.jsx';

const articleDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }).format(date);
};

export default function PublicBlog() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getPosts()
      .then((items) => { if (active) setPosts(items); })
      .catch(() => { if (active) setError('Não foi possível carregar os artigos agora.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return <main className="public-blog-page">
    <header className="public-blog-header">
      <a href="/blog" className="public-blog-brand" aria-label="Pérzia Acabamentos, início"><img src="/logo.png" alt="Pérzia Acabamentos" /></a>
      <nav><a className="public-active-link" href="/blog">Inspirações</a><a href="/admin">Painel</a></nav>
    </header>
    <section className="public-blog-hero">
      <p>JOURNAL PÉRZIA <span>•</span> ARQUITETURA & ACABAMENTOS</p>
      <h1>Espaços que contam<br /><em>histórias.</em></h1>
      <div className="hero-rule" />
      <p className="public-hero-description">Matéria, textura e intenção. Um olhar cuidadoso sobre os acabamentos que transformam ambientes em experiências.</p>
    </section>
    <section className="public-articles">
      <div className="public-section-heading"><div><p className="eyebrow">CADERNO PÉRZIA</p><h2>Ideias para viver melhor</h2></div><span>ARQUITETURA · INTERIORES · MATERIAIS</span></div>
      {loading && <p className="public-blog-message">Carregando artigos…</p>}
      {error && <p className="public-blog-message public-blog-error">{error}</p>}
      {!loading && !error && posts.length === 0 && <div className="public-blog-message">Novas inspirações em breve.</div>}
      <div className="public-post-grid">{posts.map((post, index) => <article className={`public-post-card public-post-tone-${index % 3}`} key={post.id}>
        <div className="public-post-art"><span>{post.categoria || 'Arquitetura'}</span><b>P.</b><small>PÉRZIA ACABAMENTOS</small></div>
        <div className="public-post-copy"><p className="public-post-date">{articleDate(post.publicadoEm || post.criadoEm)} <span>·</span> {post.autor || 'Pérzia Acabamentos'}</p><h3>{post.titulo}</h3><p className="public-post-summary">{post.resumo || post.conteudo}</p><details><summary>Ler artigo <span>↗</span></summary><div className="public-post-content"><MarkdownContent content={post.conteudo} /></div></details></div>
      </article>)}</div>
    </section>
    <footer className="public-blog-footer"><img src="/logo.png" alt="Pérzia Acabamentos" /><span>Materiais com presença. Espaços com propósito.</span><small>© {new Date().getFullYear()} Pérzia Acabamentos</small></footer>
  </main>;
}
