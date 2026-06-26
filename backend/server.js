/**
 * Convite 18 Anos do Erick — Backend
 * Stack: Express 4 + sql.js (SQLite puro JS) + bcryptjs
 */

require('dotenv').config();
const express   = require('express');
const cors      = require('cors');
const bcrypt    = require('bcryptjs');
const session   = require('express-session');
const path      = require('path');
const fs        = require('fs');
const initSqlJs = require('sql.js');

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Caminho do banco ────────────────────────────────────────────────────────────
const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH  = path.join(DATA_DIR, 'convite.db');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ── Instância global ────────────────────────────────────────────────────────────
let db;

async function initDB() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    db = new SQL.Database(fs.readFileSync(DB_PATH));
    console.log('✔ Banco carregado:', DB_PATH);
  } else {
    db = new SQL.Database();
    console.log('✔ Banco novo criado:', DB_PATH);
  }

  db.run(`CREATE TABLE IF NOT EXISTS confirmacoes (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    nome          TEXT    NOT NULL,
    presenca      TEXT    NOT NULL CHECK(presenca IN ('sim','nao')),
    acompanhantes INTEGER DEFAULT 0,
    observacoes   TEXT    DEFAULT '',
    criado_em     TEXT    NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS admin_config (
    chave TEXT PRIMARY KEY,
    valor TEXT NOT NULL
  )`);

  // Cria hash da senha admin se ainda não existir
  const res = db.exec("SELECT valor FROM admin_config WHERE chave='senha_hash'");
  if (!res.length || !res[0].values.length) {
    const plain = process.env.ADMIN_PASSWORD || 'erick18';
    const hash  = bcrypt.hashSync(plain, 10);
    db.run("INSERT OR REPLACE INTO admin_config(chave,valor) VALUES('senha_hash',?)", [hash]);
    console.log(`✔ Senha admin definida (padrão: "${plain}")`);
  }

  salvar();
}

function salvar() {
  fs.writeFileSync(DB_PATH, Buffer.from(db.export()));
}

// ── Middlewares ─────────────────────────────────────────────────────────────────
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'erick18-secret-2026',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 8 * 60 * 60 * 1000
  }
}));

// Serve o frontend estático
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// ── Auth middleware ─────────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  if (req.session && req.session.adminAutenticado) return next();
  res.status(401).json({ erro: 'Não autorizado.' });
}

// ── ROTAS PÚBLICAS ──────────────────────────────────────────────────────────────

// POST /api/confirmacoes — salva confirmação
app.post('/api/confirmacoes', (req, res) => {
  try {
    const { nome, presenca, acompanhantes, observacoes } = req.body;
    if (!nome || !nome.trim())              return res.status(400).json({ erro: 'Nome é obrigatório.' });
    if (!['sim','nao'].includes(presenca))  return res.status(400).json({ erro: 'Presença inválida.' });

    const criadoEm = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const acompNro = presenca === 'sim' ? (parseInt(acompanhantes) || 1) : 0;

    db.run(
      `INSERT INTO confirmacoes(nome,presenca,acompanhantes,observacoes,criado_em)
       VALUES(?,?,?,?,?)`,
      [nome.trim().substring(0,200), presenca, acompNro,
       (observacoes||'').trim().substring(0,1000), criadoEm]
    );
    salvar();
    console.log(`✔ Confirmação: "${nome.trim()}" — ${presenca}`);
    res.status(201).json({ sucesso: true });
  } catch(e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao salvar confirmação.' });
  }
});

// ── ROTAS ADMIN ─────────────────────────────────────────────────────────────────

// POST /api/admin/login
app.post('/api/admin/login', (req, res) => {
  try {
    const { senha } = req.body;
    if (!senha) return res.status(400).json({ erro: 'Senha obrigatória.' });

    const r = db.exec("SELECT valor FROM admin_config WHERE chave='senha_hash'");
    if (!r.length || !r[0].values.length) return res.status(500).json({ erro: 'Configuração ausente.' });

    if (!bcrypt.compareSync(senha, r[0].values[0][0]))
      return res.status(401).json({ erro: 'Senha incorreta.' });

    req.session.adminAutenticado = true;
    res.json({ sucesso: true });
  } catch(e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro interno.' });
  }
});

// POST /api/admin/logout
app.post('/api/admin/logout', (req, res) => {
  req.session.destroy(() => res.json({ sucesso: true }));
});

// GET /api/admin/session
app.get('/api/admin/session', (req, res) => {
  res.json({ autenticado: !!(req.session && req.session.adminAutenticado) });
});

// GET /api/admin/confirmacoes
app.get('/api/admin/confirmacoes', requireAuth, (req, res) => {
  try {
    const r = db.exec(
      `SELECT id,nome,presenca,acompanhantes,observacoes,criado_em
       FROM confirmacoes ORDER BY id DESC`
    );
    if (!r.length) return res.json([]);
    const { columns, values } = r[0];
    res.json(values.map(row => {
      const o = {};
      columns.forEach((c,i) => o[c] = row[i]);
      return o;
    }));
  } catch(e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro interno.' });
  }
});

