// REST API for photos: full CRUD.
//   POST   /api/photos          - upload a photo file + metadata
//   GET    /api/photos          - list all photos
//   GET    /api/photos/:id      - read one photo's metadata
//   PUT    /api/photos/:id      - update title/description/tags
//   DELETE /api/photos/:id      - delete blob and metadata doc

const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

const blob = require('../services/blobService');
const cosmos = require('../services/cosmosService');

const router = express.Router();

// In-memory upload (good up to ~10MB; tweak the limit for larger photos)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

// CREATE
router.post('/', upload.single('photo'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'photo file is required (multipart field "photo")' });

    const { blobName, url } = await blob.uploadPhoto(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
    );

    const tags = parseTags(req.body.tags);
    const doc = {
      id: uuidv4(),
      title: req.body.title || req.file.originalname,
      description: req.body.description || '',
      tags,
      blobName,
      blobUrl: url,
      contentType: req.file.mimetype,
      sizeBytes: req.file.size,
      createdAt: new Date().toISOString(),
    };
    const saved = await cosmos.createPhoto(doc);
    res.status(201).json(saved);
  } catch (err) {
    next(err);
  }
});

// LIST
router.get('/', async (_req, res, next) => {
  try {
    const items = await cosmos.listPhotos();
    res.json(items);
  } catch (err) {
    next(err);
  }
});

// READ ONE
router.get('/:id', async (req, res, next) => {
  try {
    const doc = await cosmos.getPhoto(req.params.id);
    if (!doc) return res.status(404).json({ error: 'not found' });
    res.json(doc);
  } catch (err) {
    next(err);
  }
});

// UPDATE (metadata only)
router.put('/:id', async (req, res, next) => {
  try {
    const patch = {};
    if (typeof req.body.title === 'string') patch.title = req.body.title;
    if (typeof req.body.description === 'string') patch.description = req.body.description;
    if (req.body.tags !== undefined) patch.tags = parseTags(req.body.tags);

    const updated = await cosmos.updatePhoto(req.params.id, patch);
    if (!updated) return res.status(404).json({ error: 'not found' });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE
router.delete('/:id', async (req, res, next) => {
  try {
    const doc = await cosmos.getPhoto(req.params.id);
    if (!doc) return res.status(404).json({ error: 'not found' });
    await blob.deletePhoto(doc.blobName);
    await cosmos.deletePhoto(req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

function parseTags(input) {
  if (!input) return [];
  if (Array.isArray(input)) return input.map(String).map((s) => s.trim()).filter(Boolean);
  return String(input).split(',').map((s) => s.trim()).filter(Boolean);
}

module.exports = router;
