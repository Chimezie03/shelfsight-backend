import { Request, Response } from 'express';
import {
  uploadImageToS3,
  extractTextFromImage,
  detectIsbn,
  enrichMetadata,
  hasMetadata,
  isValidIsbn,
  normalizeIsbn,
  classifyDeweyDecimal,
  type BookMetadata,
} from '../services/ingest.service';

/**
 * POST /ingest/analyze
 *
 * Accepts a multipart/form-data image upload (field name: "image") and runs
 * the full AI-assisted ingestion pipeline:
 *   1. Upload to S3
 *   2. OCR via Textract
 *   3. ISBN detection + metadata enrichment
 *   4. Dewey Decimal classification via LLM
 *   5. Return aggregated result for human review
 */
export async function analyzeBookImage(req: Request, res: Response) {
  try {
    // ---- Validate uploaded file ----
    const file = req.file;
    if (!file) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'No image file provided. Upload a file with field name "image".',
      });
      return;
    }

    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/tiff'];
    if (!allowedMimes.includes(file.mimetype)) {
      res.status(415).json({
        error: 'Unsupported Media Type',
        message: `Accepted formats: ${allowedMimes.join(', ')}`,
      });
      return;
    }

    // ---- 1. Upload image to S3 ----
    const s3Result = await uploadImageToS3(
      file.buffer,
      file.originalname,
      file.mimetype,
    );

    // ---- 2. Extract text via OCR ----
    const ocrText = await extractTextFromImage(file.buffer);

    // ---- 3. ISBN detection & metadata enrichment ----
    const isbn = detectIsbn(ocrText);

    let metadata: BookMetadata = {
      isbn,
      title: null,
      author: null,
      publisher: null,
      publishDate: null,
      coverImageUrl: null,
      subjects: [],
      source: null,
    };

    if (isbn) {
      metadata = await enrichMetadata(isbn);
    }

    // ---- 4. Dewey Decimal classification ----
    const dewey = await classifyDeweyDecimal(ocrText, metadata);

    // ---- 5. Aggregated response for human review ----
    res.status(200).json({
      success: true,
      data: {
        image: {
          originalName: file.originalname,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          s3: s3Result,
        },
        ocr: {
          rawText: ocrText,
          characterCount: ocrText.length,
        },
        isbn: {
          detected: isbn,
          metadata,
        },
        classification: {
          dewey_class: dewey.dewey_class,
          confidence_score: dewey.confidence_score,
          reasoning: dewey.reasoning,
        },
      },
    });
  } catch (err: any) {
    console.error('[ingest] analyzeBookImage error:', err);
    res.status(500).json({
      error: 'Internal Server Error',
      message: err.message || 'An unexpected error occurred during image analysis.',
    });
  }
}

export async function lookupBookByIsbn(req: Request, res: Response) {
  try {
    const isbnParam = typeof req.query.isbn === 'string' ? req.query.isbn : '';
    const isbn = normalizeIsbn(isbnParam);

    if (!isbn) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Query parameter "isbn" is required.',
      });
      return;
    }

    if (!isValidIsbn(isbn)) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'ISBN must be a valid 10-digit or 13-digit value.',
      });
      return;
    }

    const metadata = await enrichMetadata(isbn);

    res.status(200).json({
      success: true,
      data: {
        isbn,
        found: hasMetadata(metadata),
        metadata,
      },
    });
  } catch (err: any) {
    console.error('[ingest] lookupBookByIsbn error:', err);
    res.status(500).json({
      error: 'Internal Server Error',
      message: err.message || 'An unexpected error occurred during ISBN lookup.',
    });
  }
}
