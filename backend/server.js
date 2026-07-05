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

// ---------- filename -> auto label ----------
// Generic/placeholder words that don't describe what the SVG actually is.
const GENERIC_NAME_WORDS = new Set([
  "untitled", "unnamed", "new", "copy", "image", "img", "icon", "icons",
  "svg", "asset", "assets", "file", "files", "download", "downloaded",
  "export", "exported", "artboard", "group", "groups", "layer", "layers",
  "path", "paths", "vector", "vectors", "shape", "shapes", "drawing",
  "clipart", "screenshot", "screen", "shot", "frame", "final", "draft",
  "temp", "tmp", "test", "sample", "default", "graphic", "graphics",
]);

// Whole-name patterns typical of auto-generated / meaningless filenames.
const GIBBERISH_NAME_PATTERNS = [
  /^\d+$/,
  /^[0-9a-f]{6,}$/i,
  /^img[_-]?\d+$/i,
  /^dsc[_-]?\d+$/i,
  /^screenshot/i,
  /^v\d+$/i,
  /^\d{4}[-_]?\d{2}[-_]?\d{2}/,
];

// Crude "does this look like a random string" check: too few vowels, or a
// long run of consonants, reads as gibberish rather than an actual word.
const isGibberishWord = (word) => {
  const letters = word.replace(/[^a-z]/g, "");
  if (letters.length < 4) return false;
  const vowels = (letters.match(/[aeiou]/g) || []).length;
  const longConsonantRun = /[^aeiou]{5,}/.test(letters);
  return vowels / letters.length < 0.15 || longConsonantRun;
};

// Derive an auto-tag from a filename, but only when it looks meaningful.
const meaningfulNameLabel = (rawName) => {
  const trimmed = rawName.trim();
  if (!trimmed) return null;
  if (GIBBERISH_NAME_PATTERNS.some((p) => p.test(trimmed.replace(/\s+/g, ""))))
    return null;

  const words = trimmed
    .replace(/[_\-.]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  const meaningfulWords = words
    .map((w) => w.toLowerCase())
    .filter(
      (w) =>
        w.length > 1 &&
        !/^\d+$/.test(w) &&
        !GENERIC_NAME_WORDS.has(w) &&
        !isGibberishWord(w)
    );

  return meaningfulWords.length ? meaningfulWords.join("-") : null;
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
  limits: { fileSize: 5 * 1024 * 1024, files: 50 },
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

    const name = file.originalname.replace(/\.svg$/i, "");
    const nameLabel = meaningfulNameLabel(name);
    const fileTags = normalizeTags(nameLabel ? [...tags, nameLabel] : tags);

    const record = {
      id,
      name,
      tags: fileTags,
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

// Delete all SVGs and reset the library
app.delete("/api/svgs", (_req, res) => {
  const removed = db.svgs.length;
  for (const item of db.svgs) {
    fs.rmSync(item.filePath, { force: true });
  }
  db = { svgs: [] };
  saveDb(db);
  res.json({ ok: true, removed });
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
