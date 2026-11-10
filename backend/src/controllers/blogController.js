// backend/src/controllers/blogController.js
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJsonArray, persistJsonArray, createFallbackBlogDraft } from '../server.js';

// Diretório de dados, mesma lógica usada em server.js
const dataDirectory = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : fileURLToPath(new URL('../src/database', import.meta.url));
const POSTS_FILE = path.join(dataDirectory, 'posts.json');

const POSTS_FILE = 'posts.json'; // located in src/database
const WHATSAPP_NUMBER = '5562994481441'; // número comercial da Pérzia

/** Monta URL do WhatsApp com o título do artigo */
function makeWhatsAppUrl(title) {
  const text = `Olá, vi o artigo no blog da Pérzia sobre ${title}`;
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}

/**
 * POST /api/blog/gerar
 * Gera artigo (OpenAI ou fallback) e salva como rascunho.
 */
export async function gerarBlogPost(req, res) {
  try {
    const { tema, publico, incluirArkos } = req.body ?? {};
    const theme = String(tema ?? '').trim();
    const audience = String(publico ?? '').trim();

    if (!theme) return res.status(400).json({ error: 'Informe o tema.' });
    if (!audience) return res.status(400).json({ error: 'Informe o público.' });

    // Se houver chave OpenAI, poderia delegar ao código já existente em server.js.
    // Para simplificar, usamos sempre o fallback local.
    const draft = createFallbackBlogDraft(theme, audience, Boolean(incluirArkos));
    draft.whatsappUrl = makeWhatsAppUrl(draft.titulo);
    draft.autor = 'Pérzia Acabamentos · IA';
    draft.id = `draft-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    draft.criadoEm = new Date().toISOString();
    draft.status = 'rascunho';

    const posts = readJsonArray(POSTS_FILE);
    posts.unshift(draft);
    persistJsonArray(POSTS_FILE, posts);

    return res.json(draft);
  } catch (err) {
    console.error('Erro ao gerar post:', err);
    return res.status(500).json({ error: 'Falha ao gerar o artigo.' });
  }
}

/**
 * PUT /api/blog/aprovar/:id
 * Aprova o post, mudando seu status diretamente para "publicado".
 */
export async function aprovarPost(req, res) {
  const { id } = req.params;
  const posts = readJsonArray(POSTS_FILE);
  const index = posts.findIndex(p => p.id === id);
  if (index < 0) return res.status(404).json({ error: 'Artigo não encontrado.' });

  posts[index].status = 'publicado'; // ajuste solicitado
  posts[index].atualizadoEm = new Date().toISOString();

  persistJsonArray(POSTS_FILE, posts);
  return res.json(posts[index]);
}

/**
 * GET /api/blog/publicos
 * Retorna apenas artigos com status "publicado".
 */
export async function listarPublicos(_req, res) {
  const posts = readJsonArray(POSTS_FILE);
  const publicados = posts.filter(p => p.status === 'publicado');
  return res.json(publicados);
}

/**
 * GET /api/blog/rascunhos
 * Retorna apenas artigos com status "rascunho" (para a aba de Gestão de Conteúdo).
 */
export async function listarRascunhos(_req, res) {
  const posts = readJsonArray(POSTS_FILE);
  const rascunhos = posts.filter(p => p.status === 'rascunho');
  return res.json(rascunhos);
}

/** (opcional) DELETE /api/blog/:id */
export async function excluirPost(req, res) {
  const { id } = req.params;
  const posts = readJsonArray(POSTS_FILE);
  const filtered = posts.filter(p => p.id !== id);
  if (filtered.length === posts.length) {
    return res.status(404).json({ error: 'Artigo não encontrado.' });
  }
  persistJsonArray(POSTS_FILE, filtered);
  return res.json({ message: 'Artigo excluído.' });
}
