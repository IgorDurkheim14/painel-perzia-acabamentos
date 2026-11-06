import { getPage, savePage } from '../database/pageStore.js';

export function updatePage(req, res) {
  const { title, description } = req.body ?? {};

  if (typeof title !== 'string' || typeof description !== 'string' || !title.trim() || !description.trim()) {
    return res.status(400).json({ error: 'Informe um título e uma descrição válidos.' });
  }

  if (title.trim().length > 100 || description.trim().length > 500) {
    return res.status(400).json({ error: 'O título deve ter até 100 caracteres e a descrição até 500.' });
  }

  const page = savePage({ title: title.trim(), description: description.trim() });
  return res.json({ message: 'Página atualizada com sucesso.', page });
}

export function readPage(_req, res) {
  return res.json({ page: getPage() });
}
