import { Router } from 'express';
import multer from 'multer';
import { wrapAsync } from '../lib/async-handler';
import { analyzeBookImage, lookupBookByIsbn } from '../controllers/ingest.controller';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

router.get('/lookup', wrapAsync(lookupBookByIsbn));

router.post('/analyze', upload.single('image'), wrapAsync(analyzeBookImage));

export default router;
