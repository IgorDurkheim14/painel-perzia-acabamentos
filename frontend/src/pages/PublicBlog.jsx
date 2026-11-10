import { useEffect, useState } from 'react';
import { createContact, getPosts } from '../services/api.js';
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
  const [contact, setContact] = useState({ nome: '', telefone: '', email: '', interesse: '' });
  const [contactState, setContactState] = useState({ loading: false, error: '', success: false });

  useEffect(() => {
    let active = true;
    getPosts()
      .then((items) => { if (active) setPosts(items); })
      .catch(() => { if (active) setError('Não foi possível carregar os artigos agora.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function submitContact(event) {
    event.preventDefault();
    setContactState({ loading: true, error: '', success: false });
    try {
      await createContact({ ...contact, origem: 'blog' });
      setContact({ nome: '', telefone: '', email: '', interesse: '' });
      setContactState({ loading: false, error: '', success: true });
    } catch (requestError) {
      setContactState({ loading: false, error: requestError.message || 'Não foi possível enviar seus dados agora.', success: false });
    }
  }

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
      <div className="public-post-grid">{(Array.isArray(posts) ? posts : []).map((post, index) => <article className={`public-post-card public-post-tone-${index % 3}`} key={post.id}>
        <div className="public-post-art"><span>{post.categoria || 'Arquitetura'}</span><b>P.</b><small>PÉRZIA ACABAMENTOS</small></div>
        <div className="public-post-copy"><p className="public-post-date">{articleDate(post.publicadoEm || post.criadoEm)} <span>·</span> {post.autor || 'Pérzia Acabamentos'}</p><h3>{post.titulo}</h3><p className="public-post-summary">{post.resumo || post.conteudo}</p><details><summary>Ler artigo <span>↗</span></summary><div className="public-post-content"><MarkdownContent content={post.conteudo} /></div></details></div>
      </article>)}</div>
    </section>
    <section className="public-contact-section" id="contato">
      <div className="public-contact-intro"><p className="eyebrow">FALE COM A PÉRZIA</p><h2>Seu próximo ambiente começa com uma conversa.</h2><p>Deixe seu contato e nossa equipe comercial fala com você pelo WhatsApp.</p></div>
      <form className="public-contact-form" onSubmit={submitContact}>
        {contactState.error && <p className="form-error" role="alert">{contactState.error}</p>}
        {contactState.success && <p className="form-success" role="status">Contato recebido. Nossa equipe entrará em contato pelo WhatsApp.</p>}
        <label>Seu nome<input required minLength={2} maxLength={120} autoComplete="name" value={contact.nome} onChange={(event) => setContact({ ...contact, nome: event.target.value })} /></label>
        <label>WhatsApp com DDD<input required type="tel" inputMode="tel" autoComplete="tel" placeholder="(62) 99999-9999" value={contact.telefone} onChange={(event) => setContact({ ...contact, telefone: event.target.value })} /></label>
        <label>E-mail <span>(opcional)</span><input type="email" autoComplete="email" value={contact.email} onChange={(event) => setContact({ ...contact, email: event.target.value })} /></label>
        <label>O que você procura? <span>(opcional)</span><textarea rows="3" maxLength={500} value={contact.interesse} onChange={(event) => setContact({ ...contact, interesse: event.target.value })} placeholder="Conte um pouco sobre seu projeto" /></label>
        <button className="button button-primary" disabled={contactState.loading}>{contactState.loading ? 'Enviando…' : 'Quero conversar pelo WhatsApp'}</button>
      </form>
    </section>
    <footer className="public-blog-footer"><img src="/logo.png" alt="Pérzia Acabamentos" /><span>Materiais com presença. Espaços com propósito.</span><small>© {new Date().getFullYear()} Pérzia Acabamentos</small></footer>
  </main>;
}
