import express from 'express';
import cors from 'cors';
import XLSX from 'xlsx';
import { fileURLToPath } from 'node:url';
import pageRoutes from './src/routes/pageRoutes.js';
import { getPage } from './src/database/pageStore.js';

const app = express();
const PORT = Number(process.env.PORT) || 3001;
const workbookPath = fileURLToPath(new URL('../Controle_Comercial_Perzia_Acabamentos.xlsx', import.meta.url));
const exportedClientsPath = fileURLToPath(new URL('../cliente.xlsx', import.meta.url));
const exportedSalesPath = fileURLToPath(new URL('../relvendas_06_11_2026_11_16_25.xlsx', import.meta.url));

const operationalSheets = {
  Clientes: 'clientes',
  'Pipeline comercial': 'pipeline',
  Fornecedores: 'fornecedores',
  Entregas: 'entregas',
  'Vendas finalizadas': 'vendasFinalizadas',
};

function readCommercialData() {
  const workbook = XLSX.readFile(workbookPath, { cellDates: true });
  const data = {};

  for (const [sheetName, responseKey] of Object.entries(operationalSheets)) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      data[responseKey] = [];
      continue;
    }

    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, blankrows: false });
    const headerIndex = rows.findIndex((row) => row.some((cell) => typeof cell === 'string' && /^(ID cliente|ID oportunidade|ID fornecedor|ID entrega|ID venda)$/i.test(cell.trim())));
    if (headerIndex < 0) {
      data[responseKey] = [];
      continue;
    }

    const headers = rows[headerIndex].map((header) => typeof header === 'string' ? header.trim() : header);
    data[responseKey] = rows.slice(headerIndex + 1)
      .filter((row) => row.some((cell) => cell !== null && cell !== ''))
      .map((row) => Object.fromEntries(headers
        .map((header, index) => [header, row[index] ?? null])
        .filter(([header]) => typeof header === 'string' && header.length > 0)));
  }

  return data;
}

function amount(value) {
  if (typeof value === 'number') return value;
  const parsed = Number(String(value ?? '').replace(/[^\d,.-]/g, '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizedHeader(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleUpperCase('pt-BR').replace(/[^A-Z0-9]/g, '');
}

function valueFrom(row, header) {
  const target = normalizedHeader(header);
  const entry = Object.entries(row).find(([key]) => normalizedHeader(key) === target);
  return entry?.[1] ?? null;
}

function normalizeCode(value) {
  if (value === null || value === undefined || value === '') return '';
  const code = String(value).trim().replace(/\.0+$/, '');
  return code.replace(/^0+(?=\d)/, '');
}

function normalizeName(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]/g, '');
}

function spreadsheetDate(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    return parsed ? new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d, parsed.H, parsed.M, parsed.S)) : null;
  }
  const text = String(value).trim();
  const brDate = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const date = brDate ? new Date(Date.UTC(Number(brDate[3]), Number(brDate[2]) - 1, Number(brDate[1]))) : new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function readSheetRows(path) {
  const workbook = XLSX.readFile(path, { cellDates: true });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  return firstSheet ? XLSX.utils.sheet_to_json(firstSheet, { defval: null, blankrows: false }) : [];
}

