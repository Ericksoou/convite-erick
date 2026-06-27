/**
 * Convite 18 Anos do Erick — Backend
 * Stack: Express 4 + Google Sheets (dados permanentes) + bcryptjs
 */

require('dotenv').config();
const express   = require('express');
const cors      = require('cors');
const bcrypt    = require('bcryptjs');
const session   = require('express-session');
const path      = require('path');
const { google } = require('googleapis');

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Configuração Google Sheets ──────────────────────────────────────────────────
const SHEET_ID   = process.env.SHEET_ID || '1tRW9Cd-v9ohLK0GhDuaPoM6uQ_6NZnJ6OEqdlJ4qZ_8';
const SHEET_NAME = 'Página1';

// Credenciais via variável de ambiente (JSON em string) ou arquivo local
function getCredentials() {
  if (process.env.GOOGLE_CREDENTIALS) {
    return JSON.parse(process.env.GOOGLE_CREDENTIALS);
  }
  // fallback local para desenvolvimento
  try {
    return require('./credentials.json');
  } catch(e) {
    throw new Error('Credenciais Google não encontradas. Configure GOOGLE_CREDENTIALS.');
  }
}

async function getSheetsClient() {
  const creds = getCredentials();
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
  return google.sheets({ version: 'v4', auth });
}

// ── Funções da Planilha ─────────────────────────────────────────────────────────

async function listarConfirmacoes() {
  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_NAME}!A2:E1000`
  });
  const rows = res.data.values || [];
  return rows.map((row, i) => ({
    id:            i + 1,
    nome:          row[0] || '',
    presenca:      row[1] || '',
    acompanhantes: row[2] || '0',
    observacoes:   row[3] || '',
    criado_em:     row[4] || ''
  }));
}

async function nomejaCadastrado(nome) {
  const lista = await listarConfirmacoes();
  const nomeLimpo = nome.trim().toLowerCase();
  return lista.some(r => r.nome.trim().toLowerCase() === nomeLimpo);
}

async function salvarConfirmacao({ nome, presenca, acompanhantes, observacoes }) {
  const sheets  = await getSheetsClient();
  const criadoEm = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_NAME}!A:E`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[nome, presenca === 'sim' ? 'Sim' : 'Não', acompanhantes, observacoes, criadoEm]]
    }
  });
}

// ── Middlewares ─────────────────────────────────────────────────────────────────
app.set('trust proxy', 1);
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'erick18-secret-2026',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 8 * 60 * 60 * 1000
  }
}));

app.use(express.static(path.join(__dirname, '..', 'frontend')));

// ── Auth middleware ─────────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  if (req.session && req.session.adminAutenticado) return next();
  res.status(401).json({ erro: 'Não autorizado.' });
}

// Senha admin via bcrypt (hash gerado na inicialização)
const ADMIN_HASH = bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'erick18', 10);

// ── ROTAS PÚBLICAS ──────────────────────────────────────────────────────────────

// POST /api/confirmacoes
app.post('/api/confirmacoes', async (req, res) => {
  try {
    const { nome, presenca, acompanhantes, observacoes } = req.body;

    if (!nome || !nome.trim())             return res.status(400).json({ erro: 'Nome é obrigatório.' });
    if (!['sim','nao'].includes(presenca)) return res.status(400).json({ erro: 'Presença inválida.' });

    // Verificar se já respondeu
    const jaRespondeu = await nomejaCadastrado(nome.trim());
    if (jaRespondeu) {
      return res.status(409).json({
        erro: 'duplicado',
        mensagem: 'Você já confirmou sua presença anteriormente!'
      });
    }

    const acompNro = presenca === 'sim' ? (parseInt(acompanhantes) || 1) : 0;

    await salvarConfirmacao({
      nome:          nome.trim().substring(0, 200),
      presenca,
      acompanhantes: acompNro,
      observacoes:   (observacoes || '').trim().substring(0, 1000)
    });

    console.log(`✔ Confirmação salva: "${nome.trim()}" — ${presenca}`);
    res.status(201).json({ sucesso: true });

  } catch(e) {
    console.error('Erro ao salvar:', e.message);
    res.status(500).json({ erro: 'Erro ao salvar confirmação.' });
  }
});

// ── ROTAS ADMIN ─────────────────────────────────────────────────────────────────

app.post('/api/admin/login', (req, res) => {
  const { senha } = req.body;
  if (!senha) return res.status(400).json({ erro: 'Senha obrigatória.' });

  if (!bcrypt.compareSync(senha, ADMIN_HASH))
    return res.status(401).json({ erro: 'Senha incorreta.' });

  req.session.adminAutenticado = true;
  req.session.save(err => {
    if (err) return res.status(500).json({ erro: 'Erro ao salvar sessão.' });
    res.json({ sucesso: true });
  });
});

app.post('/api/admin/logout', (req, res) => {
  req.session.destroy(() => res.json({ sucesso: true }));
});

app.get('/api/admin/session', (req, res) => {
  res.json({ autenticado: !!(req.session && req.session.adminAutenticado) });
});

app.get('/api/admin/confirmacoes', requireAuth, async (req, res) => {
  try {
    const lista = await listarConfirmacoes();
    res.json(lista.reverse());
  } catch(e) {
    console.error(e.message);
    res.status(500).json({ erro: 'Erro ao buscar confirmações.' });
  }
});

