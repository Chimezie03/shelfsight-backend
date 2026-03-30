import type { Request, Response } from 'express';
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
import { AppError } from '../lib/errors';

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
  const file = req.file;
  if (!file) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'No image file provided. Upload a file with field name "image".',
      {
        fieldErrors: { image: 'Required' },
      },
    );
  }

  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/tiff'];
  if (!allowedMimes.includes(file.mimetype)) {
    throw new AppError(415, 'UNSUPPORTED_MEDIA_TYPE', `Accepted formats: ${allowedMimes.join(', ')}`, {
      accepted: allowedMimes,
    });
  }

  const s3Result = await uploadImageToS3(file.buffer, file.originalname, file.mimetype);

  const ocrText = await extractTextFromImage(file.buffer);

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

  const dewey = await classifyDeweyDecimal(ocrText, metadata);

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
}

export async function lookupBookByIsbn(req: Request, res: Response) {
  const isbnParam = typeof req.query.isbn === 'string' ? req.query.isbn : '';
  const isbn = normalizeIsbn(isbnParam);

  if (!isbn) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Query parameter "isbn" is required.', {
      fieldErrors: { isbn: 'Required' },
    });
  }

  if (!isValidIsbn(isbn)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'ISBN must be a valid 10-digit or 13-digit value.', {
      fieldErrors: { isbn: 'Invalid ISBN format' },
    });
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
}