function readExportedCRMClients() {
  const clientRows = readSheetRows(exportedClientsPath);
  const salesRows = readSheetRows(exportedSalesPath);
  const salesByCode = new Map();
  const salesByName = new Map();

  for (const sale of salesRows) {
    const code = normalizeCode(valueFrom(sale, 'COD CLIENTE'));
    const name = normalizeName(valueFrom(sale, 'CLIENTE'));
    if (code) salesByCode.set(code, [...(salesByCode.get(code) ?? []), sale]);
    if (name) salesByName.set(name, [...(salesByName.get(name) ?? []), sale]);
  }

  return clientRows.filter((row) => valueFrom(row, 'NOME')).map((row, index) => {
    const code = normalizeCode(valueFrom(row, 'CODIGO'));
    const name = String(valueFrom(row, 'NOME')).trim();
    const relatedSales = (code && salesByCode.get(code)) || salesByName.get(normalizeName(name)) || [];
    const total = relatedSales.reduce((sum, sale) => sum + amount(valueFrom(sale, 'VR. LIQUIDO') ?? valueFrom(sale, 'VALOR')), 0);
    const saleDates = relatedSales
      .map((sale) => spreadsheetDate(valueFrom(sale, 'DATA')) || spreadsheetDate(valueFrom(sale, 'DT. FATURAMENTO')))
      .filter(Boolean)
      .sort((first, second) => second.getTime() - first.getTime());
    const cityName = valueFrom(row, 'CIDADE') || valueFrom(row, 'CIDADE ENTREGA') || valueFrom(row, 'CIDADE COBRANCA') || '';
    const state = valueFrom(row, 'UF') || valueFrom(row, 'UF ENTREGA') || valueFrom(row, 'UF COBRANCA') || '';
    const location = [cityName, state].filter(Boolean).join(' - ');
    const thirdParty = valueFrom(row, 'TERCEIRO');
    const hasThirdParty = Boolean(thirdParty) && !['nao', 'false', '0'].includes(normalizeName(thirdParty));
    const detailedOrigin = valueFrom(row, 'ORIGEM DO RELACIONAMENTO') || valueFrom(row, 'TIPO DE COMPRA');
    const tipoCompra = detailedOrigin
      ? (['direta', 'vendadireta'].includes(normalizeName(detailedOrigin)) ? 'Venda Direta' : String(detailedOrigin))
      : (hasThirdParty ? 'Por Terceiros' : 'Venda Direta');
    return {
      id: `export-${code || `sem-codigo-${index + 1}`}`,
      codigo: code || null,
      nome: name,
      tipo: String(valueFrom(row, 'TIPO') ?? 'Residencial'),
      cidade: location,
      status: relatedSales.length ? 'Cliente ativo' : 'Novo cadastro',
      valor: total,
      projeto: String(valueFrom(row, 'SEGMENTO') ?? ''),
      ultimaCompra: saleDates[0]?.toISOString().slice(0, 10) ?? null,
      tipoCompra,
      canalCompra: tipoCompra === 'Venda Direta' ? 'Direta' : 'Por Terceiros',
      observacoes: String(valueFrom(row, 'OBSERVACOES') ?? valueFrom(row, 'OBSERVACAO') ?? ''),
      categoria: relatedSales.length ? 'clientes_ativos' : 'prospects',
      criadoEm: null,
      historico: relatedSales,
      dadosPlanilha: row,
    };
  });
}

let crmClients = [];
let posts = [];
const weatherCities = [
  { id: 'goiania', nome: 'Goiânia', latitude: -16.6799, longitude: -49.255 },
  { id: 'rio-verde', nome: 'Rio Verde', latitude: -17.7923, longitude: -50.9192 },
  { id: 'anapolis', nome: 'Anápolis', latitude: -16.3269, longitude: -48.9528 },
  { id: 'caldas-novas', nome: 'Caldas Novas', latitude: -17.7443, longitude: -48.6269 },
];
let weatherCache = { expiresAt: 0, cidades: [] };

function weatherCondition(code) {
  if (code === 0) return 'Ensolarado';
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].includes(code)) return 'Chuva';
  return 'Nublado';
}

try {
  const workbookData = readCommercialData();
  crmClients = workbookData.clientes
    .filter((row) => row['Nome / Razão social'])
    .map((row, index) => {
      const name = row['Nome / Razão social'];
      const relatedSales = workbookData.vendasFinalizadas.filter((sale) => String(sale.Cliente ?? '').trim().toLocaleLowerCase('pt-BR') === String(name).trim().toLocaleLowerCase('pt-BR'));
      const value = relatedSales.reduce((sum, sale) => sum + amount(sale['Valor líquido (R$)'] ?? sale['Valor bruto (R$)']), 0);
      const relatedProjects = relatedSales.map((sale) => sale['Produtos / descrição']).filter(Boolean);
      return {
        id: row['ID cliente'] || `planilha-${index + 1}`,
        nome: name,
        tipo: row.Tipo || 'Residencial',
        status: row['Status do relacionamento'] || (value > 0 ? 'Cliente ativo' : 'Novo cadastro'),
        valor: value,
        projeto: relatedProjects.join(', ') || row['Perfil / interesse'] || '',
        categoria: value > 0 ? 'clientes_ativos' : 'prospects',
        criadoEm: row['Data do cadastro'] || null,
        historico: relatedSales,
        dadosPlanilha: row,
      };
    });
} catch (error) {
  console.error('Não foi possível carregar os clientes iniciais da planilha:', error.message);
}

try {
  crmClients = readExportedCRMClients();
} catch (error) {
  console.error('Could not load clients from official export workbooks:', error.message);
}

function serializeClient(client) {
  const { dadosPlanilha, historico, ...publicClient } = client;
  return { ...publicClient, historico, dadosPlanilha };
}

