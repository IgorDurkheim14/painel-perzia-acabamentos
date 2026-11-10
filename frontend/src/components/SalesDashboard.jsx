import { Component, useCallback, useEffect, useMemo, useState } from 'react';
import { getVendasExcel } from '../services/api.js';

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const exactMoney = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const number = new Intl.NumberFormat('pt-BR');
const asArray = (value) => Array.isArray(value) ? value : [];
const safeText = (value, fallback = '') => value === null || value === undefined || (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') ? fallback : String(value);
const ORDER_CATEGORIES = ['Pedidos em Aberto', 'Vendas em Andamento', 'Pedidos Concluídos'];

function readCategoryRows(data, category, topLevelKey) {
  const container = data?.pedidosPorCategoria ?? data?.pedidos;
  const value = data?.[topLevelKey] ?? container?.[category];
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.pedidos)) return value.pedidos;
  return null;
}

function normalizeOrder(row, fallbackCategory) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
  const client = row.cliente ?? field(row, 'Cliente') ?? field(row, 'Cliente / empresa');
  const status = row.statusPedido ?? field(row, 'Status') ?? field(row, 'Etapa');
  const value = row.valorPedido ?? field(row, 'Valor provável (R$)') ?? field(row, 'Valor do orçamento (R$)') ?? field(row, 'Valor líquido (R$)') ?? field(row, 'Valor bruto (R$)');
  const identifier = row.idPedido ?? field(row, 'ID venda') ?? field(row, 'ID oportunidade') ?? field(row, 'Nº pedido / NF');
  return {
    ...row,
    cliente: safeText(client, 'Cliente não identificado'),
    idPedido: safeText(identifier, '—'),
    categoriaPedido: ORDER_CATEGORIES.includes(row.categoriaPedido) ? row.categoriaPedido : fallbackCategory,
    statusPedido: safeText(status, fallbackCategory),
    origemPedido: safeText(row.origemPedido, fallbackCategory === 'Pedidos Concluídos' ? 'Vendas finalizadas' : 'Pipeline comercial'),
    valorPedido: amount(value),
  };
}

function isNetworkFailure(error) {
  return [502, 503, 504, 521, 522, 523, 524].includes(error?.status)
    || error?.name === 'AbortError'
    || error instanceof TypeError
    || /failed to fetch|fetch failed|network|timeout|load failed|service unavailable|bad gateway|gateway timeout|\(50[234]\)/i.test(String(error?.message ?? ''));
}

function field(row, label) {
  const target = key(label);
  try {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
    return Object.entries(row).find(([name]) => key(name) === target)?.[1] ?? null;
  } catch {
    return null;
  }
}

