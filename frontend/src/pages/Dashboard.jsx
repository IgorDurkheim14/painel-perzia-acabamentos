import { useCallback, useEffect, useMemo, useState } from 'react';
import { closeClientDeal, createClient, createPost, generatePost, getCommercialData, getContacts, getPosts, updateClient, updatePost } from '../services/api.js';
import WidgetClima from '../components/WidgetClima.jsx';
import MarkdownContent from '../components/MarkdownContent.jsx';
import SalesDashboard from '../components/SalesDashboard.jsx';
import { getClientPhone, getWhatsAppUrl } from '../services/whatsapp.js';

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const dateFormatter = new Intl.DateTimeFormat('pt-BR');
const asArray = (value) => Array.isArray(value) ? value : [];
const dateText = (value) => {
  if (!value) return '—';
  const brMatch = typeof value === 'string' && value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const isoMatch = typeof value === 'string' && value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const date = brMatch ? new Date(Number(brMatch[3]), Number(brMatch[2]) - 1, Number(brMatch[1])) : isoMatch ? new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3])) : new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : dateFormatter.format(date);
};

function clientContact(client) {
  const row = client.dadosPlanilha || {};
  const phone = [row['DDD 1'], row['TELEFONE 1']].filter(Boolean).join(' ');
  const city = [row.CIDADE, row.UF].filter(Boolean).join(' / ');
  return [phone, row['EMAIL 1'], city].filter(Boolean).join(' · ') || 'Dados de contato não informados.';
}

function displayCity(value) {
  if (!value) return 'Localização não informada';
  const [city, state] = String(value).split(' - ');
  const knownCities = { GOIANIA: 'Goiânia', ANAPOLIS: 'Anápolis', 'APARECIDA DE GOIANIA': 'Aparecida de Goiânia', 'SENADOR CANEDO': 'Senador Canedo', 'RIO VERDE': 'Rio Verde', 'CALDAS NOVAS': 'Caldas Novas' };
  const cityKey = city.toLocaleUpperCase('pt-BR');
  const formattedCity = knownCities[cityKey] || city.toLocaleLowerCase('pt-BR').replace(/(^|[\s-])([a-zá-ú])/giu, (_match, gap, letter) => `${gap}${letter.toLocaleUpperCase('pt-BR')}`);
  return state ? `${formattedCity} - ${state.toLocaleUpperCase('pt-BR')}` : formattedCity;
}

function Icon({ children }) { return <span className="nav-symbol" aria-hidden="true">{children}</span>; }

function Modal({ title, eyebrow, onClose, children }) {
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="modal-card" role="dialog" aria-modal="true" aria-label={title}>
      <button className="modal-close" type="button" onClick={onClose} aria-label="Fechar">×</button>
      <p className="eyebrow">{eyebrow}</p><h2>{title}</h2>{children}
    </section>
  </div>;
}

function ClientCard({ client, onDetails, onCloseDeal }) {
  const whatsappUrl = getWhatsAppUrl(getClientPhone(client), `Olá, ${client.nome}! Aqui é da Pérzia Acabamentos. Podemos conversar sobre seu projeto?`);
  return <article className="crm-client-card" role="button" tabIndex={0} onClick={() => onDetails(client)} onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onDetails(client); } }}>
    <div className="client-card-top"><span className="client-type">{client.tipo || 'Residencial'}</span><span className={`client-status ${client.categoria === 'clientes_ativos' ? 'active-status' : ''}`}>{client.status || 'Novo cadastro'}</span></div>
    <h3>{client.nome}</h3>
    <p className="client-city">{displayCity(client.cidade)}</p>
    <p className="client-project">{client.projeto || 'Projeto ainda não informado'}</p>
    <div className="client-card-bottom"><span>{client.categoria === 'clientes_ativos' ? currency.format(client.valor || 0) : 'R$ 0,00'}</span><span>{dateText(client.criadoEm)}</span></div>
    {whatsappUrl && <a className="button button-whatsapp crm-whatsapp-button" href={whatsappUrl} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}><span aria-hidden="true">◉</span> Conversar no WhatsApp</a>}
    {client.categoria === 'prospects' && <button className="button button-outline close-deal-button" type="button" onClick={(event) => { event.stopPropagation(); onCloseDeal(client); }}>Fechar negócio <span>↗</span></button>}
  </article>;
}

