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
  extractMetadataFromOcr,
  listIngestionJobs,
  getIngestionJobById,
  approveIngestionJob,
  rejectIngestionJob,
  type BookMetadata,
} from '../services/ingest.service';
import { AppError } from '../lib/errors';
import prisma from '../lib/prisma';
import type { IngestionStatus } from '@prisma/client';

/**
 * POST /ingest/analyze
 *
 * Accepts a multipart/form-data image upload (field name: "image") and runs
 * the full AI-assisted ingestion pipeline:
 *   1. Upload to S3
 *   2. OCR via Textract
 *   3. ISBN detection + metadata enrichment
 *   4. Dewey Decimal classification via LLM
 *   5. Persist as IngestionJob
 *   6. Return aggregated result for human review
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

  let dewey = { dewey_class: null as string | null, confidence_score: 0, reasoning: null as string | null };
  let language: string | null = null;

  if (isbn) {
    metadata = await enrichMetadata(isbn);
    dewey = await classifyDeweyDecimal(ocrText, metadata);
  } else {
    // No ISBN detected — use LLM to extract metadata from OCR text directly
    const ocrMeta = await extractMetadataFromOcr(ocrText);
    metadata.title = ocrMeta.title;
    metadata.author = ocrMeta.author;
    metadata.subjects = ocrMeta.subjects;
    metadata.source = 'OCR+LLM';
    language = ocrMeta.language;
    dewey = {
      dewey_class: ocrMeta.dewey_class,
      confidence_score: ocrMeta.confidence_score,
      reasoning: ocrMeta.reasoning,
    };
  }

  // Persist as IngestionJob
  const job = await prisma.ingestionJob.create({
    data: {
      imageUrl: s3Result.url,
      status: 'COMPLETED',
      ocrText,
      detectedIsbn: isbn,
      suggestedDewey: dewey.dewey_class,
      confidenceScore: dewey.confidence_score,
      suggestedTitle: metadata.title,
      suggestedAuthor: metadata.author,
      suggestedPublisher: metadata.publisher,
      suggestedPublishDate: metadata.publishDate,
      suggestedGenre: metadata.subjects[0] || null,
      coverImageUrl: metadata.coverImageUrl,
      metadataSource: metadata.source,
      deweyReasoning: dewey.reasoning,
      language,
    },
  });

  res.status(200).json({
    success: true,
    data: {
      jobId: job.id,
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
      language,
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

// ---------------------------------------------------------------------------
// Job management endpoints
// ---------------------------------------------------------------------------

export async function listJobs(req: Request, res: Response) {
  const status = req.query.status as IngestionStatus | undefined;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;

  const result = await listIngestionJobs({ status, page, limit });

  res.status(200).json({
    success: true,
    data: result.jobs,
    meta: { total: result.total, page: result.page, limit: result.limit },
  });
}

export async function getJob(req: Request, res: Response) {
  const job = await getIngestionJobById(req.params.id);
  res.status(200).json({ success: true, data: job });
}

export async function approveJob(req: Request, res: Response) {
  const { title, author, isbn, genre, deweyDecimal, coverImageUrl, publishYear, language } =
    req.body;

  if (!title || !author || !isbn) {
    throw new AppError(400, 'VALIDATION_ERROR', 'title, author, and isbn are required.', {
      fieldErrors: {
        ...(title ? {} : { title: 'Required' }),
        ...(author ? {} : { author: 'Required' }),
        ...(isbn ? {} : { isbn: 'Required' }),
      },
    });
  }

  const reviewedBy = (req as any).user?.userId || 'unknown';
  const result = await approveIngestionJob(
    req.params.id,
    { title, author, isbn, genre, deweyDecimal, coverImageUrl, publishYear, language },
    reviewedBy,
  );

  res.status(200).json({ success: true, data: result });
}

export async function rejectJob(req: Request, res: Response) {
  const reviewedBy = (req as any).user?.userId || 'unknown';
  const job = await rejectIngestionJob(req.params.id, reviewedBy);
  res.status(200).json({ success: true, data: job });
}