function amount(value) {
  try {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (typeof value !== 'string') return 0;
    const parsed = Number(value.replace(/[^\d,.-]/g, '').replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    return 0;
  }
}

function MetricCard({ label, value, note, mark, className = '' }) {
  return <article className={`summary-card sales-metric ${className}`}><div className="summary-top"><span>{label}</span><span className="summary-mark">{mark}</span></div><strong>{value}</strong><small>{note}</small></article>;
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

function SalesDashboardContent() {
  const [pedidos, setPedidos] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [source, setSource] = useState({ arquivo: '', lidoEm: '' });
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [connectionLost, setConnectionLost] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(null);

  const refresh = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true); else setLoading(true);
    try {
      const response = await getVendasExcel();
      const result = Array.isArray(response)
        ? { vendas: response }
        : response && typeof response === 'object' ? response : {};
      if (result.sucesso === false || result.success === false) throw new Error(result.error || result.mensagem || 'A API não conseguiu ler a planilha.');
      const nested = result.data && typeof result.data === 'object' && !Array.isArray(result.data) ? result.data : result;
      const salesRows = Array.isArray(nested.vendasFinalizadas)
        ? nested.vendasFinalizadas
        : Array.isArray(nested.vendas) ? nested.vendas : [];
      let orderRows;
      if (Array.isArray(nested.pedidos)) {
        orderRows = nested.pedidos.map((row) => normalizeOrder(row, 'Pedidos Concluídos')).filter(Boolean);
      } else {
        const categorySources = [
          ['Pedidos em Aberto', 'pedidosEmAberto'],
          ['Vendas em Andamento', 'vendasEmAndamento'],
          ['Pedidos Concluídos', 'pedidosConcluidos'],
        ];
        const categoryLists = categorySources.map(([category, keyName]) => ({
          category,
          rows: readCategoryRows(nested, category, keyName),
        }));
        if (categoryLists.some((item) => Array.isArray(item.rows))) {
          orderRows = categoryLists.flatMap(({ category, rows }) => (Array.isArray(rows) ? rows : [])
            .map((row) => normalizeOrder(row, category)).filter(Boolean));
        } else {
          orderRows = (Array.isArray(salesRows) ? salesRows : [])
            .map((row) => normalizeOrder(row, 'Pedidos Concluídos')).filter(Boolean);
        }
      }
      setPedidos(asArray(orderRows));
      setSource({ arquivo: typeof nested.arquivo === 'string' ? nested.arquivo : '', lidoEm: typeof nested.lidoEm === 'string' ? nested.lidoEm : '' });
      setHasLoaded(true);
      setUpdatedAt(new Date());
      setError('');
      setConnectionLost(false);
    } catch (requestError) {
      if (isNetworkFailure(requestError)) {
        setConnectionLost(true);
        setError('');
      } else {
        setConnectionLost(false);
        setError(requestError instanceof Error ? requestError.message : 'Não foi possível carregar os dados de vendas.');
      }
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

  const safeOrders = asArray(pedidos).filter((row) => row && typeof row === 'object' && !Array.isArray(row));
  const categoryMetrics = ORDER_CATEGORIES.map((category) => {
    const categoryOrders = safeOrders.filter((order) => order.categoriaPedido === category);
    return { category, count: categoryOrders.length, total: categoryOrders.reduce((sum, order) => sum + amount(order.valorPedido), 0) };
  });
  const filteredOrders = selectedCategory === 'Todos'
    ? safeOrders
    : safeOrders.filter((order) => order.categoriaPedido === selectedCategory);
  const topSales = (Array.isArray(filteredOrders) ? filteredOrders : []).map((order) => ({
    label: `${safeText(order.cliente)} · ${safeText(order.idPedido)}`,
    value: amount(order.valorPedido),
  })).sort((a, b) => b.value - a.value).slice(0, 5);
  const selectedCategoryTotals = categoryMetrics
    .filter((item) => selectedCategory === 'Todos' || item.category === selectedCategory)
    .map((item) => ({ label: item.category, value: item.total }));

  return <section className="sales-dashboard" aria-busy={loading || refreshing}>
    <div className="sales-toolbar">
      <span className="sales-source"><span className="sales-live-dot" /> Atualiza automaticamente a cada 30 segundos</span>
      <div className="sales-refresh-info">{updatedAt ? `Atualizado às ${updatedAt.toLocaleTimeString('pt-BR')}` : 'Aguardando dados'}<button className="button button-outline" type="button" onClick={() => refresh(true)} disabled={refreshing || loading}>{refreshing || loading ? 'Conectando…' : '↻ Atualizar agora'}</button></div>
    </div>
    {loading && !hasLoaded && <div className="sales-loading-banner" role="status" aria-live="polite"><span className="sales-loading-spinner" /> Carregando dados da planilha... A API do Render pode levar alguns instantes para iniciar.</div>}
    {connectionLost && <div className="sales-loading-banner sales-connection-banner" role="status" aria-live="polite"><span className="sales-loading-spinner" /> <span>Conectando ao servidor...{hasLoaded ? ' Os últimos dados continuam disponíveis.' : ' O Render pode estar iniciando.'}</span><button className="button button-outline" type="button" onClick={() => refresh(true)} disabled={refreshing}>{refreshing ? 'Conectando…' : 'Tentar reconectar'}</button></div>}
    {error && <div className="error-banner" role="alert">{error} {hasLoaded && 'Exibindo os últimos dados carregados.'}<button className="button button-outline" type="button" onClick={() => refresh(true)} disabled={refreshing}>{refreshing ? 'Tentando…' : 'Tentar novamente'}</button></div>}
    <div className="sales-filters" role="group" aria-label="Filtrar pedidos por situação">
      {['Todos', ...ORDER_CATEGORIES].map((category) => <button key={category} type="button" className={`sales-filter-button ${selectedCategory === category ? 'active' : ''}`} aria-pressed={selectedCategory === category} onClick={() => setSelectedCategory(category)}>{category}</button>)}
    </div>
    <section className="summary-grid sales-summary">
      {categoryMetrics.map((item) => <MetricCard key={item.category} label={item.category} value={hasLoaded ? exactMoney.format(item.total) : loading ? '…' : '—'} note={`${number.format(item.count)} ${item.count === 1 ? 'pedido' : 'pedidos'}`} mark="R$" className={item.category === 'Pedidos em Aberto' ? 'metric-open' : item.category === 'Vendas em Andamento' ? 'metric-progress' : 'metric-complete'} />)}
    </section>
    <div className="sales-charts">
      <BarChart title={selectedCategory === 'Todos' ? 'Pedidos de maior valor' : `Pedidos · ${selectedCategory}`} caption={`Valores dos pedidos exibidos no filtro: ${selectedCategory.toLocaleLowerCase('pt-BR')}.`} rows={topSales} />
      <BarChart title="Valor por situação" caption="Totais consolidados por categoria de pedido." rows={selectedCategoryTotals} formatter={money} color="sage" />
    </div>
    <section className="sales-panel sales-customer-panel">
      <div className="sales-panel-heading"><div><p className="eyebrow">PEDIDOS DA PLANILHA</p><h2>{selectedCategory === 'Todos' ? 'Pedidos e vendas' : selectedCategory}</h2></div><span className="sales-count">{number.format(filteredOrders.length)} registros</span></div>
      <div className="table-wrap"><table><thead><tr><th>CLIENTE</th><th>PEDIDO</th><th>STATUS NA PLANILHA</th><th>CATEGORIA</th><th>ORIGEM</th><th>VALOR</th></tr></thead><tbody>
        {loading && !hasLoaded ? <tr><td className="table-message" colSpan="6">Carregando dados da planilha...</td></tr> : (Array.isArray(filteredOrders) ? filteredOrders : []).slice(0, 100).map((order, index) => <tr key={`${safeText(order.idPedido)}-${index}`}><td><span className="client-name">{safeText(order.cliente, 'Cliente não identificado')}</span></td><td>{safeText(order.idPedido, '—')}</td><td>{safeText(order.statusPedido, '—')}</td><td><span className={`order-category-badge ${order.categoriaPedido === 'Pedidos em Aberto' ? 'open' : order.categoriaPedido === 'Vendas em Andamento' ? 'progress' : 'complete'}`}>{safeText(order.categoriaPedido)}</span></td><td>{safeText(order.origemPedido, '—')}</td><td className="amount-cell">{exactMoney.format(amount(order.valorPedido))}</td></tr>)}
        {!loading && hasLoaded && filteredOrders.length === 0 && <tr><td className="table-message" colSpan="6">Nenhum registro na categoria “{selectedCategory}”.</td></tr>}
      </tbody></table></div>
      {filteredOrders.length > 100 && <div className="table-footer">Exibindo 100 de {number.format(filteredOrders.length)} registros.</div>}
      {source.arquivo && <div className="sales-file-note">Fonte: {safeText(source.arquivo)}{source.lidoEm ? ` · leitura ${new Date(source.lidoEm).toLocaleString('pt-BR')}` : ''}</div>}
    </section>
  </section>;
}

class SalesDashboardBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error('Falha interna no Dashboard de Vendas:', error);
  }

  render() {
    if (this.state.hasError) {
      return <section className="sales-dashboard" role="alert"><div className="sales-loading-banner"><span>Não foi possível exibir os dados da planilha.</span><button className="button button-outline" type="button" onClick={this.props.onRetry}>Tentar reconectar</button></div></section>;
    }
    return this.props.children;
  }
}

export default function SalesDashboard() {
  const [retryKey, setRetryKey] = useState(0);
  return <SalesDashboardBoundary key={retryKey} onRetry={() => setRetryKey((value) => value + 1)}><SalesDashboardContent /></SalesDashboardBoundary>;
}
