const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const DB_FILE = path.join(__dirname, "server_db.json");

function readStore() {
  try {
    if (!fs.existsSync(DB_FILE)) return {};
    const raw = fs.readFileSync(DB_FILE, "utf-8");
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeStore(store) {
  fs.writeFileSync(DB_FILE, JSON.stringify(store, null, 2), "utf-8");
}

app.get("/health", (req, res) => {
  res.json({ ok: true, at: new Date().toISOString() });
});

app.get("/api/db/:email", (req, res) => {
  const email = String(req.params.email || "").toLowerCase();
  const store = readStore();
  const row = store[email];

  if (!row) {
    return res.json({
      email,
      db: { userId: null, events: [] },
      updatedAt: null,
      count: 0,
    });
  }

  return res.json({
    email,
    db: row.db,
    updatedAt: row.updatedAt,
    count: Array.isArray(row.db?.events) ? row.db.events.length : 0,
  });
});

app.post("/api/db/:email", (req, res) => {
  const email = String(req.params.email || "").toLowerCase();
  const incoming = req.body?.db;

  if (!incoming || typeof incoming !== "object" || !Array.isArray(incoming.events)) {
    return res.status(400).json({ ok: false, message: "Invalid db shape (events[] required)" });
  }

  const store = readStore();
  store[email] = {
    db: incoming,
    updatedAt: new Date().toISOString(),
  };
  writeStore(store);

  return res.json({
    ok: true,
    email,
    updatedAt: store[email].updatedAt,
    count: incoming.events.length,
  });
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`✅ API server running on http://localhost:${PORT}`);
  console.log(`✅ DB file: ${DB_FILE}`);
});