app.use(cors({ origin: ['http://localhost:5173', 'http://127.0.0.1:5173'] }));
app.use(express.json());

app.get('/api/status', (_req, res) => {
  res.json({ status: 'online', page: getPage() });
});

app.get('/api/clientes', (_req, res) => {
  res.json({
    clientes: crmClients.map(serializeClient),
    prospects: crmClients.filter((client) => client.categoria === 'prospects').map(serializeClient),
    clientes_ativos: crmClients.filter((client) => client.categoria === 'clientes_ativos').map(serializeClient),
  });
});

app.post('/api/clientes', (req, res) => {
  const { Nome, nome, Tipo, tipo, Status, status, Valor, valor, Projeto, projeto, Cidade, cidade } = req.body ?? {};
  const clientName = String(Nome ?? nome ?? '').trim();
  const clientType = String(Tipo ?? tipo ?? '').trim();
  const allowedTypes = ['Residencial', 'Comercial', 'Escolar'];
  if (!clientName) return res.status(400).json({ error: 'Informe o nome do cliente.' });
  if (!allowedTypes.includes(clientType)) return res.status(400).json({ error: 'Tipo deve ser Residencial, Comercial ou Escolar.' });

  const initialValue = Math.max(0, amount(Valor ?? valor));
  const client = {
    id: `crm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    nome: clientName,
    tipo: clientType,
    status: String(Status ?? status ?? 'Novo cadastro').trim() || 'Novo cadastro',
    valor: initialValue,
    projeto: String(Projeto ?? projeto ?? '').trim(),
    cidade: String(Cidade ?? cidade ?? '').trim(),
    ultimaCompra: null,
    tipoCompra: 'Venda Direta',
    canalCompra: 'Direta',
    observacoes: '',
    categoria: initialValue > 0 ? 'clientes_ativos' : 'prospects',
    criadoEm: new Date().toISOString(),
    historico: [],
  };
  crmClients.unshift(client);
  res.status(201).json(serializeClient(client));
});

app.patch('/api/clientes/:id', (req, res) => {
  const client = crmClients.find((item) => item.id === req.params.id);
  if (!client) return res.status(404).json({ error: 'Cliente não encontrado.' });
  const { Nome, nome, Tipo, tipo, Status, status, Valor, valor, Projeto, projeto, Cidade, cidade, tipoCompra, canalCompra, observacoes, observacao } = req.body ?? {};
  const allowedTypes = ['Residencial', 'Comercial', 'Escolar'];

  if (Nome !== undefined || nome !== undefined) {
    const clientName = String(Nome ?? nome).trim();
    if (!clientName) return res.status(400).json({ error: 'O nome do cliente não pode ficar vazio.' });
    client.nome = clientName;
  }
  if (Tipo !== undefined || tipo !== undefined) {
    const clientType = String(Tipo ?? tipo).trim();
    if (!allowedTypes.includes(clientType) && clientType !== client.tipo) return res.status(400).json({ error: 'Tipo deve ser Residencial, Comercial ou Escolar.' });
    client.tipo = clientType;
  }
  if (Status !== undefined || status !== undefined) client.status = String(Status ?? status).trim();
  if (Projeto !== undefined || projeto !== undefined) client.projeto = String(Projeto ?? projeto).trim();
  if (Cidade !== undefined || cidade !== undefined) client.cidade = String(Cidade ?? cidade).trim();
  if (Valor !== undefined || valor !== undefined) client.valor = Math.max(0, amount(Valor ?? valor));
  if (tipoCompra !== undefined || canalCompra !== undefined) {
    const requestedType = String(tipoCompra ?? canalCompra).trim();
    const nextType = requestedType === 'Direta' ? 'Venda Direta' : requestedType;
    const validPurchaseTypes = ['Venda Direta', 'Por Terceiros', 'Indicação de Arquiteto(a)', 'Especificação de Engenheiro(a)', 'Funcionário/Parceiro'];
    if (!validPurchaseTypes.includes(nextType)) return res.status(400).json({ error: 'Selecione um tipo de compra válido.' });
    client.tipoCompra = nextType;
    client.canalCompra = nextType === 'Venda Direta' ? 'Direta' : 'Por Terceiros';
  }
  if (observacoes !== undefined || observacao !== undefined) client.observacoes = String(observacoes ?? observacao).trim();
  client.categoria = client.valor > 0 ? 'clientes_ativos' : 'prospects';
  res.json(serializeClient(client));
});

app.patch('/api/clientes/:id/fechar-negocio', (req, res) => {
  const client = crmClients.find((item) => item.id === req.params.id);
  if (!client) return res.status(404).json({ error: 'Cliente não encontrado.' });
  const value = amount(req.body?.valor ?? req.body?.Valor);
  if (value <= 0) return res.status(400).json({ error: 'Informe um valor de negócio maior que zero.' });
  client.valor = value;
  client.status = String(req.body?.status ?? 'Negócio fechado');
  client.categoria = 'clientes_ativos';
  client.historico.unshift({ tipo: 'Negócio fechado', valor: value, data: new Date().toISOString() });
  res.json(serializeClient(client));
});

app.get('/api/posts', (req, res) => {
  res.json(req.query.admin === '1' ? posts : posts.filter((post) => post.status === 'publicado'));
});

app.post('/api/posts/gerar', async (req, res) => {
  const { tema, publico, incluirArkos } = req.body ?? {};
  const theme = String(tema ?? '').trim();
  const audience = String(publico ?? '').trim();
  const audiences = ['Residencial de Luxo', 'Imóveis Comerciais', 'Arquitetos/Engenheiros', 'Escolas/Instituições'];
  if (!theme) return res.status(400).json({ error: 'Informe o tema ou conceito do artigo.' });
  if (theme.length > 200) return res.status(400).json({ error: 'O tema deve ter no máximo 200 caracteres.' });
  if (!audiences.includes(audience)) return res.status(400).json({ error: 'Selecione um público-alvo válido.' });
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'Configure OPENAI_API_KEY no ambiente do backend para gerar artigos.' });

  const instructions = [
    'Você é redator editorial brasileiro especializado em arquitetura, interiores e acabamentos de alto padrão para a Pérzia Acabamentos.',
    'Escreva em português brasileiro, com tom sofisticado, informativo e acessível a clientes finais, arquitetos e designers.',
    'Produza um artigo original em Markdown, com 450 a 650 palavras, sem bloco de código e sem cercas Markdown.',
    'A primeira linha deve ser um único título no formato # Título impactante. Depois use subtítulos ##, parágrafos curtos e listas apenas quando ajudarem a leitura.',
    'Inclua: introdução sobre estética e função; seção com soluções da Pérzia e marcas/linhas pertinentes (Arkos Brasil, porcelanatos e revestimentos de alto padrão, louças e metais de luxo, cobogós, pedras naturais e grandes formatos); dica técnica para especificadores sobre resistência, durabilidade e aplicação; e uma seção final com o CTA exato: "Visite nosso showroom em Goiás ou consulte nosso catálogo exclusivo Arkos na Pérzia Acabamentos".',
    incluirArkos ? 'Informe com naturalidade que a Pérzia Acabamentos é representante oficial Arkos em Goiás e cite Arkos Brasil como parceira oficial.' : 'Não afirme que a Pérzia é representante oficial da Arkos. Arkos pode ser mencionada como uma das marcas disponíveis quando relevante.',
    'Não invente nomes de coleções, modelos, certificações, garantia, desempenho ou especificações técnicas. Para números ou compatibilidade, recomende consultar a ficha técnica do fabricante e validar com o responsável pelo projeto.',
  ].join(' ');

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      signal: AbortSignal.timeout(60000),
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-6-astra',
        instructions,
        input: `Tema/conceito: ${theme}\nPúblico-alvo: ${audience}\nIncluir parceria oficial Arkos em Goiás: ${incluirArkos ? 'sim' : 'não'}.`,
        reasoning: { effort: 'low' },
        max_output_tokens: 2200,
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      console.error('OpenAI Responses API error:', response.status, payload.error?.message || 'sem detalhes');
      return res.status(502).json({ error: 'A geração do artigo falhou. Verifique o modelo e o acesso da chave OpenAI.' });
    }
    const markdown = (payload.output ?? [])
      .flatMap((item) => item.content ?? [])
      .filter((item) => item.type === 'output_text')
      .map((item) => item.text)
      .join('\n')
      .replace(/^```(?:markdown)?\s*/i, '')
      .replace(/\s*```\s*$/, '')
      .trim();
    if (!markdown) return res.status(502).json({ error: 'A IA não retornou conteúdo para o artigo.' });

    const lines = markdown.split(/\r?\n/);
    const titleLineIndex = lines.findIndex((line) => /^#\s+/.test(line));
    const titulo = titleLineIndex >= 0 ? lines[titleLineIndex].replace(/^#\s+/, '').trim() : theme;
    const conteudo = titleLineIndex >= 0 ? [...lines.slice(0, titleLineIndex), ...lines.slice(titleLineIndex + 1)].join('\n').trim() : markdown;
    const summary = conteudo.split(/\n\s*\n/).find((paragraph) => paragraph.trim() && !paragraph.trim().startsWith('#')) || '';
    const resumo = summary.replace(/[*_`>#]/g, '').replace(/\s+/g, ' ').trim().slice(0, 260);
    res.json({ titulo, categoria: 'Arquitetura e acabamentos', resumo, conteudo, status: 'publicado' });
  } catch (error) {
    console.error('Article generation failed:', error);
    res.status(502).json({ error: 'Não foi possível conectar ao serviço de geração de artigos.' });
  }
});

