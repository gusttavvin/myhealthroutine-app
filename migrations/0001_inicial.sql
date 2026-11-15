-- Estrutura inicial do banco (Cloudflare D1)

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  phone TEXT,
  pass_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE elders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  tz TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  created_at TEXT NOT NULL
);

-- Celular do idoso: entra sem senha, por um token guardado no aparelho.
CREATE TABLE devices (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  elder_id TEXT,
  link_code TEXT,
  link_expires TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX devices_code ON devices (link_code);

-- Quem acompanha cada idoso.
CREATE TABLE links (
  user_id TEXT NOT NULL,
  elder_id TEXT NOT NULL,
  relation TEXT NOT NULL,
  trusted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, elder_id)
);

CREATE TABLE meds (
  id TEXT PRIMARY KEY,
  elder_id TEXT NOT NULL,
  name TEXT NOT NULL,
  dosage TEXT NOT NULL,
  amount TEXT NOT NULL,
  marco TEXT NOT NULL,
  time TEXT NOT NULL,
  days TEXT NOT NULL,
  stock INTEGER NOT NULL,
  lot TEXT NOT NULL,
  created_date TEXT NOT NULL,
  created_min INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX meds_elder ON meds (elder_id);

-- Etiquetas impressas (QR). med_id preenchido quando a etiqueta é colada numa caixa.
CREATE TABLE labels (
  code TEXT PRIMARY KEY,
  elder_id TEXT NOT NULL,
  marco TEXT NOT NULL,
  n INTEGER NOT NULL,
  med_id TEXT,
  UNIQUE (elder_id, marco, n)
);

-- Uma linha por remédio por dia. level: 1 = aviso, 2 = reforço (20 min), 3 = contato avisado (40 min).
CREATE TABLE doses (
  med_id TEXT NOT NULL,
  date TEXT NOT NULL,
  elder_id TEXT NOT NULL,
  scheduled_min INTEGER NOT NULL,
  confirmed_min INTEGER,
  confirmed_at TEXT,
  level INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (med_id, date)
);
CREATE INDEX doses_elder_date ON doses (elder_id, date);

CREATE TABLE notices (
  id TEXT PRIMARY KEY,
  elder_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  text TEXT NOT NULL,
  delivered INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX notices_elder ON notices (elder_id, created_at);

CREATE TABLE push_subs (
  endpoint TEXT PRIMARY KEY,
  owner_kind TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  last_title TEXT,
  last_body TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX push_owner ON push_subs (owner_kind, owner_id);
