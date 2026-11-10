import { useCallback, useEffect, useMemo, useState } from 'react';
import { getVendasExcel } from '../services/api.js';

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const exactMoney = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const number = new Intl.NumberFormat('pt-BR');
const asArray = (value) => Array.isArray(value) ? value : [];
const key = (value) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]/g, '');

function field(row, label) {
  const target = key(label);
  return Object.entries(row || {}).find(([name]) => key(name) === target)?.[1] ?? null;
}

function amount(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value ?? '').replace(/[^\d,.-]/g, '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

function MetricCard({ label, value, note, mark }) {
  return <article className="summary-card sales-metric"><div className="summary-top"><span>{label}</span><span className="summary-mark">{mark}</span></div><strong>{value}</strong><small>{note}</small></article>;
}

function BarChart({ title, caption, rows, formatter = money, color = 'terracotta' }) {
  const chartRows = asArray(rows).filter((row) => row && typeof row === 'object' && !Array.isArray(row));
  const max = Math.max(1, ...(Array.isArray(chartRows) ? chartRows.map((row) => row.value) : []));
  return <section className="sales-panel">
    <div className="sales-panel-heading"><div><p className="eyebrow">ANÁLISE DA PLANILHA</p><h2>{title}</h2></div></div>
    {chartRows.length ? <div className="sales-bars">{(Array.isArray(chartRows) ? chartRows : []).map((row, index) => <div className="sales-bar-row" key={`${row.label}-${index}`}>
      <div className="sales-bar-label" title={row.label}>{row.label}</div><div className="sales-bar-track"><span className={`sales-bar-fill ${color}`} style={{ width: `${Math.max(row.value > 0 ? 2 : 0, (row.value / max) * 100)}%` }} /></div><strong>{formatter(row.value)}</strong>
    </div>)}</div> : <p className="table-message">Ainda não há dados suficientes para este gráfico.</p>}
    <p className="sales-chart-caption">{caption}</p>
  </section>;
}

export default function SalesDashboard() {
  const [vendas, setVendas] = useState([]);
  const [clientesPlanilha, setClientesPlanilha] = useState([]);
  const [resumo, setResumo] = useState({});
  const [source, setSource] = useState({ arquivo: '', lidoEm: '' });
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState(null);

  const refresh = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true); else setLoading(true);
    try {
      const result = await getVendasExcel();
      if (!result || typeof result !== 'object' || result.sucesso === false) throw new Error(result?.error || 'A API não conseguiu ler a planilha.');
      const salesRows = Array.isArray(result.vendasFinalizadas)
        ? result.vendasFinalizadas
        : Array.isArray(result.vendas) ? result.vendas : [];
      const customerRows = Array.isArray(result.clientes) ? result.clientes : [];
      setVendas(salesRows.filter((row) => row && typeof row === 'object' && !Array.isArray(row)));
      setClientesPlanilha(customerRows.filter((row) => row && typeof row === 'object' && !Array.isArray(row)));
      setResumo(result.resumo && typeof result.resumo === 'object' && !Array.isArray(result.resumo) ? result.resumo : {});
      setSource({ arquivo: typeof result.arquivo === 'string' ? result.arquivo : '', lidoEm: typeof result.lidoEm === 'string' ? result.lidoEm : '' });
      setHasLoaded(true);
      setUpdatedAt(new Date());
      setError('');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível carregar os dados de vendas.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(() => refresh(true), 30_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const customers = useMemo(() => {
    const safeCustomers = asArray(clientesPlanilha);
    const safeSales = asArray(vendas);
    const masterByName = new Map((Array.isArray(safeCustomers) ? safeCustomers : []).map((client) => [key(field(client, 'Nome / Razão social')), client]));
    const grouped = new Map();
    (Array.isArray(safeSales) ? safeSales : []).forEach((sale) => {
      const name = String(field(sale, 'Cliente') || 'Cliente não identificado').trim();
      const id = key(name) || name;
      const item = grouped.get(id) || { name, count: 0, gross: 0, net: 0, received: 0, city: '' };
      item.count += 1;
      item.gross += amount(field(sale, 'Valor bruto (R$)'));
      item.net += amount(field(sale, 'Valor líquido (R$)'));
      item.received += amount(field(sale, 'Valor recebido (R$)'));
      const master = masterByName.get(id);
      item.city ||= field(master, 'Cidade / Bairro') || '';
      grouped.set(id, item);
    });
    return [...grouped.values()].sort((a, b) => b.net - a.net);
  }, [clientesPlanilha, vendas]);

  const safeSales = asArray(vendas);
  const customerRows = asArray(customers);
  const topSales = useMemo(() => (Array.isArray(vendas) ? vendas : []).map((sale, index) => ({
    label: `${field(sale, 'Cliente') || `Venda ${index + 1}`} · ${field(sale, 'ID venda') || `#${index + 1}`}`,
    value: amount(field(sale, 'Valor líquido (R$)')),
  })).filter((row) => row && typeof row === 'object').sort((a, b) => b.value - a.value).slice(0, 5), [vendas]);
  const composition = [
    { label: 'Valor bruto', value: amount(resumo.totalValorBruto) },
    { label: 'Descontos', value: amount(resumo.totalDesconto) },
    { label: 'Valor líquido', value: amount(resumo.totalValorLiquido) },
    { label: 'Valor recebido', value: amount(resumo.totalValorRecebido) },
    { label: 'Saldo a receber', value: amount(resumo.totalSaldoAReceber) },
  ];

  return <section className="sales-dashboard" aria-busy={loading || refreshing}>
    <div className="sales-toolbar">
      <span className="sales-source"><span className="sales-live-dot" /> Atualiza automaticamente a cada 30 segundos</span>
      <div className="sales-refresh-info">{updatedAt ? `Atualizado às ${updatedAt.toLocaleTimeString('pt-BR')}` : 'Aguardando dados'}<button className="button button-outline" type="button" onClick={() => refresh(true)} disabled={refreshing}>{refreshing ? 'Atualizando…' : '↻ Atualizar agora'}</button></div>
    </div>
    {loading && !hasLoaded && <div className="sales-loading-banner" role="status" aria-live="polite"><span className="sales-loading-spinner" /> Carregando dados da planilha... A API do Render pode levar alguns instantes para iniciar.</div>}
    {error && <div className="error-banner" role="alert">{error} {hasLoaded && 'Exibindo os últimos dados carregados.'}</div>}
    <section className="summary-grid sales-summary">
      <MetricCard label="Faturamento líquido" value={hasLoaded ? exactMoney.format(amount(resumo.totalValorLiquido)) : loading ? '…' : '—'} note="Total das vendas finalizadas" mark="R$" />
      <MetricCard label="Vendas finalizadas" value={hasLoaded ? number.format(resumo.totalVendas ?? safeSales.length) : loading ? '…' : '—'} note="Registros na planilha" mark="↗" />
      <MetricCard label="Clientes compradores" value={hasLoaded ? number.format(customerRows.length) : loading ? '…' : '—'} note="Clientes com venda registrada" mark="♧" />
      <MetricCard label="Saldo a receber" value={hasLoaded ? exactMoney.format(amount(resumo.totalSaldoAReceber)) : loading ? '…' : '—'} note={`${exactMoney.format(amount(resumo.totalValorRecebido))} já recebido`} mark="◷" />
    </section>
    <div className="sales-charts">
      <BarChart title="Maiores vendas" caption="Cinco maiores vendas por valor líquido, conforme a planilha." rows={topSales} />
      <BarChart title="Composição financeira" caption="Valores consolidados das vendas finalizadas." rows={composition} formatter={money} color="sage" />
    </div>
    <section className="sales-panel sales-customer-panel">
      <div className="sales-panel-heading"><div><p className="eyebrow">BASE DE CLIENTES</p><h2>Clientes e vendas</h2></div><span className="sales-count">{number.format(customers.length)} compradores</span></div>
      <div className="table-wrap"><table><thead><tr><th>CLIENTE</th><th>LOCALIDADE</th><th>VENDAS</th><th>VALOR BRUTO</th><th>VALOR LÍQUIDO</th><th>RECEBIDO</th></tr></thead><tbody>
        {loading && !hasLoaded ? <tr><td className="table-message" colSpan="6">Carregando dados da planilha...</td></tr> : (Array.isArray(customerRows) ? customerRows : []).slice(0, 50).map((client) => <tr key={client.name}><td><span className="client-name">{client.name}</span></td><td>{client.city || '—'}</td><td>{number.format(client.count)}</td><td className="amount-cell">{exactMoney.format(client.gross)}</td><td className="amount-cell">{exactMoney.format(client.net)}</td><td className="amount-cell">{exactMoney.format(client.received)}</td></tr>)}
        {!loading && hasLoaded && customerRows.length === 0 && <tr><td className="table-message" colSpan="6">Nenhuma venda encontrada na planilha.</td></tr>}
      </tbody></table></div>
      {customers.length > 50 && <div className="table-footer">Exibindo os 50 clientes com maior valor líquido de compras.</div>}
      {source.arquivo && <div className="sales-file-note">Fonte: {source.arquivo}{source.lidoEm ? ` · leitura ${new Date(source.lidoEm).toLocaleString('pt-BR')}` : ''}</div>}
    </section>
  </section>;
}