app.get('/api/clima', async (_req, res) => {
  if (weatherCache.expiresAt > Date.now()) return res.json({ atualizadoEm: weatherCache.atualizadoEm, cidades: weatherCache.cidades });

  try {
    const cidades = await Promise.all(weatherCities.map(async (city) => {
      const url = new URL('https://api.open-meteo.com/v1/forecast');
      url.search = new URLSearchParams({
        latitude: String(city.latitude),
        longitude: String(city.longitude),
        current: 'temperature_2m,relative_humidity_2m,weather_code',
        timezone: 'America/Sao_Paulo',
      });
      const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error(`Open-Meteo respondeu ${response.status} para ${city.nome}`);
      const weather = await response.json();
      if (!weather.current) throw new Error(`Dados atuais indisponíveis para ${city.nome}`);
      return {
        id: city.id,
        nome: city.nome,
        temperatura: weather.current.temperature_2m,
        condicao: weatherCondition(weather.current.weather_code),
        umidade: weather.current.relative_humidity_2m,
      };
    }));
    weatherCache = { expiresAt: Date.now() + 5 * 60 * 1000, atualizadoEm: new Date().toISOString(), cidades };
    res.json({ atualizadoEm: weatherCache.atualizadoEm, cidades });
  } catch (error) {
    console.error('Falha ao consultar o clima:', error);
    res.status(502).json({ error: 'Não foi possível consultar o clima agora.' });
  }
});

