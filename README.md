# Jaiane Neves - Frontend

Frontend estatico do agendamento e painel administrativo. HTML, CSS e JavaScript ficam na raiz.

## Vercel

- Framework Preset: Other.
- Root Directory: . (raiz).
- Build Command: vazio, sem override.
- Output Directory: . (ou desative o override para usar vercel.json).
- Install Command: vazio, sem override.

Sem dependencias e sem build. Agendamento em / e painel em /admin.

## Backend separado

Este repositorio contem somente o frontend. API, banco e autenticacao ficarao em outro repositorio.

As paginas chamam /api/* no mesmo dominio. Quando o backend estiver hospedado, configure um rewrite na Vercel para encaminhar essas rotas a URL HTTPS dele. A API precisa aceitar esse encaminhamento e preservar os cookies no dominio do frontend.

Ate essa conexao ser configurada, as paginas abrem, mas a consulta da agenda, as reservas e o login precisam do backend.
