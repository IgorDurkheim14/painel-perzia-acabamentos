export default function StatusCard({ status, checking }) {
  const online = status === 'online';
  const label = checking ? 'Verificando conexão' : online ? 'Operacional' : 'Indisponível';

  return (
    <section className="card status-card" aria-live="polite">
      <div className={`status-icon ${online ? 'is-online' : checking ? 'is-checking' : 'is-offline'}`}>
        <span />
      </div>
      <div className="status-copy">
        <p className="eyebrow">Servidor e página web</p>
        <h2>{label}</h2>
        <p className="muted">{checking ? 'Consultando a API…' : online ? 'A API está respondendo normalmente.' : 'Não foi possível conectar à API.'}</p>
      </div>
      <span className={`status-pill ${online ? 'pill-online' : checking ? 'pill-checking' : 'pill-offline'}`}>
        {checking ? 'CHECANDO' : online ? 'ONLINE' : 'OFFLINE'}
      </span>
    </section>
  );
}