app.get('/api/admin/estatisticas', requireAuth, async (req, res) => {
  try {
    const lista   = await listarConfirmacoes();
    const sim     = lista.filter(r => r.presenca === 'Sim');
    const nao     = lista.filter(r => r.presenca === 'Não');
    const pessoas = sim.reduce((acc, r) => acc + (parseInt(r.acompanhantes) || 0), 0);
    res.json({ total: lista.length, sim: sim.length, nao: nao.length, totalPessoas: pessoas });
  } catch(e) {
    console.error(e.message);
    res.status(500).json({ erro: 'Erro nas estatísticas.' });
  }
});

app.get('/api/admin/exportar/csv', requireAuth, async (req, res) => {
  try {
    const lista = await listarConfirmacoes();
    let linhas = lista.map(r =>
      [`"${(r.nome||'').replace(/"/g,'""')}"`, r.presenca, r.acompanhantes,
       `"${(r.observacoes||'').replace(/"/g,'""')}"`,
       `"${(r.criado_em||'').replace(/"/g,'""')}"`].join(';')
    ).join('\n');
    const csv = '\uFEFF' + 'Nome;Presença;Acompanhantes;Observações;Data e Hora\n' + linhas;
    res.setHeader('Content-Type','text/csv; charset=utf-8');
    res.setHeader('Content-Disposition','attachment; filename="confirmacoes_erick_18anos.csv"');
    res.send(csv);
  } catch(e) {
    res.status(500).json({ erro: 'Erro ao exportar.' });
  }
});

app.get('/api/admin/exportar/pdf', requireAuth, async (req, res) => {
  try {
    const lista   = await listarConfirmacoes();
    const sim     = lista.filter(r => r.presenca === 'Sim');
    const nao     = lista.filter(r => r.presenca === 'Não');
    const pessoas = sim.reduce((acc, r) => acc + (parseInt(r.acompanhantes) || 0), 0);

    const esc = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const linhas = lista.length
      ? lista.map((r,i) => `<tr style="background:${i%2===0?'#fff':'#f8fbf7'}">
          <td>${esc(r.nome)}</td>
          <td>${r.presenca==='Sim'?'✓ Sim':'✕ Não'}</td>
          <td style="text-align:center">${r.acompanhantes||'—'}</td>
          <td style="font-style:italic;color:#777">${r.observacoes?esc(r.observacoes):'—'}</td>
          <td style="font-size:12px;color:#999">${esc(r.criado_em)}</td>
        </tr>`).join('')
      : '<tr><td colspan="5" style="text-align:center;padding:24px;color:#999">Nenhuma confirmação</td></tr>';

    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.send(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<title>Relatório — 18 Anos do Erick</title>
<style>
  body{font-family:Georgia,serif;max-width:960px;margin:40px auto;color:#2f2f2f;padding:0 24px}
  h1{color:#C9A45C;font-size:28px;margin-bottom:4px}
  .sub{color:#777;font-style:italic;margin-bottom:28px}
  .stats{display:flex;gap:16px;margin-bottom:32px;flex-wrap:wrap}
  .stat{background:#f0f5ee;border-radius:10px;padding:16px 24px;text-align:center;flex:1;min-width:120px}
  .stat .n{font-size:38px;font-weight:700;color:#C9A45C}
  .stat .l{font-size:11px;color:#999;text-transform:uppercase;letter-spacing:1px;margin-top:4px}
  table{width:100%;border-collapse:collapse}
  th{background:#A8C3A0;color:#fff;padding:12px 14px;text-align:left;font-size:11px;letter-spacing:1px;text-transform:uppercase}
  td{padding:10px 14px;border-bottom:1px solid #e8ede6}
  @media print{.no-print{display:none}}
</style></head><body>
<div class="no-print" style="margin-bottom:20px">
  <button onclick="window.print()" style="padding:10px 24px;background:#2f2f2f;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px">
    🖨️ Imprimir / Salvar como PDF
  </button>
</div>
<h1>18 Anos do Erick — Relatório de Presenças</h1>
<p class="sub">Gerado em: ${new Date().toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})}</p>
<div class="stats">
  <div class="stat"><div class="n">${lista.length}</div><div class="l">Respostas</div></div>
  <div class="stat"><div class="n">${sim.length}</div><div class="l">Confirmados</div></div>
  <div class="stat"><div class="n">${nao.length}</div><div class="l">Ausências</div></div>
  <div class="stat"><div class="n">${pessoas}</div><div class="l">Total pessoas</div></div>
</div>
<table><thead><tr>
  <th>Nome</th><th>Presença</th><th>Pessoas</th><th>Observações</th><th>Registrado em</th>
</tr></thead><tbody>${linhas}</tbody></table>
</body></html>`);
  } catch(e) {
    res.status(500).json({ erro: 'Erro ao gerar PDF.' });
  }
});

// Catch-all SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

// ── Start ───────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 http://localhost:${PORT}`);
  console.log(`🔐 Senha admin: ${process.env.ADMIN_PASSWORD || 'erick18'}`);
  console.log(`📊 Planilha: https://docs.google.com/spreadsheets/d/${SHEET_ID}\n`);
});