export default function Dashboard() {
  const [section, setSection] = useState('sales');
  const [data, setData] = useState(null);
  const [posts, setPosts] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loadingError, setLoadingError] = useState('');
  const [modal, setModal] = useState('');
  const [selectedClient, setSelectedClient] = useState(null);
  const [notice, setNotice] = useState('');
  const [modalError, setModalError] = useState('');
  const [saving, setSaving] = useState(false);
  const [clientForm, setClientForm] = useState({ Nome: '', Tipo: 'Residencial', Status: 'Novo cadastro', Projeto: '', Cidade: '', Telefone: '', Email: '' });
  const [dealValue, setDealValue] = useState('');
  const [postForm, setPostForm] = useState({ titulo: '', categoria: 'Tendências', resumo: '', conteudo: '', status: 'publicado' });
  const [generatorForm, setGeneratorForm] = useState({ tema: '', publico: 'Residencial de Luxo', incluirArkos: true });
  const [editingPost, setEditingPost] = useState(null);
  const [editForm, setEditForm] = useState({ Nome: '', Tipo: 'Residencial', Status: '', Projeto: '', Cidade: '', Telefone: '', Email: '' });
  const [relationshipForm, setRelationshipForm] = useState({ tipoCompra: 'Venda Direta', observacoes: '' });
  const [relationshipSaved, setRelationshipSaved] = useState(false);
  const [search, setSearch] = useState('');

  const refreshClients = useCallback(() => getCommercialData().then(setData), []);
  const refreshPosts = useCallback(() => getPosts(true).then(setPosts), []);
  const refreshContacts = useCallback(() => getContacts().then(setContacts), []);
  useEffect(() => {
    Promise.all([refreshClients(), refreshPosts(), refreshContacts()]).catch(() => setLoadingError('Não foi possível conectar à API. Verifique se o backend está online.'));
  }, [refreshClients, refreshPosts, refreshContacts]);

  const prospects = asArray(data?.prospects);
  const activeClients = asArray(data?.clientes_ativos);
  const filteredProspects = useMemo(() => prospects.filter((client) => client.nome?.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'))), [prospects, search]);
  const filteredActive = useMemo(() => activeClients.filter((client) => client.nome?.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'))), [activeClients, search]);
  const totalRevenue = activeClients.reduce((sum, client) => sum + Number(client.valor || 0), 0);
  const safePosts = asArray(posts);
  const safeContacts = asArray(contacts);
  const draftPosts = safePosts.filter((post) => post.status === 'rascunho');
  const approvedPosts = safePosts.filter((post) => post.status === 'aprovado');
  const publishedPosts = safePosts.filter((post) => post.status === 'publicado');
  const selectedClientWhatsApp = selectedClient && getWhatsAppUrl(getClientPhone(selectedClient), `Olá, ${selectedClient.nome}! Aqui é da Pérzia Acabamentos. Podemos conversar sobre seu projeto?`);

  async function submitClient(event) {
    event.preventDefault(); setSaving(true); setNotice('');
    try { await createClient(clientForm); await refreshClients(); setClientForm({ Nome: '', Tipo: 'Residencial', Status: 'Novo cadastro', Projeto: '', Cidade: '', Telefone: '', Email: '' }); setModal(''); setNotice('Cadastro criado com sucesso.'); }
    catch (error) { setModalError(error.message || 'Não foi possível criar o cadastro.'); }
    finally { setSaving(false); }
  }

  async function submitDeal(event) {
    event.preventDefault(); if (!selectedClient) return; setSaving(true); setNotice('');
    try { await closeClientDeal(selectedClient.id, Number(String(dealValue).replace(',', '.'))); await refreshClients(); setSelectedClient(null); setModal(''); setDealValue(''); setNotice('Negócio fechado e relacionamento atualizado.'); }
    catch (error) { setModalError(error.message || 'Não foi possível fechar o negócio.'); }
    finally { setSaving(false); }
  }

  async function submitEdit(event) {
    event.preventDefault(); if (!selectedClient) return; setSaving(true); setModalError('');
    try { const updated = await updateClient(selectedClient.id, editForm); await refreshClients(); setSelectedClient(updated); setModal('details'); setNotice('Cadastro atualizado.'); }
    catch (error) { setModalError(error.message || 'Não foi possível atualizar o cadastro.'); }
    finally { setSaving(false); }
  }

  async function submitRelationship(event) {
    event.preventDefault(); if (!selectedClient) return; setSaving(true); setModalError('');
    try {
      const updated = await updateClient(selectedClient.id, relationshipForm);
      await refreshClients(); setSelectedClient(updated); setRelationshipForm({ tipoCompra: updated.tipoCompra, observacoes: updated.observacoes || '' }); setRelationshipSaved(true); setNotice('Relacionamento atualizado.');
    } catch (error) { setModalError(error.message || 'Não foi possível salvar as informações.'); }
    finally { setSaving(false); }
  }

  async function submitPost(event) {
    event.preventDefault(); setSaving(true); setNotice('');
    try {
      if (editingPost) await updatePost(editingPost.id, postForm);
      else await createPost(postForm);
      await refreshPosts();
      setPostForm({ titulo: '', categoria: 'Tendências', resumo: '', conteudo: '', status: 'publicado' });
      setEditingPost(null); setModal('');
      setNotice(postForm.status === 'publicado' ? 'Artigo publicado.' : 'Rascunho salvo.');
    }
    catch (error) { setModalError(error.message || 'Não foi possível publicar o artigo.'); }
    finally { setSaving(false); }
  }

  async function submitGeneratedPost(event) {
    event.preventDefault(); setSaving(true); setModalError(''); setNotice('');
    try {
      const article = await generatePost(generatorForm);
      await createPost({ ...article, autor: 'Pérzia Acabamentos · IA', status: 'rascunho' });
      await refreshPosts(); setModal(''); setGeneratorForm({ tema: '', publico: 'Residencial de Luxo', incluirArkos: true });
      setNotice('Rascunho gerado e enviado para aprovação na Gestão de Conteúdo.');
    } catch (error) { setModalError(error.message || 'Não foi possível gerar o artigo.'); }
    finally { setSaving(false); }
  }

  async function changePostStatus(post, status) {
    setSaving(true); setModalError('');
    try {
      await updatePost(post.id, { status });
      await refreshPosts();
      setNotice(status === 'aprovado' ? `“${post.titulo}” aprovado. Você já pode publicar.` : `“${post.titulo}” publicado no Blog Público.`);
    } catch (error) { setNotice(error.message || 'Não foi possível atualizar o artigo.'); }
    finally { setSaving(false); }
  }

  function showCloseDeal(client) { setSelectedClient(client); setModalError(''); setModal('deal'); }
  function openClient(client) { setSelectedClient(client); setRelationshipForm({ tipoCompra: client.tipoCompra || 'Venda Direta', observacoes: client.observacoes || '' }); setRelationshipSaved(false); setModalError(''); setModal('details'); }
  function editSelectedClient() {
    if (!selectedClient) return;
    setEditForm({ Nome: selectedClient.nome || '', Tipo: selectedClient.tipo || 'Residencial', Status: selectedClient.status || '', Projeto: selectedClient.projeto || '', Cidade: selectedClient.cidade || '', Telefone: getClientPhone(selectedClient), Email: selectedClient.email || selectedClient.dadosPlanilha?.['E-mail'] || '' });
    setModalError(''); setModal('edit');
  }
  function openPostEditor(post = null) {
    setEditingPost(post);
    setPostForm(post ? { titulo: post.titulo, categoria: post.categoria, resumo: post.resumo, conteudo: post.conteudo, status: post.status } : { titulo: '', categoria: 'Tendências', resumo: '', conteudo: '', status: 'publicado' });
    setModalError(''); setModal('post');
  }

  return <main className="commercial-shell">
    <aside className="sidebar">
      <a className="brand" href="#inicio" aria-label="Pérzia Acabamentos início"><img className="brand-logo" src="/logo.png" alt="Pérzia Acabamentos" /></a>
      <p className="nav-caption">PLATAFORMA</p>
      <button className={`nav-item ${section === 'sales' ? 'active' : ''}`} onClick={() => setSection('sales')}><Icon>↗</Icon>Dashboard de Vendas</button>
      <button className={`nav-item ${section === 'crm' ? 'active' : ''}`} onClick={() => setSection('crm')}><Icon>▦</Icon>Dashboard Comercial</button>
      <button className={`nav-item ${section === 'blog' ? 'active' : ''}`} onClick={() => setSection('blog')}><Icon>✳</Icon>Blog de Arquitetura</button>
      <button className={`nav-item ${section === 'content' ? 'active' : ''}`} onClick={() => setSection('content')}><Icon>✎</Icon>Gestão de Conteúdo</button>
      <div className="sidebar-note"><span className="note-dot" /> CRM + Conteúdo</div>
      <div className="sidebar-bottom"><span className="avatar">P</span><div><strong>Equipe Pérzia</strong><small>Relacionamento comercial</small></div></div>
    </aside>

    <section className="main-area">
      <header className="topbar"><span>{section === 'crm' ? 'Painel Comercial' : section === 'sales' ? 'Visão de Vendas' : section === 'content' ? 'Conteúdo e contatos' : 'Conteúdo e inspiração'}</span><div className="topbar-meta"><span className="topbar-date">Pérzia Acabamentos <span className="topbar-dot">•</span> Goiânia, GO</span><WidgetClima /></div></header>
      <div className="page-content">
        <div className="page-heading">
          <div><p className="eyebrow">{section === 'crm' ? 'RELACIONAMENTO E VENDAS' : section === 'sales' ? 'DADOS DA PLANILHA COMERCIAL' : section === 'content' ? 'REVISÃO EDITORIAL' : 'REVISTA PÉRZIA'}</p><h1>{section === 'crm' ? 'Dashboard Comercial' : section === 'sales' ? 'Dashboard de Vendas' : section === 'content' ? 'Gestão de Conteúdo' : 'Blog de Arquitetura'}</h1><p className="muted">{section === 'crm' ? 'Acompanhe oportunidades e cultive relacionamentos.' : section === 'sales' ? 'Acompanhe faturamento, clientes e vendas em tempo real.' : section === 'content' ? 'Revise os artigos gerados por IA e gerencie os contatos do blog.' : 'Ideias, materiais e tendências para espaços com personalidade.'}</p></div>
          <div className="heading-actions">{section === 'blog' && <><a className="button button-outline" href="/blog">Ver blog público ↗</a><button className="button button-outline" onClick={() => { setModalError(''); setGeneratorForm({ tema: '', publico: 'Residencial de Luxo', incluirArkos: true }); setModal('generator'); }}>✦ Gerar Artigo com IA</button></>}{section === 'crm' && <button className="button button-primary new-button" onClick={() => { setNotice(''); setModalError(''); setModal('client'); }}><span>＋</span> Novo cadastro</button>}{section === 'blog' && <button className="button button-primary new-button" onClick={() => { setNotice(''); setModalError(''); openPostEditor(); }}><span>＋</span> Novo artigo</button>}{section === 'content' && <button className="button button-primary" onClick={() => { setModalError(''); setGeneratorForm({ tema: '', publico: 'Residencial de Luxo', incluirArkos: true }); setModal('generator'); }}>✦ Gerar rascunho com IA</button>}</div>
        </div>
        {loadingError && <div className="error-banner" role="alert">{loadingError}</div>}
        {notice && <div className="notice-banner" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Dispensar">×</button></div>}

        {section === 'sales' ? <SalesDashboard /> : section === 'crm' ? <>
          <section className="summary-grid crm-summary">
            <article className="summary-card"><div className="summary-top"><span>Relacionamentos</span><span className="summary-mark">♧</span></div><strong>{data ? (prospects.length + activeClients.length).toLocaleString('pt-BR') : '—'}</strong><small>Na base comercial</small></article>
            <article className="summary-card"><div className="summary-top"><span>Sem compras</span><span className="summary-mark">＋</span></div><strong>{data ? prospects.length.toLocaleString('pt-BR') : '—'}</strong><small>Novas oportunidades</small></article>
            <article className="summary-card"><div className="summary-top"><span>Relacionamentos ativos</span><span className="summary-mark">↗</span></div><strong>{data ? activeClients.length.toLocaleString('pt-BR') : '—'}</strong><small>Com compras realizadas</small></article>
            <article className="summary-card"><div className="summary-top"><span>Faturamento registrado</span><span className="summary-mark">R$</span></div><strong>{data ? currency.format(totalRevenue) : '—'}</strong><small>Valor acumulado dos negócios</small></article>
          </section>
          <section className="board-section">
            <div className="board-heading"><div><p className="eyebrow">PIPELINE DE RELACIONAMENTO</p><h2>Clientes e oportunidades</h2></div><label className="search-box"><span aria-hidden="true">⌕</span><input type="search" placeholder="Buscar cliente..." value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Buscar clientes pelo nome" /></label></div>
            <div className="crm-board">
              <section className="crm-column"><div className="column-heading"><div><span className="column-indicator prospect-indicator"/><div><h3>Sem Compras</h3><small>Cadastros / R$ 0,00</small></div></div><span className="column-count">{filteredProspects.length}</span></div>
                <div className="client-card-list">{!data ? <p className="empty-state">Carregando cadastros…</p> : (Array.isArray(filteredProspects) ? filteredProspects : []).map((client) => <ClientCard key={client.id} client={client} onDetails={openClient} onCloseDeal={showCloseDeal} />)}
                  {data && filteredProspects.length === 0 && <p className="empty-state">Nenhum prospect nesta busca.</p>}</div>
              </section>
              <section className="crm-column"><div className="column-heading"><div><span className="column-indicator active-indicator"/><div><h3>Relacionamentos Ativos</h3><small>Com compras realizadas</small></div></div><span className="column-count">{filteredActive.length}</span></div>
                <div className="client-card-list">{!data ? <p className="empty-state">Carregando clientes…</p> : (Array.isArray(filteredActive) ? filteredActive : []).map((client) => <ClientCard key={client.id} client={client} onDetails={openClient} onCloseDeal={showCloseDeal} />)}
                  {data && filteredActive.length === 0 && <p className="empty-state">Nenhum relacionamento ativo nesta busca.</p>}</div>
              </section>
            </div>
          </section>
        </> : section === 'content' ? <section className="content-management">
          <div className="content-stats"><article><strong>{draftPosts.length}</strong><span>Rascunhos para revisar</span></article><article><strong>{approvedPosts.length}</strong><span>Aprovados para publicar</span></article><article><strong>{publishedPosts.length}</strong><span>Artigos publicados</span></article></div>
          <div className="content-management-grid">
            <section className="content-column"><div className="content-column-heading"><div><p className="eyebrow">REVISÃO EDITORIAL</p><h2>Rascunhos de artigos</h2></div><span>{draftPosts.length}</span></div>
              {draftPosts.length ? <div className="managed-post-list">{(Array.isArray(draftPosts) ? draftPosts : []).map((post) => <article className="managed-post-card" key={post.id}><div className="managed-post-meta"><span>{post.categoria || 'Arquitetura e acabamentos'}</span><span className="post-status rascunho">Rascunho · {post.autor || 'Pérzia'}</span></div><h3>{post.titulo}</h3><p>{post.resumo || post.conteudo}</p><details><summary>Pré-visualizar artigo</summary><div className="post-content"><MarkdownContent content={post.conteudo} /></div></details><div className="managed-post-actions"><button className="button button-outline" onClick={() => openPostEditor(post)}>Editar</button><button className="button button-outline" disabled={saving} onClick={() => changePostStatus(post, 'aprovado')}>Aprovar</button><button className="button button-primary" disabled={saving} onClick={() => changePostStatus(post, 'publicado')}>Publicar</button></div></article>)}</div> : <div className="content-empty"><span>✳</span><h3>Nenhum rascunho aguardando</h3><p>Gere um artigo com IA para criar um rascunho sobre acabamentos.</p><button className="button button-outline" onClick={() => { setModalError(''); setGeneratorForm({ tema: '', publico: 'Residencial de Luxo', incluirArkos: true }); setModal('generator'); }}>Gerar rascunho com IA</button></div>}
            </section>
            <div className="content-side-columns">
              <section className="content-column"><div className="content-column-heading"><div><p className="eyebrow">PRONTO PARA IR AO AR</p><h2>Conteúdo aprovado</h2></div><span>{approvedPosts.length}</span></div>
                {approvedPosts.length ? <div className="managed-post-list">{(Array.isArray(approvedPosts) ? approvedPosts : []).map((post) => <article className="managed-post-card approved-post" key={post.id}><div className="managed-post-meta"><span>{post.categoria || 'Arquitetura e acabamentos'}</span><span className="post-status aprovado">Aprovado</span></div><h3>{post.titulo}</h3><p>{post.resumo || post.conteudo}</p><button className="button button-primary" disabled={saving} onClick={() => changePostStatus(post, 'publicado')}>Publicar no Blog Público</button></article>)}</div> : <p className="content-quiet-empty">Artigos aprovados aparecerão aqui para publicação.</p>}
              </section>
              <section className="content-column"><div className="content-column-heading"><div><p className="eyebrow">LEADS DO BLOG E CRM</p><h2>Contatos recebidos</h2></div><span>{contacts.length}</span></div>
                {safeContacts.length ? <div className="blog-lead-list">{(Array.isArray(safeContacts) ? safeContacts : []).map((contact) => { const whatsapp = getWhatsAppUrl(contact.telefone, `Olá, ${contact.nome}! Aqui é da Pérzia Acabamentos. Recebemos seu contato pelo ${contact.origem === 'crm' ? 'CRM' : 'blog'}${contact.interesse ? ` sobre ${contact.interesse}` : ''}. Como podemos ajudar?`); return <article className="blog-lead-card" key={contact.id}><div><strong>{contact.nome}</strong><span>{contact.origem === 'crm' ? 'CRM' : 'Blog'} · {contact.email || 'Sem e-mail informado'} · {dateText(contact.criadoEm)}</span>{contact.interesse && <p>{contact.interesse}</p>}</div>{whatsapp && <a className="button button-whatsapp" href={whatsapp} target="_blank" rel="noreferrer">WhatsApp ↗</a>}</article>; })}</div> : <p className="content-quiet-empty">Os contatos enviados pelos formulários do blog e do CRM aparecerão aqui.</p>}
              </section>
            </div>
          </div>
        </section> : <section className="blog-section">
          <div className="blog-intro"><div><p className="eyebrow">CADERNO DE MATERIAIS</p><h2>Arquitetura que se sente</h2><p className="muted">Referências e conhecimento para escolher acabamentos que atravessam o tempo.</p></div><span className="blog-ornament">P.</span></div>
          {!safePosts.length ? <div className="blog-empty"><span>✳</span><h3>Um espaço para boas ideias</h3><p>Publique tendências, projetos e dicas de acabamentos para inspirar seus clientes.</p><button className="button button-outline" onClick={() => openPostEditor()}>Escrever primeiro artigo</button></div> : <div className="post-grid">{(Array.isArray(safePosts) ? safePosts : []).map((post) => <article className="post-card" key={post.id}><div className="post-cover"><span>{post.categoria || 'Arquitetura e acabamentos'}</span><b> PÉRZIA <i>•</i> JOURNAL</b></div><div className="post-body"><p className="post-meta">{dateText(post.criadoEm)} <span>•</span> {post.autor} <span className={`post-status ${post.status}`}>{post.status === 'publicado' ? 'Publicado' : 'Rascunho'}</span></p><h3>{post.titulo}</h3><p>{post.resumo || post.conteudo}</p><div className="post-admin-actions"><details><summary>Pré-visualizar</summary><div className="post-content"><MarkdownContent content={post.conteudo} /></div></details><button type="button" className="text-button" onClick={() => openPostEditor(post)}>Editar artigo</button></div></div></article>)}</div>}
        </section>}
        <footer>© 2026 Pérzia Acabamentos <span>•</span> CRM Comercial + Blog de Arquitetura</footer>
      </div>
    </section>

    {modal === 'client' && <Modal title="Novo relacionamento" eyebrow="CADASTRO COMERCIAL" onClose={() => setModal('')}><form className="modal-form" onSubmit={submitClient}>
      {modalError && <p className="form-error" role="alert">{modalError}</p>}
      <label>Nome do cliente<input required autoFocus value={clientForm.Nome} onChange={(event) => setClientForm({ ...clientForm, Nome: event.target.value })} placeholder="Nome ou razão social" /></label>
      <label>WhatsApp com DDD<input required type="tel" inputMode="tel" autoComplete="tel" value={clientForm.Telefone} onChange={(event) => setClientForm({ ...clientForm, Telefone: event.target.value })} placeholder="(62) 99999-9999" /></label>
      <label>E-mail<input type="email" autoComplete="email" value={clientForm.Email} onChange={(event) => setClientForm({ ...clientForm, Email: event.target.value })} placeholder="cliente@email.com" /></label>
      <label>Tipo de imóvel<select value={clientForm.Tipo} onChange={(event) => setClientForm({ ...clientForm, Tipo: event.target.value })}><option>Residencial</option><option>Comercial</option><option>Escolar</option></select></label>
      <label>Cidade<input value={clientForm.Cidade} onChange={(event) => setClientForm({ ...clientForm, Cidade: event.target.value })} placeholder="Ex.: Goiânia - GO" /></label>
      <label>Status<input value={clientForm.Status} onChange={(event) => setClientForm({ ...clientForm, Status: event.target.value })} placeholder="Novo cadastro" /></label>
      <label>Projeto / interesse<textarea value={clientForm.Projeto} onChange={(event) => setClientForm({ ...clientForm, Projeto: event.target.value })} placeholder="Conte um pouco sobre o projeto" /></label>
      <p className="form-hint">O cadastro começa como prospect, sem compras.</p><div className="modal-actions"><button type="button" className="button button-quiet" onClick={() => setModal('')}>Cancelar</button><button className="button button-primary" disabled={saving}>{saving ? 'Salvando…' : 'Criar cadastro'}</button></div>
    </form></Modal>}

    {modal === 'deal' && selectedClient && <Modal title="Fechar negócio" eyebrow="ATUALIZAR RELACIONAMENTO" onClose={() => setModal('')}><form className="modal-form" onSubmit={submitDeal}>
      {modalError && <p className="form-error" role="alert">{modalError}</p>}
      <p className="modal-lead">Informe o valor da compra de <strong>{selectedClient.nome}</strong>. O cliente será movido para relacionamentos ativos.</p>
      <label>Valor do negócio (R$)<input required autoFocus min="0.01" step="0.01" type="number" value={dealValue} onChange={(event) => setDealValue(event.target.value)} placeholder="0,00" /></label>
      <div className="modal-actions"><button type="button" className="button button-quiet" onClick={() => setModal('')}>Cancelar</button><button className="button button-primary" disabled={saving}>{saving ? 'Atualizando…' : 'Confirmar venda'}</button></div>
    </form></Modal>}

    {modal === 'details' && selectedClient && <Modal title="Informações do Cliente" eyebrow="DETALHES DO RELACIONAMENTO" onClose={() => setModal('')}><div className="client-details">
      <div className="details-client-name">{selectedClient.nome}</div>
      <div className="details-grid"><div><small>Categoria</small><strong>{selectedClient.categoria === 'clientes_ativos' ? 'Relacionamento ativo' : 'Sem compras'}</strong></div><div><small>Tipo de imóvel</small><strong>{selectedClient.tipo}</strong></div><div><small>Valor</small><strong>{currency.format(selectedClient.valor || 0)}</strong></div><div><small>Status</small><strong>{selectedClient.status}</strong></div><div><small>Cidade</small><strong>{displayCity(selectedClient.cidade)}</strong></div><div><small>Data da última compra</small><strong>{selectedClient.ultimaCompra ? dateText(selectedClient.ultimaCompra) : 'Sem compras registradas'}</strong></div></div>
      <div className="details-project"><small>Projeto / interesse</small><p>{selectedClient.projeto || 'Nenhum detalhe informado.'}</p></div>
      {selectedClient.dadosPlanilha && <div className="details-project"><small>Contato e cadastro</small><p>{clientContact(selectedClient)}</p></div>}
      {(selectedClient.telefone || selectedClient.email) && <div className="details-project"><small>Contato comercial</small><p>{selectedClient.telefone || getClientPhone(selectedClient) || 'WhatsApp não informado'}{selectedClient.email ? ` · ${selectedClient.email}` : ''}</p></div>}
      <div className="details-project"><small>Histórico</small>{Array.isArray(selectedClient.historico) && selectedClient.historico.length ? <ul>{(Array.isArray(selectedClient.historico) ? selectedClient.historico : []).map((item, index) => <li key={`${item.DATA || item['DT. FATURAMENTO'] || index}-${index}`}>{item.tipo || (item['N. NOTA'] ? `Venda · nota ${item['N. NOTA']}` : 'Compra registrada')} — {currency.format(item.valor ?? item['VR. LIQUIDO'] ?? 0)} <span>{dateText(item.data || item.DATA || item['DT. FATURAMENTO'])}</span></li>)}</ul> : <p>Nenhum negócio registrado até o momento.</p>}</div>
      <form className="relationship-form" onSubmit={submitRelationship}>
        {modalError && <p className="form-error" role="alert">{modalError}</p>}
        {relationshipSaved && <p className="form-success" role="status">Alterações salvas.</p>}
        <label>Origem do Relacionamento / Tipo de Compra<select value={relationshipForm.tipoCompra} onChange={(event) => { setRelationshipSaved(false); setRelationshipForm({ ...relationshipForm, tipoCompra: event.target.value }); }}>{!['Venda Direta', 'Por Terceiros', 'Indicação de Arquiteto(a)', 'Especificação de Engenheiro(a)', 'Funcionário/Parceiro'].includes(relationshipForm.tipoCompra) && <option>{relationshipForm.tipoCompra}</option>}<option>Venda Direta</option><option>Indicação de Arquiteto(a)</option><option>Especificação de Engenheiro(a)</option><option>Funcionário/Parceiro</option><option>Por Terceiros</option></select></label>
        <label>Observações Gerais<textarea rows="3" value={relationshipForm.observacoes} onChange={(event) => { setRelationshipSaved(false); setRelationshipForm({ ...relationshipForm, observacoes: event.target.value }); }} placeholder="Anote preferências, especificidades e histórico do relacionamento" /></label>
        <button className="button button-primary save-relationship" disabled={saving}>{saving ? 'Salvando…' : 'Salvar Alterações'}</button>
      </form>
      <div className="details-actions">{selectedClient.categoria === 'prospects' && <button className="button button-primary" onClick={() => showCloseDeal(selectedClient)}>Fechar Negócio</button>}{selectedClientWhatsApp && <a className="button button-whatsapp" href={selectedClientWhatsApp} target="_blank" rel="noreferrer">Iniciar conversa no WhatsApp ↗</a>}<button className="button button-outline" onClick={editSelectedClient}>Alterar Cadastro</button></div>
    </div></Modal>}

    {modal === 'edit' && selectedClient && <Modal title="Alterar Cadastro" eyebrow="INFORMAÇÕES DO CLIENTE" onClose={() => setModal('')}><form className="modal-form" onSubmit={submitEdit}>
      {modalError && <p className="form-error" role="alert">{modalError}</p>}
      <label>Nome do cliente<input required autoFocus value={editForm.Nome} onChange={(event) => setEditForm({ ...editForm, Nome: event.target.value })} /></label>
      <label>WhatsApp com DDD<input type="tel" inputMode="tel" value={editForm.Telefone} onChange={(event) => setEditForm({ ...editForm, Telefone: event.target.value })} placeholder="(62) 99999-9999" /></label>
      <label>E-mail<input type="email" value={editForm.Email} onChange={(event) => setEditForm({ ...editForm, Email: event.target.value })} placeholder="cliente@email.com" /></label>
      <label>Tipo de imóvel<select value={editForm.Tipo} onChange={(event) => setEditForm({ ...editForm, Tipo: event.target.value })}>{!['Residencial', 'Comercial', 'Escolar'].includes(editForm.Tipo) && <option>{editForm.Tipo}</option>}<option>Residencial</option><option>Comercial</option><option>Escolar</option></select></label>
      <label>Cidade<input value={editForm.Cidade} onChange={(event) => setEditForm({ ...editForm, Cidade: event.target.value })} placeholder="Ex.: Goiânia - GO" /></label>
      <label>Status<input value={editForm.Status} onChange={(event) => setEditForm({ ...editForm, Status: event.target.value })} /></label>
      <label>Projeto / interesse<textarea value={editForm.Projeto} onChange={(event) => setEditForm({ ...editForm, Projeto: event.target.value })} /></label>
      <div className="modal-actions"><button type="button" className="button button-quiet" onClick={() => setModal('details')}>Cancelar</button><button className="button button-primary" disabled={saving}>{saving ? 'Salvando…' : 'Salvar alterações'}</button></div>
    </form></Modal>}

    {modal === 'post' && <Modal title={editingPost ? 'Editar artigo' : 'Novo artigo'} eyebrow="BLOG DE ARQUITETURA" onClose={() => setModal('')}><form className="modal-form" onSubmit={submitPost}>
      {modalError && <p className="form-error" role="alert">{modalError}</p>}
      <label>Título<input required autoFocus value={postForm.titulo} onChange={(event) => setPostForm({ ...postForm, titulo: event.target.value })} placeholder="Ex.: A beleza natural das pedras" /></label>
      <label>Categoria<select value={postForm.categoria} onChange={(event) => setPostForm({ ...postForm, categoria: event.target.value })}><option>Tendências</option><option>Acabamentos residenciais</option><option>Espaços comerciais</option><option>Instituições de ensino</option><option>Arquitetura</option></select></label>
      <label>Publicação<select value={postForm.status} onChange={(event) => setPostForm({ ...postForm, status: event.target.value })}><option value="publicado">Publicado</option><option value="rascunho">Rascunho</option></select></label>
      <label>Resumo<textarea rows="2" value={postForm.resumo} onChange={(event) => setPostForm({ ...postForm, resumo: event.target.value })} placeholder="Uma chamada breve para o artigo" /></label>
      <label>Conteúdo<textarea required rows="6" value={postForm.conteudo} onChange={(event) => setPostForm({ ...postForm, conteudo: event.target.value })} placeholder="Escreva o artigo..." /></label>
      <div className="modal-actions"><button type="button" className="button button-quiet" onClick={() => setModal('')}>Cancelar</button><button className="button button-primary" disabled={saving}>{saving ? 'Salvando…' : postForm.status === 'publicado' ? 'Publicar artigo' : 'Salvar rascunho'}</button></div>
    </form></Modal>}

    {modal === 'generator' && <Modal title="Gerador de Artigos com IA" eyebrow="CONTEÚDO PÉRZIA + ARKOS BRASIL" onClose={() => setModal('')}><form className="modal-form ai-generator-form" onSubmit={submitGeneratedPost}>
      {modalError && <p className="form-error" role="alert">{modalError}</p>}
      <p className="modal-lead">Crie um artigo editorial em Markdown para clientes, arquitetos e especificadores.</p>
      <label>Tema/Conceito<input required autoFocus maxLength="200" value={generatorForm.tema} onChange={(event) => setGeneratorForm({ ...generatorForm, tema: event.target.value })} placeholder="Ex.: Tendências de pisos para imóveis de luxo" /></label>
      <label>Público-Alvo<select value={generatorForm.publico} onChange={(event) => setGeneratorForm({ ...generatorForm, publico: event.target.value })}><option>Residencial de Luxo</option><option>Imóveis Comerciais</option><option>Arquitetos/Engenheiros</option><option>Escolas/Instituições</option></select></label>
      <label className="checkbox-label"><input type="checkbox" checked={generatorForm.incluirArkos} onChange={(event) => setGeneratorForm({ ...generatorForm, incluirArkos: event.target.checked })} /><span>Citar Arkos Brasil como parceira oficial em Goiás</span></label>
      <p className="ai-brand-hint">O texto aborda acabamentos de alto padrão, linhas Arkos Brasil e soluções da Pérzia, com dica técnica e chamada para o showroom/catálogo.</p>
      <div className="modal-actions"><button type="button" className="button button-quiet" onClick={() => setModal('')}>Cancelar</button><button className="button button-primary" disabled={saving}>{saving ? 'Gerando rascunho…' : 'Gerar rascunho para revisão'}</button></div>
    </form></Modal>}
  </main>;
}
