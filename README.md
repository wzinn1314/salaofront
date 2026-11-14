# Jaiane Neves - Agenda local

Frontend estatico, sem servidor e sem API. HTML, CSS e JavaScript ficam na raiz.

## Vercel

Framework Other; Root Directory .; Output Directory .; sem comandos de build ou instalacao. O arquivo vercel.json ja configura essa publicacao.

## Uso

O calendario, as reservas e o painel usam localStorage no navegador. Os 21 registros do caderno sao carregados na primeira utilizacao e permanecem confirmados. O periodo termina em 27/12/2026.

No primeiro acesso a /admin, crie uma senha local com pelo menos 12 caracteres. A senha serve apenas para organizar o acesso neste navegador; nao e autenticacao de servidor. Os nomes do caderno fazem parte dos arquivos estaticos.

Novas reservas e cancelamentos ficam somente neste navegador e dominio. Outros aparelhos nao recebem essas alteracoes e podem escolher o mesmo horario. Limpar os dados do navegador remove as alteracoes e a senha local. Use o mesmo navegador para administrar a agenda.

O backend separado em salaoback nao e utilizado por esta versao.
