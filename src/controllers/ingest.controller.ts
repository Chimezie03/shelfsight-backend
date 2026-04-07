import type { Request, Response } from 'express';
import {
  uploadImageToS3,
  type S3UploadResult,
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

const ALLOWED_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/tiff'];

interface ProcessedIngestionResult {
  jobId: string;
  image: {
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    s3: S3UploadResult;
  };
  ocr: {
    rawText: string;
    characterCount: number;
  };
  isbn: {
    detected: string | null;
    metadata: BookMetadata;
  };
  classification: {
    dewey_class: string | null;
    confidence_score: number;
    reasoning: string | null;
  };
  language: string | null;
}

function ensureAllowedMime(file: Express.Multer.File) {
  if (!ALLOWED_IMAGE_MIMES.includes(file.mimetype)) {
    throw new AppError(
      415,
      'UNSUPPORTED_MEDIA_TYPE',
      `Accepted formats: ${ALLOWED_IMAGE_MIMES.join(', ')}`,
      {
        accepted: ALLOWED_IMAGE_MIMES,
      },
    );
  }
}

function extractBatchFiles(req: Request): Express.Multer.File[] {
  if (Array.isArray(req.files)) {
    return req.files;
  }

  if (req.files && typeof req.files === 'object') {
    const grouped = req.files as Record<string, Express.Multer.File[]>;
    const files = [...(grouped.images ?? []), ...(grouped.image ?? [])];
    if (files.length > 0) {
      return files;
    }
  }

  return req.file ? [req.file] : [];
}

async function processSingleImage(file: Express.Multer.File): Promise<ProcessedIngestionResult> {
  ensureAllowedMime(file);

  const s3Result = await uploadImageToS3(file.buffer, file.originalname, file.mimetype);
  const ocrText = (await extractTextFromImage(file.buffer)).trim();

  const detectedRaw = detectIsbn(ocrText);
  const normalizedDetected = detectedRaw ? normalizeIsbn(detectedRaw) : null;
  const detectedIsbn = normalizedDetected && isValidIsbn(normalizedDetected) ? normalizedDetected : null;

  let metadata: BookMetadata = {
    isbn: detectedIsbn,
    title: null,
    author: null,
    publisher: null,
    publishDate: null,
    coverImageUrl: null,
    subjects: [],
    source: null,
  };

  let dewey = {
    dewey_class: null as string | null,
    confidence_score: 0,
    reasoning: null as string | null,
  };
  let language: string | null = null;

  if (detectedIsbn) {
    const isbnMetadata = await enrichMetadata(detectedIsbn);
    metadata = isbnMetadata;
    dewey = await classifyDeweyDecimal(ocrText, isbnMetadata);

    const needsOcrFallback = !hasMetadata(isbnMetadata) || !dewey.dewey_class || dewey.confidence_score < 40;
    if (needsOcrFallback) {
      const ocrMeta = await extractMetadataFromOcr(ocrText);
      metadata = {
        ...isbnMetadata,
        title: isbnMetadata.title ?? ocrMeta.title,
        author: isbnMetadata.author ?? ocrMeta.author,
        subjects: isbnMetadata.subjects.length > 0 ? isbnMetadata.subjects : ocrMeta.subjects,
        source:
          hasMetadata(isbnMetadata) || isbnMetadata.source
            ? `${isbnMetadata.source ?? 'ISBN'}+OCR+LLM`
            : 'OCR+LLM',
      };
      language = ocrMeta.language;

      if (!dewey.dewey_class || dewey.confidence_score < 40) {
        dewey = {
          dewey_class: ocrMeta.dewey_class,
          confidence_score: ocrMeta.confidence_score,
          reasoning: ocrMeta.reasoning,
        };
      }
    }
  } else {
    const ocrMeta = await extractMetadataFromOcr(ocrText);
    metadata = {
      ...metadata,
      title: ocrMeta.title,
      author: ocrMeta.author,
      subjects: ocrMeta.subjects,
      source: 'OCR+LLM',
    };
    language = ocrMeta.language;
    dewey = {
      dewey_class: ocrMeta.dewey_class,
      confidence_score: ocrMeta.confidence_score,
      reasoning: ocrMeta.reasoning,
    };
  }

  const job = await prisma.ingestionJob.create({
    data: {
      imageUrl: s3Result.url,
      status: 'COMPLETED',
      ocrText: ocrText || null,
      detectedIsbn,
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

  return {
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
      detected: detectedIsbn,
      metadata,
    },
    classification: {
      dewey_class: dewey.dewey_class,
      confidence_score: dewey.confidence_score,
      reasoning: dewey.reasoning,
    },
    language,
  };
}

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
  const result = await processSingleImage(file);

  res.status(200).json({
    success: true,
    data: result,
  });
}

export async function analyzeBookImagesBatch(req: Request, res: Response) {
  const files = extractBatchFiles(req);
  if (files.length === 0) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'No image files provided. Upload files with field name "images".',
      {
        fieldErrors: { images: 'Required' },
      },
    );
  }

  const results: Array<
    | {
        index: number;
        originalName: string;
        mimeType: string;
        sizeBytes: number;
        success: true;
        data: ProcessedIngestionResult;
      }
    | {
        index: number;
        originalName: string;
        mimeType: string;
        sizeBytes: number;
        success: false;
        error: {
          code: string;
          message: string;
          details: Record<string, unknown>;
        };
      }
  > = [];

  for (let i = 0; i < files.length; i += 1) {
    const file = files[i];
    try {
      const data = await processSingleImage(file);
      results.push({
        index: i,
        originalName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        success: true,
        data,
      });
    } catch (error) {
      if (error instanceof AppError) {
        results.push({
          index: i,
          originalName: file.originalname,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          success: false,
          error: {
            code: error.code,
            message: error.message,
            details: error.details,
          },
        });
      } else {
        results.push({
          index: i,
          originalName: file.originalname,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: error instanceof Error ? error.message : 'Unexpected batch ingestion error',
            details: {},
          },
        });
      }
    }
  }

  const successful = results.filter((item) => item.success).length;
  const failed = results.length - successful;

  res.status(200).json({
    success: true,
    data: {
      summary: {
        total: results.length,
        successful,
        failed,
      },
      results,
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
