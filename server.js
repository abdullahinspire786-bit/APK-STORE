const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Uploads folder ──
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// ── Multer config ──
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, Date.now() + '_' + safe);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB
  fileFilter: (req, file, cb) => {
    if (file.originalname.toLowerCase().endsWith('.apk')) cb(null, true);
    else cb(new Error('Sirf APK files allowed hain!'), false);
  }
});

// ── Meta helpers ──
const metaPath = path.join(uploadsDir, 'apps.json');
const readMeta = () => {
  try { return JSON.parse(fs.readFileSync(metaPath, 'utf8')); }
  catch { return []; }
};
const writeMeta = (data) => fs.writeFileSync(metaPath, JSON.stringify(data, null, 2));

// ── ROUTES ──

// GET all apps
app.get('/api/apps', (req, res) => {
  const apps = readMeta();
  res.json(apps.reverse()); // newest first
});

// POST upload APK
app.post('/api/upload', upload.single('apk'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'File nahi mili' });
    const { name, description, version, category } = req.body;
    const apps = readMeta();
    const newApp = {
      id: uuidv4(),
      name: name || req.file.originalname.replace('.apk', ''),
      description: description || 'Koi description nahi di',
      version: version || '1.0',
      category: category || 'General',
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      downloads: 0,
      uploadedAt: new Date().toISOString()
    };
    apps.push(newApp);
    writeMeta(apps);
    res.json({ success: true, app: newApp });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET download APK
app.get('/api/download/:id', (req, res) => {
  const apps = readMeta();
  const app = apps.find(a => a.id === req.params.id);
  if (!app) return res.status(404).json({ error: 'App nahi mili' });

  app.downloads = (app.downloads || 0) + 1;
  writeMeta(apps);

  const filePath = path.join(uploadsDir, app.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File delete ho gayi' });

  res.download(filePath, app.originalName);
});

// DELETE app
app.delete('/api/apps/:id', (req, res) => {
  let apps = readMeta();
  const app = apps.find(a => a.id === req.params.id);
  if (!app) return res.status(404).json({ error: 'App nahi mili' });

  const filePath = path.join(uploadsDir, app.filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  apps = apps.filter(a => a.id !== req.params.id);
  writeMeta(apps);
  res.json({ success: true });
});

// GET stats
app.get('/api/stats', (req, res) => {
  const apps = readMeta();
  const totalDownloads = apps.reduce((sum, a) => sum + (a.downloads || 0), 0);
  res.json({ totalApps: apps.length, totalDownloads });
});

app.listen(PORT, () => console.log(`✅ APK Store live on port ${PORT}`));
