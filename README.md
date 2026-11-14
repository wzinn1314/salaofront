# Jaiane Neves — Agendamento

Interface HTML, CSS e JavaScript, sem imagem no cabeçalho. Progressiva e selagem, com nome, WhatsApp e comprimento do cabelo. Valor confirmado após avaliação. Duração provisória: 120 minutos.

## Organização das pastas

- `frontend/`: páginas de agendamento e administração, estilos CSS e JavaScript do navegador.
- `backend/`: API, autenticação, regras da agenda, conexão com o banco e servidor local.
- `scripts/`: geração do pacote de publicação.
- `tests/`: testes do frontend, backend e servidor HTTP.
- `drizzle/`: migrações do banco, mantidas na raiz para publicação pelo Sites.

Os comandos abaixo são executados na raiz do projeto. O backend serve o frontend e a API no mesmo endereço.

## Rodar no computador (porta 5500)

Requisito: Node.js 22.13 ou superior (validado com Node.js 24). Não precisa instalar pacotes.

1. Abra o terminal nesta pasta.
2. Pare o Live Server, se estiver usando a porta 5500.
3. Execute `npm start` (ou `node backend/dev-server.mjs`).
4. Abra http://localhost:5500 e http://localhost:5500/admin.

Use Ctrl+C para encerrar. `npm run dev` reinicia o servidor quando o código do backend muda. HTML, CSS e JavaScript são lidos diretamente de frontend/ em cada acesso; atualize a página para ver mudanças.

O servidor local executa a mesma API de agendamento, usando SQLite persistente em .local/agendamentos.sqlite. Ele aplica as migrações automaticamente. Dados e credenciais locais são ignorados pelo Git e independentes do site publicado. Em um computador novo, a senha inicial numérica aparece no terminal somente na primeira execução e pode ser trocada no painel; apenas o hash é armazenado. Neste computador, foi configurada a mesma senha numérica já fornecida.

Abra o endereço do servidor, sem /frontend, /public ou /dist. Os caminhos antigos também são redirecionados. Não abra o arquivo HTML diretamente nem use Go Live: isso não executa a API. O servidor aceita conexões somente deste computador. Cookies HTTP são adaptados apenas para o ambiente local; a publicação continua com cookies Secure.

## Publicação do frontend na Vercel

Importe o repositório `wzinn1314/salaofront` e deixe **Root Directory** como `.` (raiz). O `vercel.json` define o framework como Other, o comando `npm run build:frontend` e a saída `dist/frontend`. A página de administração fica em `/admin`.

Frontend e backend podem ficar neste mesmo repositório. A publicação na Vercel serve o frontend e uma ponte em `api/[...path].js`; ela não inicia o servidor local nem o Worker Cloudflare.

Em **Settings > Environment Variables**, configure `BACKEND_URL` com a origem HTTPS do backend e faça um novo deploy. O backend precisa executar as rotas `/api/*`, ter banco persistente e permitir acesso à API sem login da plataforma de hospedagem. Sem essa variável, a página abre, mas a API retorna uma mensagem de configuração pendente. A autenticação do painel continua sendo feita pela senha do salão.

O backend atual é um Cloudflare Worker com D1. Para rodar o backend também na Vercel, será necessário adaptar a execução e o banco; subir a pasta no GitHub não faz essa migração. O SQLite em `.local/` serve ao desenvolvimento neste computador.

## Publicação do backend no Sites

`node scripts/build.mjs` gera o Worker ESM em `dist/server/index.js` com as páginas incorporadas. Fontes: `frontend/` e `backend/worker.mjs`. Use a URL hospedada para executar a API; abrir HTML local não executa o servidor. O manifesto declara D1 como DB; Sites aplica as migrações em drizzle na publicação. A política de acesso existente no Sites foi preservada.

## Reservas e privacidade

Novas reservas ficam no D1, compartilhadas entre clientes. Validação no servidor, fuso America/Sao_Paulo e transações com uma chave única por hora impedem sobreposições. A disponibilidade pública retorna apenas data, horário e duração. Dados pessoais ficam na área autenticada. Demonstrações antigas do localStorage não são importadas automaticamente.

## Administração

/admin: consultar todas as reservas, filtrar por data, cancelar e trocar a senha. ADMIN_BOOTSTRAP_HASH é um segredo de runtime com salt:hash. Nenhuma senha ou hash de produção fica no código. O hash inicial é importado no primeiro login; trocas posteriores atualizam o banco.

Senhas: PBKDF2-SHA256, salt aleatório e 100.000 iterações (suportadas pelo Worker). Sessões: tokens aleatórios de 256 bits, hashes no banco, expiração em 8 horas. Cookies Secure, HttpOnly, SameSite=Strict. Mutações validam Origin; login tem limite por IP. Trocar senha revoga as sessões. Troque a senha inicial no painel. O acesso do Sites continua ativo além da senha administrativa.

## Verificação

`node tests/server.test.mjs` (Node 24) testa autenticação, CSRF, cookies, privacidade, comprimento do cabelo, conflito atômico de horários, cancelamento e troca de senha em SQLite em memória.

Limite diário: no máximo dois atendimentos por data, independentemente do procedimento. A inserção condicional acontece na mesma transação que bloqueia os horários, impedindo ultrapassar o limite mesmo com requisições simultâneas. Cancelar libera a capacidade. Reservas anteriores à regra não são apagadas.

Horários de início: terça a sexta às 08:00 ou 17:30; sábado e domingo às 08:00 ou 14:00. O servidor aceita somente esses horários no fuso America/Sao_Paulo. O limite diário de dois e a proteção contra sobreposição permanecem; reservas antigas são preservadas.
