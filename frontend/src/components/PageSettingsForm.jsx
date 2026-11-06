import { useState } from 'react';
import Button from './Button.jsx';

export default function PageSettingsForm({ initialValues, onSave }) {
  const [title, setTitle] = useState(initialValues.title);
  const [description, setDescription] = useState(initialValues.description);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      await onSave({ title: title.trim(), description: description.trim() });
      setFeedback({ type: 'success', text: 'Alterações salvas com sucesso.' });
    } catch (error) {
      setFeedback({ type: 'error', text: error.message || 'Não foi possível salvar as alterações.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card form-card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Conteúdo</p>
          <h2>Informações da página</h2>
        </div>
        <span className="heading-mark" aria-hidden="true">✎</span>
      </div>
      <form onSubmit={handleSubmit}>
        <label htmlFor="page-title">Título da página</label>
        <input id="page-title" name="title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={100} required />

        <label htmlFor="page-description">Descrição</label>
        <textarea id="page-description" name="description" value={description} onChange={(event) => setDescription(event.target.value)} rows={5} maxLength={500} required />
        <div className="form-footer">
          <p className={`feedback ${feedback?.type || ''}`} role="status">{feedback?.text || 'As alterações serão publicadas na página.'}</p>
          <Button type="submit" loading={saving}>Salvar alterações <span aria-hidden="true">→</span></Button>
        </div>
      </form>
    </section>
  );
}
