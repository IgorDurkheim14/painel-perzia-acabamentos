import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const storageFile = path.join(__dirname, 'pageSettings.json');

const defaultPage = {
  title: 'Bem-vindo à nossa página',
  description: 'Edite este texto para apresentar sua página aos visitantes.',
};

function loadStoredPage() {
  try {
    if (fs.existsSync(storageFile)) {
      const content = fs.readFileSync(storageFile, 'utf-8');
      return { ...defaultPage, ...JSON.parse(content) };
    }
  } catch (error) {
    console.warn('Não foi possível ler pageSettings.json, usando valores padrão:', error.message);
  }
  return { ...defaultPage };
}

let page = loadStoredPage();

export function getPage() {
  return { ...page };
}

export function savePage(nextPage) {
  page = { ...page, ...nextPage };
  try {
    fs.writeFileSync(storageFile, JSON.stringify(page, null, 2), 'utf-8');
  } catch (error) {
    console.warn('Não foi possível persistir no arquivo pageSettings.json:', error.message);
  }
  return getPage();
}