// GET /api/admin/estatisticas
app.get('/api/admin/estatisticas', requireAuth, (req, res) => {
  try {
    const v = k => db.exec(k)[0]?.values[0][0] || 0;
    res.json({
      total:        v('SELECT COUNT(*) FROM confirmacoes'),
      sim:          v("SELECT COUNT(*) FROM confirmacoes WHERE presenca='sim'"),
      nao:          v("SELECT COUNT(*) FROM confirmacoes WHERE presenca='nao'"),
      totalPessoas: v("SELECT COALESCE(SUM(acompanhantes),0) FROM confirmacoes WHERE presenca='sim'")
    });
  } catch(e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro interno.' });
  }
});

// GET /api/admin/exportar/csv
app.get('/api/admin/exportar/csv', requireAuth, (req, res) => {
  try {
    const r = db.exec(
      `SELECT nome,presenca,acompanhantes,observacoes,criado_em FROM confirmacoes ORDER BY id ASC`
    );
    let linhas = '';
    if (r.length && r[0].values.length) {
      linhas = r[0].values.map(row => {
        const [nome,pres,acomp,obs,data] = row;
        return [`"${(nome||'').replace(/"/g,'""')}"`,
                pres==='sim'?'Sim':'Não', acomp||0,
                `"${(obs||'').replace(/"/g,'""')}"`,
                `"${(data||'').replace(/"/g,'""')}"`].join(';');
      }).join('\n');
    }
    const csv = '\uFEFF' + 'Nome;Presença;Acompanhantes;Observações;Data e Hora\n' + linhas;
    res.setHeader('Content-Type','text/csv; charset=utf-8');
    res.setHeader('Content-Disposition','attachment; filename="confirmacoes_erick_18anos.csv"');
    res.send(csv);
  } catch(e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro interno.' });
  }
});

// GET /api/admin/exportar/pdf  (abre HTML imprimível → salvar como PDF)
app.get('/api/admin/exportar/pdf', requireAuth, (req, res) => {
  try {
    const v = k => db.exec(k)[0]?.values[0][0] || 0;
    const total   = v('SELECT COUNT(*) FROM confirmacoes');
    const sim     = v("SELECT COUNT(*) FROM confirmacoes WHERE presenca='sim'");
    const nao     = v("SELECT COUNT(*) FROM confirmacoes WHERE presenca='nao'");
    const pessoas = v("SELECT COALESCE(SUM(acompanhantes),0) FROM confirmacoes WHERE presenca='sim'");

    const r = db.exec(
      `SELECT nome,presenca,acompanhantes,observacoes,criado_em FROM confirmacoes ORDER BY id ASC`
    );

    const esc = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const linhas = (r.length && r[0].values.length)
      ? r[0].values.map((row,i) => {
          const [nome,pres,acomp,obs,data] = row;
          return `<tr style="background:${i%2===0?'#fff':'#f8fbf7'}">
            <td>${esc(nome)}</td><td>${pres==='sim'?'✓ Sim':'✕ Não'}</td>
            <td style="text-align:center">${acomp||'—'}</td>
            <td style="font-style:italic;color:#777">${obs?esc(obs):'—'}</td>
            <td style="font-size:12px;color:#999">${esc(data)}</td></tr>`;
        }).join('')
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
  @media print{body{margin:20px}.no-print{display:none}}
</style></head><body>
<div class="no-print" style="margin-bottom:20px">
  <button onclick="window.print()" style="padding:10px 24px;background:#2f2f2f;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px">
    🖨️ Imprimir / Salvar como PDF
  </button>
</div>
<h1>18 Anos do Erick — Relatório de Presenças</h1>
<p class="sub">Gerado em: ${new Date().toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})}</p>
<div class="stats">
  <div class="stat"><div class="n">${total}</div><div class="l">Respostas</div></div>
  <div class="stat"><div class="n">${sim}</div><div class="l">Confirmados</div></div>
  <div class="stat"><div class="n">${nao}</div><div class="l">Ausências</div></div>
  <div class="stat"><div class="n">${pessoas}</div><div class="l">Total pessoas</div></div>
</div>
<table><thead><tr>
  <th>Nome</th><th>Presença</th><th>Pessoas</th><th>Observações</th><th>Registrado em</th>
</tr></thead><tbody>${linhas}</tbody></table>
</body></html>`);
  } catch(e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro interno.' });
  }
});

// ── Catch-all SPA ───────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

// ── Start ───────────────────────────────────────────────────────────────────────
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🚀 http://localhost:${PORT}`);
    console.log(`🔐 Senha admin: ${process.env.ADMIN_PASSWORD || 'erick18'}\n`);
  });
}).catch(e => { console.error(e); process.exit(1); });
