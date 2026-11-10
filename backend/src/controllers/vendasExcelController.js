import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import XLSX from 'xlsx';

/**
 * Resolve o caminho para o arquivo Controle_Comercial_Perzia_Acabamentos.xlsx
 * com suporte a múltiplos caminhos relativos e absolutos.
 */
export function resolveWorkbookPath() {
  const controllerDirectory = path.dirname(fileURLToPath(import.meta.url));
  const filename = 'Controle_Comercial_Perzia_Acabamentos.xlsx';
  const candidates = [
    process.env.EXCEL_PATH,
    path.resolve(controllerDirectory, '../../../', filename),
    path.resolve(controllerDirectory, '../../', filename),
    path.resolve(process.cwd(), filename),
    path.resolve(process.cwd(), '..', filename),
  ].filter(Boolean).map((candidate) => path.resolve(candidate));

  for (const candidate of [...new Set(candidates)]) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(`Planilha ${filename} não encontrada. Coloque o arquivo na raiz do projeto ou na pasta backend, ou configure EXCEL_PATH.`);
}

function parseAmount(val) {
  if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
  if (!val) return 0;
  const text = String(val).replace(/[^\d,.-]/g, '');
  const normalized = text.includes(',') ? text.replace(/\./g, '').replace(',', '.') : text;
  const num = Number(normalized);
  return Number.isFinite(num) ? num : 0;
}

function normalizeStatusText(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]/g, '');
}

function readOrderStatus(row) {
  if (!row || typeof row !== 'object') return '';
  const entries = Object.entries(row);
  const excluded = /(financeiro|entrega|relacionamento|fornecedor)/;
  const hasValue = (value) => value !== null && value !== undefined && String(value).trim() !== '';
  const explicitStatus = entries.find(([header, value]) => ['status', 'situacao'].includes(normalizeStatusText(header)) && hasValue(value));
  const stage = entries.find(([header, value]) => normalizeStatusText(header) === 'etapa' && hasValue(value));
  const entry = explicitStatus || stage || entries.find(([header, value]) => {
    const normalized = normalizeStatusText(header);
    return /(status|situacao|etapa)/.test(normalized) && !excluded.test(normalized) && hasValue(value);
  });
  return entry && entry[1] !== null && entry[1] !== undefined ? String(entry[1]).trim() : '';
}

function classifyOrderStatus(status, fallbackCategory) {
  const value = normalizeStatusText(status);
  if (/concluid|finaliz|entregue|realizad|vendafechada|ganho|fechado/.test(value)) return 'Pedidos Concluídos';
  if (/abert|pendente|aguard|prospecc|novocadastro|orcamento|cotacao|naoiniciad/.test(value)) {
    if (/emandamento|negoci|enviado|aprovado|separacao|expedicao|emproducao/.test(value)) return 'Vendas em Andamento';
    return 'Pedidos em Aberto';
  }
  if (/andamento|negoci|enviado|aprovado|separacao|expedicao|emproducao|ementrega|processamento/.test(value)) return 'Vendas em Andamento';
  return fallbackCategory;
}

function rowValue(row, ...headers) {
  const entries = Object.entries(row || {});
  for (const header of headers) {
    const match = entries.find(([name]) => normalizeStatusText(name) === normalizeStatusText(header));
    if (match && match[1] !== null && match[1] !== undefined && match[1] !== '') return parseAmount(match[1]);
  }
  return 0;
}

function makeOrder(row, origem, fallbackCategory, amountHeaders) {
  const statusPlanilha = readOrderStatus(row);
  const idPedido = row['ID venda'] || row['ID oportunidade'] || row['Nº pedido / NF'] || row['Nº venda / pedido'];
  return {
    ...row,
    idPedido: idPedido || 'Sem identificação',
    categoriaPedido: classifyOrderStatus(statusPlanilha, fallbackCategory),
    statusPedido: statusPlanilha || fallbackCategory,
    origemPedido: origem,
    valorPedido: rowValue(row, ...amountHeaders),
  };
}

function hasOrderData(row, clientHeader, includeUnidentified = false) {
  if (String(row?.[clientHeader] ?? '').trim()) return true;
  if (!includeUnidentified) return false;
  const hasValue = rowValue(row, 'Valor líquido (R$)', 'Valor bruto (R$)') > 0;
  return hasValue;
}

/**
 * Converte uma aba tabular do Excel em lista de objetos JSON usando a linha de cabeçalhos.
 */
function parseTabularSheet(sheet) {
  if (!sheet) return [];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, blankrows: false });
  if (!rows.length) return [];

  const headerIndex = rows.findIndex((row) =>
    row.some((cell) => typeof cell === 'string' && /^(ID\s|Nome|Cliente|Indicador|OBJETIVO)/i.test(cell.trim()))
  );

  if (headerIndex < 0) {
    return XLSX.utils.sheet_to_json(sheet, { defval: null, blankrows: false });
  }

  const headers = rows[headerIndex].map((h, i) =>
    (typeof h === 'string' && h.trim() ? h.trim() : `coluna_${i + 1}`)
  );

  return rows
    .slice(headerIndex + 1)
    .filter((row) => row.some((cell) => cell !== null && cell !== ''))
    .map((row) => Object.fromEntries(headers.map((h, i) => [h, row[i] ?? null])));
}

/**
 * Extrai os indicadores de alto nível da aba "Painel"
 */
