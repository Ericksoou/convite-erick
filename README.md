# 🎉 Convite Digital — 18 Anos do Erick

Convite digital interativo com backend real, banco de dados persistente e painel administrativo privado.

---

## 📁 Estrutura do Projeto

```
convite-projeto/
├── frontend/
│   └── index.html          ← Convite completo (HTML/CSS/JS)
├── backend/
│   ├── server.js           ← Servidor Express + API REST
│   ├── package.json
│   ├── .env.example        ← Modelo de variáveis de ambiente
│   ├── .gitignore
│   └── data/               ← Banco SQLite (criado automaticamente)
│       └── convite.db
└── README.md
```

---

## 🚀 Rodando Localmente

### Pré-requisitos
- Node.js 18 ou superior
- npm

### Passo a passo

```bash
# 1. Entre na pasta do backend
cd backend

# 2. Instale as dependências
npm install

# 3. Configure as variáveis de ambiente
cp .env.example .env
# Edite o .env se quiser alterar a senha ou outras configs

# 4. Inicie o servidor
npm start
```

Acesse: **http://localhost:3001**

O banco de dados (`data/convite.db`) é criado automaticamente na primeira execução.

---

## ⚙️ Variáveis de Ambiente (`.env`)

| Variável | Padrão | Descrição |
|---|---|---|
| `PORT` | `3001` | Porta do servidor |
| `ADMIN_PASSWORD` | `erick18` | Senha do painel admin |
| `SESSION_SECRET` | *(string padrão)* | Segredo da sessão — **troque em produção!** |
| `FRONTEND_URL` | `*` | URL permitida pelo CORS |
| `NODE_ENV` | `development` | Ambiente (`development` ou `production`) |

---

## 🔐 Área Administrativa

- Acesse o convite e clique no **ícone de cadeado** no canto inferior direito (discreto, quase invisível)
- Ou vá diretamente para: `http://localhost:3001` → clique no ícone 🔒
- **Senha padrão:** `erick18` (altere em `.env` antes do deploy)

O painel mostra:
- Total de confirmações, confirmados, ausências e estimativa de pessoas
- Lista completa com nome, presença, acompanhantes, observações e data
- Exportação CSV e PDF/impressão

---

## 🌐 Deploy Online (Render — Recomendado)

O Render é a opção mais simples: hospeda frontend e backend juntos, com banco de dados persistente.

### Passo 1 — Preparar o repositório

```bash
# Na pasta raiz do projeto
git init
git add .
git commit -m "convite erick 18 anos"

# Crie um repositório no GitHub e suba o código
git remote add origin https://github.com/SEU_USUARIO/convite-erick.git
git push -u origin main
```

### Passo 2 — Criar o serviço no Render

1. Acesse [render.com](https://render.com) e crie uma conta gratuita
2. Clique em **New → Web Service**
3. Conecte seu repositório GitHub
4. Configure:

| Campo | Valor |
|---|---|
| **Root Directory** | `backend` |
| **Build Command** | `npm install` |
| **Start Command** | `node server.js` |
| **Plan** | Free |

5. Em **Environment Variables**, adicione:

```
ADMIN_PASSWORD = sua-senha-segura-aqui
SESSION_SECRET = uma-string-longa-e-aleatoria-aqui
NODE_ENV       = production
FRONTEND_URL   = *
```

6. Clique em **Create Web Service**

O Render dará uma URL pública como `https://convite-erick.onrender.com`.

> ⚠️ **Banco de dados no plano gratuito do Render:**
> O disco do plano free é efêmero — os dados podem ser apagados ao reiniciar.
> Para persistência real, use o **Disk** pago ($1/mês) ou migre para PostgreSQL (veja abaixo).

### Opção alternativa — Railway

1. Acesse [railway.app](https://railway.app)
2. Clique em **Deploy from GitHub**
3. Selecione o repositório
4. Configure Root Directory como `backend`
5. Adicione as mesmas variáveis de ambiente
6. O Railway detecta automaticamente o Node.js

---

## 🗄️ Banco de Dados Persistente (Supabase)

Para dados permanentes sem custo, use o **Supabase** (PostgreSQL gratuito).

> Esta versão usa SQLite. Para migrar para PostgreSQL com Supabase, entre em contato.

---

## 📡 Rotas da API

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| `POST` | `/api/confirmacoes` | Público | Salva confirmação de presença |
| `POST` | `/api/admin/login` | Público | Autenticação do admin |
| `POST` | `/api/admin/logout` | Admin | Encerra sessão |
| `GET` | `/api/admin/session` | Público | Verifica se está autenticado |
| `GET` | `/api/admin/confirmacoes` | Admin | Lista todas as confirmações |
| `GET` | `/api/admin/estatisticas` | Admin | Totais e estatísticas |
| `GET` | `/api/admin/exportar/csv` | Admin | Download CSV |
| `GET` | `/api/admin/exportar/pdf` | Admin | Relatório imprimível (PDF) |

---

## 🔄 Fluxo Completo

```
Convidado abre o convite
    → Clica em "Confirmar Presença"
    → Preenche o formulário
    → Clica em "Confirmar minha presença"
    → POST /api/confirmacoes → salvo no SQLite
    → Mensagem de sucesso exibida

Erick acessa o painel admin
    → Clica no ícone 🔒 (canto inf. direito)
    → Digita a senha
    → POST /api/admin/login → sessão criada
    → Vê lista de convidados e estatísticas
    → Exporta CSV ou PDF
```

---

## 🎨 Identidade Visual

- **Verde pastel:** `#A8C3A0`
- **Verde claro:** `#DCE9D7`
- **Dourado:** `#C9A45C`
- **Branco:** `#FFFFFF`
- **Cinza texto:** `#2F2F2F`

Easter eggs discretos: snitch dourada (Harry Potter), varinha, estrela (Marvel), bandeira xadrez (F1).

---

*Desenvolvido com ❤️ para os 18 anos do Erick — 15 de agosto de 2026*
