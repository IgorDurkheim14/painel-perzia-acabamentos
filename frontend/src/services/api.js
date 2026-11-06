const API_BASE_URL = 'http://localhost:3001';

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });

  if (!response.ok) {
    const contentType = response.headers.get('content-type') || '';
    const body = contentType.includes('application/json') ? await response.json() : null;
    const message = body?.error || body?.message || (!body ? await response.text() : '');
    throw new Error(message || `Falha na requisição (${response.status})`);
  }

  if (response.status === 204) return null;
  const contentType = response.headers.get('content-type') || '';
  return contentType.includes('application/json') ? response.json() : response.text();
}

export function getServerStatus() {
  return request('/api/status');
}

export function getCommercialData() {
  return request('/api/clientes');
}

export function createClient(data) {
  return request('/api/clientes', { method: 'POST', body: JSON.stringify(data) });
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

export function getPosts(admin = false) {
  return request(`/api/posts${admin ? '?admin=1' : ''}`);
}

export function getWeather() {
  return request('/api/clima');
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
