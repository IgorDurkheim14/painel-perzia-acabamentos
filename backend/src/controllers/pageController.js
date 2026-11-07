import { getPage, savePage } from '../database/pageStore.js';

export function getStatus(_req, res) {
  return res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    page: getPage(),
  });
}

export function updateSettings(req, res) {
  const { title, description } = req.body ?? {};

  if (!title && !description) {
    return res.status(400).json({ error: 'Informe ao menos um campo válido (title ou description).' });
  }

  const current = getPage();
  const nextTitle = typeof title === 'string' && title.trim() ? title.trim() : current.title;
  const nextDescription = typeof description === 'string' && description.trim() ? description.trim() : current.description;

  if (nextTitle.length > 100 || nextDescription.length > 500) {
    return res.status(400).json({ error: 'O título deve ter até 100 caracteres e a descrição até 500.' });
  }

  const page = savePage({ title: nextTitle, description: nextDescription });
  return res.json({
    message: 'Configurações atualizadas com sucesso.',
    page,
    settings: page,
  });
}

export function readSettings(_req, res) {
  const page = getPage();
  return res.json({ page, settings: page });
}

export const updatePage = updateSettings;
export const readPage = readSettings;
