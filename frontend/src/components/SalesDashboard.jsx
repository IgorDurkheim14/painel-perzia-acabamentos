import { useCallback, useEffect, useMemo, useState } from 'react';
import { getVendasExcel } from '../services/api.js';

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const exactMoney = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const number = new Intl.NumberFormat('pt-BR');
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
  const max = Math.max(1, ...rows.map((row) => row.value));
  return <section className="sales-panel">
    <div className="sales-panel-heading"><div><p className="eyebrow">ANÁLISE DA PLANILHA</p><h2>{title}</h2></div></div>
    {rows.length ? <div className="sales-bars">{rows.map((row, index) => <div className="sales-bar-row" key={`${row.label}-${index}`}>
      <div className="sales-bar-label" title={row.label}>{row.label}</div><div className="sales-bar-track"><span className={`sales-bar-fill ${color}`} style={{ width: `${Math.max(row.value > 0 ? 2 : 0, (row.value / max) * 100)}%` }} /></div><strong>{formatter(row.value)}</strong>
    </div>)}</div> : <p className="table-message">Ainda não há dados suficientes para este gráfico.</p>}
    <p className="sales-chart-caption">{caption}</p>
  </section>;
}

export default function SalesDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState(null);

  const refresh = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true); else setLoading(true);
    try {
      const result = await getVendasExcel();
      if (!result?.sucesso) throw new Error(result?.error || 'A API não conseguiu ler a planilha.');
      setData(result);
      setUpdatedAt(new Date());
      setError('');
    } catch (requestError) {
      setError(requestError.message || 'Não foi possível carregar os dados de vendas.');
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

  const sales = data?.vendasFinalizadas ?? [];
  const customers = useMemo(() => {
    const masterByName = new Map((data?.clientes ?? []).map((client) => [key(field(client, 'Nome / Razão social')), client]));
    const grouped = new Map();
    sales.forEach((sale) => {
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
  }, [data, sales]);

  const summary = data?.resumo ?? {};
  const topSales = useMemo(() => sales.map((sale, index) => ({
    label: `${field(sale, 'Cliente') || `Venda ${index + 1}`} · ${field(sale, 'ID venda') || `#${index + 1}`}`,
    value: amount(field(sale, 'Valor líquido (R$)')),
  })).sort((a, b) => b.value - a.value).slice(0, 5), [sales]);
  const composition = [
    { label: 'Valor bruto', value: amount(summary.totalValorBruto) },
    { label: 'Descontos', value: amount(summary.totalDesconto) },
    { label: 'Valor líquido', value: amount(summary.totalValorLiquido) },
    { label: 'Valor recebido', value: amount(summary.totalValorRecebido) },
    { label: 'Saldo a receber', value: amount(summary.totalSaldoAReceber) },
  ];

  return <section className="sales-dashboard" aria-busy={loading || refreshing}>
    <div className="sales-toolbar">
      <span className="sales-source"><span className="sales-live-dot" /> Atualiza automaticamente a cada 30 segundos</span>
      <div className="sales-refresh-info">{updatedAt ? `Atualizado às ${updatedAt.toLocaleTimeString('pt-BR')}` : 'Aguardando dados'}<button className="button button-outline" type="button" onClick={() => refresh(true)} disabled={refreshing}>{refreshing ? 'Atualizando…' : '↻ Atualizar agora'}</button></div>
    </div>
    {error && <div className="error-banner" role="alert">{error} {data && 'Exibindo os últimos dados carregados.'}</div>}
    <section className="summary-grid sales-summary">
      <MetricCard label="Faturamento líquido" value={data ? exactMoney.format(amount(summary.totalValorLiquido)) : loading ? '…' : '—'} note="Total das vendas finalizadas" mark="R$" />
      <MetricCard label="Vendas finalizadas" value={data ? number.format(summary.totalVendas ?? sales.length) : loading ? '…' : '—'} note="Registros na planilha" mark="↗" />
      <MetricCard label="Clientes compradores" value={data ? number.format(customers.length) : loading ? '…' : '—'} note="Clientes com venda registrada" mark="♧" />
      <MetricCard label="Saldo a receber" value={data ? exactMoney.format(amount(summary.totalSaldoAReceber)) : loading ? '…' : '—'} note={`${exactMoney.format(amount(summary.totalValorRecebido))} já recebido`} mark="◷" />
    </section>
    <div className="sales-charts">
      <BarChart title="Maiores vendas" caption="Cinco maiores vendas por valor líquido, conforme a planilha." rows={topSales} />
      <BarChart title="Composição financeira" caption="Valores consolidados das vendas finalizadas." rows={composition} formatter={money} color="sage" />
    </div>
    <section className="sales-panel sales-customer-panel">
      <div className="sales-panel-heading"><div><p className="eyebrow">BASE DE CLIENTES</p><h2>Clientes e vendas</h2></div><span className="sales-count">{number.format(customers.length)} compradores</span></div>
      <div className="table-wrap"><table><thead><tr><th>CLIENTE</th><th>LOCALIDADE</th><th>VENDAS</th><th>VALOR BRUTO</th><th>VALOR LÍQUIDO</th><th>RECEBIDO</th></tr></thead><tbody>
        {loading && !data ? <tr><td className="table-message" colSpan="6">Lendo os dados da planilha…</td></tr> : customers.slice(0, 50).map((client) => <tr key={client.name}><td><span className="client-name">{client.name}</span></td><td>{client.city || '—'}</td><td>{number.format(client.count)}</td><td className="amount-cell">{exactMoney.format(client.gross)}</td><td className="amount-cell">{exactMoney.format(client.net)}</td><td className="amount-cell">{exactMoney.format(client.received)}</td></tr>)}
        {!loading && data && customers.length === 0 && <tr><td className="table-message" colSpan="6">Nenhuma venda encontrada na planilha.</td></tr>}
      </tbody></table></div>
      {customers.length > 50 && <div className="table-footer">Exibindo os 50 clientes com maior valor líquido de compras.</div>}
      {data?.arquivo && <div className="sales-file-note">Fonte: {data.arquivo}{data.lidoEm ? ` · leitura ${new Date(data.lidoEm).toLocaleString('pt-BR')}` : ''}</div>}
    </section>
  </section>;
}
