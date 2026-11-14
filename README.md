# Jaiane Neves - Frontend online

Paginas estaticas na raiz, sem dependencias e sem build. Publique como Other com Root Directory vazio e sem comandos de instalacao ou build.

## Conectar a agenda

O backend fica em outro repositorio (salaoback) e usa PostgreSQL persistente. Preencha window.AGENDA_API_URL em config.js com a origem HTTPS do backend, sem /api no final. Nao coloque senhas nem conexoes de banco nesse arquivo publico.

Configure FRONTEND_ORIGINS no backend com a origem exata deste site e publique os dois projetos. Sem a URL ou sem banco configurado, a agenda mostra erro e nao confirma reservas falsas.

Reservas, nomes e cancelamentos sao salvos no banco compartilhado, nunca no localStorage. Somente o token de login administrativo fica na aba, em sessionStorage. O painel atualiza a lista a cada 5 segundos e o calendario a cada 15 segundos enquanto visiveis.

Os dados antigos gravados em navegadores nao sao apagados nem importados automaticamente. Os registros do caderno sao inicializados no backend. A senha administrativa e configurada no backend.