app.post('/api/posts', (req, res) => {
  const { titulo, title, categoria, category, resumo, excerpt, conteudo, content, autor, status } = req.body ?? {};
  const postTitle = String(titulo ?? title ?? '').trim();
  const postContent = String(conteudo ?? content ?? '').trim();
  if (!postTitle || !postContent) return res.status(400).json({ error: 'Informe o título e o conteúdo do artigo.' });
  const createdAt = new Date().toISOString();
  const postStatus = status === 'rascunho' ? 'rascunho' : 'publicado';
  const post = {
    id: `post-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    titulo: postTitle,
    categoria: String(categoria ?? category ?? 'Arquitetura e acabamentos').trim(),
    resumo: String(resumo ?? excerpt ?? '').trim(),
    conteudo: postContent,
    autor: String(autor ?? 'Pérzia Acabamentos').trim(),
    status: postStatus,
    criadoEm: createdAt,
    publicadoEm: postStatus === 'publicado' ? createdAt : null,
  };
  posts.unshift(post);
  res.status(201).json(post);
});

app.patch('/api/posts/:id', (req, res) => {
  const post = posts.find((item) => item.id === req.params.id);
  if (!post) return res.status(404).json({ error: 'Artigo não encontrado.' });
  const { titulo, categoria, resumo, conteudo, status } = req.body ?? {};
  if (titulo !== undefined) {
    if (!String(titulo).trim()) return res.status(400).json({ error: 'Informe o título do artigo.' });
    post.titulo = String(titulo).trim();
  }
  if (categoria !== undefined) post.categoria = String(categoria).trim();
  if (resumo !== undefined) post.resumo = String(resumo).trim();
  if (conteudo !== undefined) {
    if (!String(conteudo).trim()) return res.status(400).json({ error: 'Informe o conteúdo do artigo.' });
    post.conteudo = String(conteudo).trim();
  }
  if (status !== undefined) {
    if (!['rascunho', 'publicado'].includes(status)) return res.status(400).json({ error: 'Status deve ser rascunho ou publicado.' });
    post.status = status;
    if (status === 'publicado' && !post.publicadoEm) post.publicadoEm = new Date().toISOString();
  }
  post.atualizadoEm = new Date().toISOString();
  res.json(post);
});

app.use('/api', pageRoutes);

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: 'Erro interno do servidor.' });
});

app.listen(PORT, () => {
  console.log(`Backend disponível em http://localhost:${PORT}`);
});