function parsePainelSheet(sheet) {
  if (!sheet) return { kpis: {}, rotinas: [], linhas: [] };
  const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, blankrows: false });
  const kpis = {};
  const rotinas = [];

  for (const row of rawRows) {
    if (!row || !row[0]) continue;
    const title = String(row[0]).trim();
    const value = row[1];
    const desc = row[2] ? String(row[2]).trim() : '';

    if (row.length >= 2 && (typeof value === 'number' || (typeof value === 'string' && !Number.isNaN(Number(value))))) {
      kpis[title] = {
        valor: typeof value === 'number' ? value : Number(value),
        descricao: desc,
      };
    } else if (title.includes('—') || desc) {
      rotinas.push({ responsavel: title, descricao: value || desc });
    }
  }

  return { kpis, rotinas, linhas: rawRows };
}

/**
 * Lê e estrutura todos os dados da planilha de Controle Comercial
 */
export function readVendasExcelData() {
  const filePath = resolveWorkbookPath();

  if (!fs.existsSync(filePath)) {
    throw new Error(`Arquivo não encontrado no caminho: ${filePath}`);
  }

  const workbook = XLSX.readFile(filePath, { cellDates: true });
  const abasDisponiveis = workbook.SheetNames;

  const abas = {};
  for (const name of abasDisponiveis) {
    abas[name] = parseTabularSheet(workbook.Sheets[name]);
  }

  const vendasFinalizadas = abas['Vendas finalizadas'] || [];
  const clientes = abas['Clientes'] || [];
  const pipeline = abas['Pipeline comercial'] || [];
  const fornecedores = abas['Fornecedores'] || [];
  const entregas = abas['Entregas'] || [];
  const painelParsed = parsePainelSheet(workbook.Sheets['Painel']);

  const finalizedOrders = vendasFinalizadas
    .filter((row) => hasOrderData(row, 'Cliente', true))
    .map((row) => makeOrder(row, 'Vendas finalizadas', 'Pedidos Concluídos', ['Valor líquido (R$)', 'Valor bruto (R$)']));
  const pipelineOrders = pipeline
    .filter((row) => hasOrderData(row, 'Cliente / empresa'))
    .map((row) => makeOrder(row, 'Pipeline comercial', 'Pedidos em Aberto', ['Valor provável (R$)', 'Valor do orçamento (R$)']));
  const allOrders = [...finalizedOrders, ...pipelineOrders];
  const pedidosEmAberto = allOrders.filter((order) => order.categoriaPedido === 'Pedidos em Aberto');
  const vendasEmAndamento = allOrders.filter((order) => order.categoriaPedido === 'Vendas em Andamento');
  const pedidosConcluidos = allOrders.filter((order) => order.categoriaPedido === 'Pedidos Concluídos');
  const totalValue = (orders) => orders.reduce((sum, order) => sum + order.valorPedido, 0);

  // Totais consolidados para facilitar o consumo no Dashboard
  const totalValorBruto = vendasFinalizadas.reduce((acc, v) => acc + parseAmount(v['Valor bruto (R$)']), 0);
  const totalDesconto = vendasFinalizadas.reduce((acc, v) => acc + parseAmount(v['Desconto (R$)']), 0);
  const totalValorLiquido = vendasFinalizadas.reduce((acc, v) => acc + parseAmount(v['Valor líquido (R$)']), 0);
  const totalValorRecebido = vendasFinalizadas.reduce((acc, v) => acc + parseAmount(v['Valor recebido (R$)']), 0);
  const totalSaldoAReceber = vendasFinalizadas.reduce((acc, v) => acc + parseAmount(v['Saldo a receber (R$)']), 0);

  return {
    sucesso: true,
    arquivo: path.basename(filePath),
    caminhoArquivo: filePath,
    lidoEm: new Date().toISOString(),
    abasDisponiveis,
    resumo: {
      totalVendas: finalizedOrders.length,
      totalValorBruto,
      totalDesconto,
      totalValorLiquido,
      totalValorRecebido,
      totalSaldoAReceber,
      totalClientes: clientes.length,
      totalOportunidadesPipeline: pipelineOrders.length,
      totalFornecedores: fornecedores.length,
      totalEntregas: entregas.length,
      totalPedidosEmAberto: pedidosEmAberto.length,
      valorPedidosEmAberto: totalValue(pedidosEmAberto),
      totalVendasEmAndamento: vendasEmAndamento.length,
      valorVendasEmAndamento: totalValue(vendasEmAndamento),
      totalPedidosConcluidos: pedidosConcluidos.length,
      valorPedidosConcluidos: totalValue(pedidosConcluidos),
    },
    indicadoresPainel: painelParsed.kpis,
    rotinasPainel: painelParsed.rotinas,
    vendasFinalizadas,
    pedidos: allOrders,
    pedidosPorCategoria: {
      'Pedidos em Aberto': pedidosEmAberto,
      'Vendas em Andamento': vendasEmAndamento,
      'Pedidos Concluídos': pedidosConcluidos,
    },
    pedidosEmAberto,
    vendasEmAndamento,
    pedidosConcluidos,
    clientes,
    pipelineComercial: pipeline,
    fornecedores,
    entregas,
    abas,
  };
}

/**
 * Controller Express para a rota GET /api/vendas-excel
 */
export function getVendasExcel(_req, res) {
  try {
    const data = readVendasExcelData();
    return res.json(data);
  } catch (error) {
    console.error('Erro ao ler planilha Controle Comercial:', error);
    return res.status(500).json({
      sucesso: false,
      error: 'Não foi possível ler os dados da planilha de vendas.',
      mensagem: error.message,
    });
  }
}
