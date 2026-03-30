const express = require('express');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const matter = require('gray-matter');
const { exec } = require('child_process');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const REPO_DIR = path.join(__dirname, '..', 'repo');
const CONTENT_DIR = path.join(REPO_DIR, 'content');
const TALKS_DIR = path.join(CONTENT_DIR, 'talks');
const SPEAKERS_DIR = path.join(CONTENT_DIR, 'speakers');
const STAGES_DIR = path.join(CONTENT_DIR, 'stages');

// ---- Helpers ----

function readMdFiles(dir) {
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.md'))
    .map(file => {
      const raw = fs.readFileSync(path.join(dir, file), 'utf8');
      const { data, content } = matter(raw);
      return { ...data, _body: content.trim(), _file: file };
    });
}

function writeMdFile(dir, filename, frontmatter, body) {
  const content = matter.stringify(body || '', frontmatter);
  fs.writeFileSync(path.join(dir, filename), content);
}

function readYamlFiles(dir) {
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.yml'))
    .map(file => {
      const raw = fs.readFileSync(path.join(dir, file), 'utf8');
      return { ...yaml.load(raw), _file: file };
    });
}

function writeYamlFile(dir, filename, data) {
  fs.writeFileSync(path.join(dir, filename), yaml.dump(data, { lineWidth: -1 }));
}

function renameIfNeeded(dir, oldFile, newFile) {
  if (oldFile && oldFile !== newFile) {
    const oldPath = path.join(dir, oldFile);
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }
}

// ---- Talks ----

app.get('/api/talks', (req, res) => {
  try { res.json(readMdFiles(TALKS_DIR)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/talks', (req, res) => {
  try {
    const { _body, _file, ...fm } = req.body;
    writeMdFile(TALKS_DIR, `${fm.slug}.md`, fm, _body);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/talks/:file', (req, res) => {
  try {
    const { _body, _file, ...fm } = req.body;
    renameIfNeeded(TALKS_DIR, req.params.file, `${fm.slug}.md`);
    writeMdFile(TALKS_DIR, `${fm.slug}.md`, fm, _body);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/talks/:file', (req, res) => {
  try {
    fs.unlinkSync(path.join(TALKS_DIR, req.params.file));
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---- Speakers ----

app.get('/api/speakers', (req, res) => {
  try { res.json(readMdFiles(SPEAKERS_DIR)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/speakers', (req, res) => {
  try {
    const { _body, _file, ...fm } = req.body;
    writeMdFile(SPEAKERS_DIR, `${fm.slug}.md`, fm, _body);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/speakers/:file', (req, res) => {
  try {
    const { _body, _file, ...fm } = req.body;
    renameIfNeeded(SPEAKERS_DIR, req.params.file, `${fm.slug}.md`);
    writeMdFile(SPEAKERS_DIR, `${fm.slug}.md`, fm, _body);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/speakers/:file', (req, res) => {
  try {
    fs.unlinkSync(path.join(SPEAKERS_DIR, req.params.file));
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---- Stages ----

app.get('/api/stages', (req, res) => {
  try { res.json(readYamlFiles(STAGES_DIR)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/stages', (req, res) => {
  try {
    const { _file, ...data } = req.body;
    writeYamlFile(STAGES_DIR, `${data.slug}.yml`, data);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/stages/:file', (req, res) => {
  try {
    const { _file, ...data } = req.body;
    renameIfNeeded(STAGES_DIR, req.params.file, `${data.slug}.yml`);
    writeYamlFile(STAGES_DIR, `${data.slug}.yml`, data);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/stages/:file', (req, res) => {
  try {
    fs.unlinkSync(path.join(STAGES_DIR, req.params.file));
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---- Git ----

app.get('/api/git/status', (req, res) => {
  exec(`git -C "${REPO_DIR}" status --short`, (err, stdout) => {
    const changes = stdout.trim().split('\n').filter(Boolean);
    res.json({ changes });
  });
});

app.post('/api/git/publish', (req, res) => {
  const rawMsg = (req.body.message || 'Schedule aktualisiert').replace(/'/g, "\\'");
  const cmd = `git -C "${REPO_DIR}" add -A && git -C "${REPO_DIR}" commit -m '${rawMsg}' && git -C "${REPO_DIR}" pull --rebase && git -C "${REPO_DIR}" push`;
  exec(cmd, (err, stdout, stderr) => {
    if (err) return res.json({ ok: false, error: stderr || err.message });
    res.json({ ok: true, output: stdout });
  });
});

// ---- Start ----

const PORT = 3131;
app.listen(PORT, () => {
  console.log(`\n✅  PRINTED Europe Admin\n`);
  console.log(`   http://localhost:${PORT}\n`);
});
