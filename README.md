# Jaiane Neves - Agendamento

Site estatico com todos os arquivos na raiz do repositorio. Nao tem dependencias, instalacao, etapa de build ou servidor.

## Arquivos

- index.html: pagina inicial de agendamento.
- admin.html: painel administrativo.
- styles.css: estilos.
- script.js e admin.js: interacoes das paginas.
- agenda-local.js: armazenamento e regras locais.
- agenda-caderno.js: reservas confirmadas do caderno.

## Publicacao

Importe a branch main como projeto estatico (Other). Use a raiz do repositorio, sem selecionar subpasta. Deixe instalacao e build vazios e desative overrides herdados de projetos anteriores. Se for solicitado um diretorio de saida, use ponto (.).

O painel abre por admin.html; todos os links e arquivos usam caminhos relativos, sem depender de regras de reescrita de URL.

## Dados locais

Novas reservas ficam somente neste navegador e dominio. Outros aparelhos nao sincronizam alteracoes e podem escolher o mesmo horario. No primeiro acesso ao painel, crie uma senha local de pelo menos 12 caracteres. Ela organiza o acesso local, sem autenticacao de servidor.

Limpar os dados do navegador remove as alteracoes e a senha. Os registros iniciais do caderno ficam nos arquivos publicos do site, conforme autorizado. O atendimento termina em 27/12/2026.
