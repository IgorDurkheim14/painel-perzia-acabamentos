const API_BASE_URL = (import.meta.env?.VITE_API_URL || 'https://painel-perzia-acabamentos.onrender.com').replace(/\/$/, '');

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });

  if (!response.ok) {
    const contentType = response.headers.get('content-type') || '';
    const body = contentType.includes('application/json') ? await response.json() : null;
    const message = body?.error || body?.message || (!body ? await response.text() : '');
    const requestError = new Error(message || `Falha na requisição (${response.status})`);
    requestError.status = response.status;
    throw requestError;
  }

  if (response.status === 204) return null;
  const contentType = response.headers.get('content-type') || '';
  return contentType.includes('application/json') ? response.json() : response.text();
}

export function getServerStatus() {
  return request('/api/status');
}

export function getVendasExcel() {
  return request('/api/vendas-excel').then((response) => {
    if (Array.isArray(response)) {
      const rows = response.filter((item) => item && typeof item === 'object' && !Array.isArray(item));
      return { sucesso: true, resumo: {}, vendas: rows, vendasFinalizadas: rows, clientes: [] };
    }
    const payload = response?.data && typeof response.data === 'object' && !Array.isArray(response.data)
      ? response.data
      : response;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new Error('A API retornou um formato inválido para os dados da planilha.');
    }
    if (payload.sucesso === false || payload.success === false) {
      throw new Error(payload.error || payload.mensagem || 'A API não conseguiu ler a planilha.');
    }
    const vendas = Array.isArray(payload.vendasFinalizadas)
      ? payload.vendasFinalizadas
      : Array.isArray(payload.vendas) ? payload.vendas : [];
    const clientes = Array.isArray(payload.clientes) ? payload.clientes : [];
    const resumo = payload.resumo && typeof payload.resumo === 'object' && !Array.isArray(payload.resumo)
      ? payload.resumo
      : payload.summary && typeof payload.summary === 'object' && !Array.isArray(payload.summary) ? payload.summary : {};
    return {
      ...payload,
      sucesso: true,
      resumo,
      vendas: vendas.filter((item) => item && typeof item === 'object' && !Array.isArray(item)),
      vendasFinalizadas: vendas.filter((item) => item && typeof item === 'object' && !Array.isArray(item)),
      clientes: clientes.filter((item) => item && typeof item === 'object' && !Array.isArray(item)),
    };
  });
}

export function getCommercialData() {
  return request('/api/clientes').then((response) => {
    const body = response?.data && typeof response.data === 'object' && !Array.isArray(response.data) ? response.data : response;
    const payload = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
    return {
      ...payload,
      clientes: Array.isArray(payload.clientes) ? payload.clientes.filter(Boolean) : [],
      prospects: Array.isArray(payload.prospects) ? payload.prospects.filter(Boolean) : [],
      clientes_ativos: Array.isArray(payload.clientes_ativos) ? payload.clientes_ativos.filter(Boolean) : [],
    };
  });
}

export function createClient(data) {
  return request('/api/clientes', { method: 'POST', body: JSON.stringify(data) });
}

export function createContact(data) {
  return request('/api/contatos', { method: 'POST', body: JSON.stringify(data) });
}

export function getContacts() {
  return request('/api/contatos').then((response) => {
    const body = response?.data ?? response;
    const list = Array.isArray(body) ? body : Array.isArray(body?.contatos) ? body.contatos : [];
    return list.filter((item) => item && typeof item === 'object' && !Array.isArray(item));
  });
}

export function closeClientDeal(id, valor) {
  return request(`/api/clientes/${encodeURIComponent(id)}/fechar-negocio`, {
    method: 'PATCH', body: JSON.stringify({ valor }),
  });
}

export function updateClient(id, data) {
  return request(`/api/clientes/${encodeURIComponent(id)}`, {
    method: 'PATCH', body: JSON.stringify(data),
  });
}

// Blog endpoints
export function getRascunhos() {
  return request('/api/blog/rascunhos');
}

export function approveBlogPost(id) {
  return request(`/api/blog/aprovar/${encodeURIComponent(id)}`, { method: 'PUT' });
}

export function getPublicPosts() {
  return request('/api/blog/publicos');
}
(admin = false) {
  return request(`/api/posts${admin ? '?admin=1' : ''}`).then((response) => {
    const body = response?.data ?? response;
    const list = Array.isArray(body) ? body : Array.isArray(body?.posts) ? body.posts : [];
    return list.filter((item) => item && typeof item === 'object' && !Array.isArray(item));
  });
}

export function getWeather() {
  return request('/api/clima').then((response) => {
    const body = response?.data && typeof response.data === 'object' ? response.data : response;
    return {
      ...(body && typeof body === 'object' && !Array.isArray(body) ? body : {}),
      cidades: Array.isArray(body?.cidades) ? body.cidades.filter((city) => city && typeof city === 'object' && !Array.isArray(city)) : [],
    };
  });
}

export function createPost(data) {
  return request('/api/posts', { method: 'POST', body: JSON.stringify(data) });
}

export function updatePost(id, data) {
  return request(`/api/posts/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export function generatePost(data) {
  return request('/api/posts/gerar', { method: 'POST', body: JSON.stringify(data) });
}

export function updatePage(data) {
  return request('/api/page', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
