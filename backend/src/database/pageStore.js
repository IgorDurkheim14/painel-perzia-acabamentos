// Armazenamento temporário em memória; os dados são reiniciados ao reiniciar o servidor.
let page = {
  title: 'Bem-vindo à nossa página',
  description: 'Edite este texto para apresentar sua página aos visitantes.',
};

export function getPage() {
  return { ...page };
}

export function savePage(nextPage) {
  page = { ...nextPage };
  return getPage();
}
