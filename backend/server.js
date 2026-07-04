import express from "express";
import multer from "multer";
import { nanoid } from "nanoid";
import fs from "fs";
import path from "path";

const PORT = process.env.PORT || 4000;
const DATA_DIR = process.env.DATA_DIR || path.resolve("./data");
const FILES_DIR = path.join(DATA_DIR, "files");
const DB_PATH = path.join(DATA_DIR, "db.json");

fs.mkdirSync(FILES_DIR, { recursive: true });

// ---------- tiny JSON "database" ----------
function loadDb() {
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
  } catch {
    return { svgs: [] };
  }
}
function saveDb(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}
let db = loadDb();

// ---------- helpers ----------
const normalizeTags = (raw) => {
  if (!raw) return [];
  const arr = Array.isArray(raw) ? raw : String(raw).split(",");
  return [...new Set(arr.map((t) => t.trim().toLowerCase()).filter(Boolean))];
};

const isSvg = (buf) => {
  const head = buf.toString("utf8", 0, 1000).toLowerCase();
  return head.includes("<svg");
};

// Strip active content so previews are safe to inline
const sanitizeSvg = (text) =>
  text
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son\w+\s*=\s*'[^']*'/gi, "")
    .replace(/href\s*=\s*"javascript:[^"]*"/gi, 'href="#"');

// ---------- app ----------
const app = express();
app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 20 },
});

// List all SVGs (metadata only)
app.get("/api/svgs", (_req, res) => {
  res.json(db.svgs.map(({ filePath, ...meta }) => meta));
});

// Aggregate tags with counts
app.get("/api/tags", (_req, res) => {
  const counts = {};
  for (const s of db.svgs) for (const t of s.tags) counts[t] = (counts[t] || 0) + 1;
  res.json(
    Object.entries(counts)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
  );
});

// Upload one or more SVGs
app.post("/api/svgs", upload.array("files"), (req, res) => {
  if (!req.files?.length) return res.status(400).json({ error: "No files received." });

  const tags = normalizeTags(req.body.tags);
  const created = [];
  const rejected = [];

  for (const file of req.files) {
    if (!isSvg(file.buffer)) {
      rejected.push(file.originalname);
      continue;
    }
    const id = nanoid(10);
    const clean = sanitizeSvg(file.buffer.toString("utf8"));
    const filePath = path.join(FILES_DIR, `${id}.svg`);
    fs.writeFileSync(filePath, clean);

    const record = {
      id,
      name: file.originalname.replace(/\.svg$/i, ""),
      tags,
      size: Buffer.byteLength(clean),
      uploadedAt: new Date().toISOString(),
      filePath,
    };
    db.svgs.unshift(record);
    const { filePath: _fp, ...meta } = record;
    created.push(meta);
  }

  saveDb(db);
  res.status(created.length ? 201 : 400).json({ created, rejected });
});

// Raw SVG for inline preview
app.get("/api/svgs/:id/raw", (req, res) => {
  const item = db.svgs.find((s) => s.id === req.params.id);
  if (!item) return res.status(404).json({ error: "Not found." });
  res.setHeader("Content-Type", "image/svg+xml");
  res.setHeader("Content-Security-Policy", "script-src 'none'");
  res.sendFile(item.filePath);
});

// Download as attachment
app.get("/api/svgs/:id/download", (req, res) => {
  const item = db.svgs.find((s) => s.id === req.params.id);
  if (!item) return res.status(404).json({ error: "Not found." });
  res.download(item.filePath, `${item.name}.svg`);
});

// Update name / tags
app.patch("/api/svgs/:id", (req, res) => {
  const item = db.svgs.find((s) => s.id === req.params.id);
  if (!item) return res.status(404).json({ error: "Not found." });
  if (typeof req.body.name === "string" && req.body.name.trim())
    item.name = req.body.name.trim();
  if (req.body.tags !== undefined) item.tags = normalizeTags(req.body.tags);
  saveDb(db);
  const { filePath, ...meta } = item;
  res.json(meta);
});

// Delete
app.delete("/api/svgs/:id", (req, res) => {
  const idx = db.svgs.findIndex((s) => s.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Not found." });
  const [removed] = db.svgs.splice(idx, 1);
  fs.rmSync(removed.filePath, { force: true });
  saveDb(db);
  res.json({ ok: true });
});

app.listen(PORT, () => console.log(`SVG viewer API listening on :${PORT}`));
