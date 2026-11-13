# Jaiane Neves — Agendamento

Interface HTML, CSS e JavaScript, sem imagem no cabeçalho. Progressiva e selagem, com nome, WhatsApp e comprimento do cabelo. Valor confirmado após avaliação. Duração provisória: 120 minutos.

## Execução

`node scripts/build.mjs` gera o Worker ESM em `dist/server/index.js` com as páginas incorporadas. Fontes: `public/` e `server/worker.mjs`. Use a URL hospedada para executar a API; abrir HTML local não executa o servidor. O manifesto declara D1 como DB; Sites aplica as migrações em drizzle na publicação. A política de acesso existente no Sites foi preservada.

## Reservas e privacidade

Novas reservas ficam no D1, compartilhadas entre clientes. Validação no servidor, fuso America/Sao_Paulo e transações com uma chave única por hora impedem sobreposições. A disponibilidade pública retorna apenas data, horário e duração. Dados pessoais ficam na área autenticada. Demonstrações antigas do localStorage não são importadas automaticamente.

## Administração

/admin: consultar todas as reservas, filtrar por data, cancelar e trocar a senha. ADMIN_BOOTSTRAP_HASH é um segredo de runtime com salt:hash. Nenhuma senha ou hash de produção fica no código. O hash inicial é importado no primeiro login; trocas posteriores atualizam o banco.

Senhas: PBKDF2-SHA256, salt aleatório e 100.000 iterações (suportadas pelo Worker). Sessões: tokens aleatórios de 256 bits, hashes no banco, expiração em 8 horas. Cookies Secure, HttpOnly, SameSite=Strict. Mutações validam Origin; login tem limite por IP. Trocar senha revoga as sessões. Troque a senha inicial no painel. O acesso do Sites continua ativo além da senha administrativa.

## Verificação

`node tests/server.test.mjs` (Node 24) testa autenticação, CSRF, cookies, privacidade, comprimento do cabelo, conflito atômico de horários, cancelamento e troca de senha em SQLite em memória.

Limite diário: no máximo dois atendimentos por data, independentemente do procedimento. A inserção condicional acontece na mesma transação que bloqueia os horários, impedindo ultrapassar o limite mesmo com requisições simultâneas. Cancelar libera a capacidade. Reservas anteriores à regra não são apagadas.

Horários de início: terça a sexta às 08:00 ou 17:30; sábado e domingo às 08:00 ou 14:00. O servidor aceita somente esses horários no fuso America/Sao_Paulo. O limite diário de dois e a proteção contra sobreposição permanecem; reservas antigas são preservadas.
