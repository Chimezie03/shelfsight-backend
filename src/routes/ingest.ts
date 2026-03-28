import { Router } from 'express';
import multer from 'multer';
import { analyzeBookImage, lookupBookByIsbn } from '../controllers/ingest.controller';

const router = Router();

// Multer configured for in-memory buffering (buffer forwarded to S3 & Textract)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max
});

/**
 * GET /ingest/lookup?isbn=...
 * Accepts an ISBN and returns normalized metadata from Open Library with
 * Google Books as fallback.
 */
router.get('/lookup', lookupBookByIsbn);

/**
 * POST /ingest/analyze
 * Accepts a single image upload (field: "image") and returns OCR text,
 * detected ISBN, enriched metadata, and Dewey Decimal classification.
 */
router.post('/analyze', upload.single('image'), analyzeBookImage);

export default router;
