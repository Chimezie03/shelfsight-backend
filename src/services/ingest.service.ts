import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import {
  TextractClient,
  DetectDocumentTextCommand,
} from '@aws-sdk/client-textract';
import OpenAI from 'openai';

// ---------------------------------------------------------------------------
// AWS & OpenAI clients (initialised lazily from env vars)
// ---------------------------------------------------------------------------

const awsRegion = process.env.AWS_REGION || 'us-east-1';

const s3 = new S3Client({ region: awsRegion });
const sqs = new SQSClient({ region: awsRegion });
const textract = new TextractClient({ region: awsRegion });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

// ---------------------------------------------------------------------------
// 1. Upload image buffer to S3 (stub-ready)
// ---------------------------------------------------------------------------

export interface S3UploadResult {
  bucket: string;
  key: string;
  url: string;
}

/**
 * Uploads the raw image buffer to an S3 bucket and publishes a message to
 * the SQS queue so the Lambda-based async pipeline can be triggered.
 *
 * Set `S3_BUCKET_NAME` in your environment to enable real uploads.
 * Set `SQS_QUEUE_URL` to enable the SQS trigger for Lambda processing.
 * When either is missing the respective step is stubbed out for local dev.
 */
export async function uploadImageToS3(
  fileBuffer: Buffer,
  originalName: string,
  mimeType: string,
): Promise<S3UploadResult> {
  const bucket = process.env.S3_BUCKET_NAME || '';
  const key = `ingest/${Date.now()}-${originalName}`;

  if (!bucket) {
    // ---- S3 STUB: return a placeholder when no bucket is configured ----
    console.warn('[ingest] S3_BUCKET_NAME not set – skipping real upload.');
    return {
      bucket: 'stub-bucket',
      key,
      url: `https://stub-bucket.s3.${awsRegion}.amazonaws.com/${key}`,
    };
  }

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: fileBuffer,
      ContentType: mimeType,
    }),
  );

  const s3Url = `https://${bucket}.s3.${awsRegion}.amazonaws.com/${key}`;

  // ---- Publish to SQS so the Lambda pipeline can pick it up ----
  await publishToSqs({ bucket, key, url: s3Url, originalName, mimeType });

  return { bucket, key, url: s3Url };
}

/**
 * Publishes a message to the configured SQS queue with the S3 object details.
 * In production the queue triggers an AWS Lambda that runs the Textract →
 * ISBN → Dewey pipeline asynchronously.
 *
 * Skipped silently when `SQS_QUEUE_URL` is not set.
 */
async function publishToSqs(payload: {
  bucket: string;
  key: string;
  url: string;
  originalName: string;
  mimeType: string;
}): Promise<void> {
  const queueUrl = process.env.SQS_QUEUE_URL || '';

  if (!queueUrl) {
    console.warn('[ingest] SQS_QUEUE_URL not set – skipping queue publish.');
    return;
  }

  try {
    await sqs.send(
      new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: JSON.stringify({
          action: 'INGEST_ANALYZE',
          s3Bucket: payload.bucket,
          s3Key: payload.key,
          s3Url: payload.url,
          originalName: payload.originalName,
          mimeType: payload.mimeType,
          timestamp: new Date().toISOString(),
        }),
      }),
    );
    console.log('[ingest] SQS message published for', payload.key);
  } catch (err: any) {
    // Non-fatal: the synchronous pipeline will still return results
    console.error('[ingest] SQS publish error:', err.message);
  }
}

// ---------------------------------------------------------------------------
// 2. OCR via AWS Textract
// ---------------------------------------------------------------------------

/**
 * Sends the image bytes to AWS Textract using `DetectDocumentTextCommand`.
 * Textract returns a JSON object containing Blocks of text — we concatenate
 * the `Text` fields from LINE-type blocks into a single raw string
 * representing everything written on the cover/spine.
 *
 * In production this same logic runs inside the Lambda triggered by SQS.
 * When AWS credentials are missing the function returns an empty string so the
 * downstream pipeline can still be demonstrated.
 */
export async function extractTextFromImage(
  fileBuffer: Buffer,
): Promise<string> {
  try {
    const response = await textract.send(
      new DetectDocumentTextCommand({
        Document: { Bytes: fileBuffer },
      }),
    );

    const lines =
      response.Blocks?.filter((b) => b.BlockType === 'LINE').map(
        (b) => b.Text ?? '',
      ) ?? [];

    return lines.join('\n');
  } catch (err: any) {
    console.error('[ingest] Textract error:', err.message);
    // Return empty so caller can decide how to handle gracefully
    return '';
  }
}

// ---------------------------------------------------------------------------
// 3. ISBN detection + metadata enrichment
// ---------------------------------------------------------------------------

export interface BookMetadata {
  isbn: string | null;
  title: string | null;
  author: string | null;
  publisher: string | null;
  publishDate: string | null;
  source: string | null;
}

/**
 * Scans the raw OCR text for an ISBN-13 pattern using the standard regex.
 * Falls back to ISBN-10 detection if no ISBN-13 is found.
 * Returns the first match (digits only) or `null`.
 */
export function detectIsbn(ocrText: string): string | null {
  // Standard ISBN-13 regex (may be preceded by "ISBN-13:" etc.)
  const isbn13Regex =
    /(?:ISBN(?:-13)?:?\s*)?(97[89][-\s]?[0-9]{1,5}[-\s]?[0-9]+[-\s]?[0-9]+[-\s]?[0-9])/i;

  const match13 = isbn13Regex.exec(ocrText);
  if (match13 && match13[1]) {
    return match13[1].replace(/[-\s]/g, '');
  }

  // Fallback: ISBN-10 (may end in X)
  const isbn10Regex =
    /(?:ISBN(?:-10)?:?\s*)([0-9]{1,5}[-\s]?[0-9]+[-\s]?[0-9]+[-\s]?[0-9Xx])/i;

  const match10 = isbn10Regex.exec(ocrText);
  if (match10 && match10[1]) {
    return match10[1].replace(/[-\s]/g, '');
  }

  return null;
}

/**
 * Given an ISBN, queries the Open Library Books API for structured metadata.
 * Falls back to Google Books if Open Library returns nothing.
 */
export async function enrichMetadata(isbn: string): Promise<BookMetadata> {
  const base: BookMetadata = {
    isbn,
    title: null,
    author: null,
    publisher: null,
    publishDate: null,
    source: null,
  };

  // --- Try Open Library first ---
  try {
    const olRes = await fetch(
      `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`,
    );
    const olData = (await olRes.json()) as Record<string, any>;
    const entry = olData[`ISBN:${isbn}`];

    if (entry) {
      base.title = entry.title ?? null;
      base.author =
        entry.authors?.map((a: any) => a.name).join(', ') ?? null;
      base.publisher =
        entry.publishers?.map((p: any) => p.name).join(', ') ?? null;
      base.publishDate = entry.publish_date ?? null;
      base.source = 'Open Library';
      return base;
    }
  } catch (err: any) {
    console.warn('[ingest] Open Library lookup failed:', err.message);
  }

  // --- Fallback: Google Books ---
  try {
    const gRes = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`,
    );
    const gData = (await gRes.json()) as any;
    const vol = gData.items?.[0]?.volumeInfo;

    if (vol) {
      base.title = vol.title ?? null;
      base.author = vol.authors?.join(', ') ?? null;
      base.publisher = vol.publisher ?? null;
      base.publishDate = vol.publishedDate ?? null;
      base.source = 'Google Books';
      return base;
    }
  } catch (err: any) {
    console.warn('[ingest] Google Books lookup failed:', err.message);
  }

  return base;
}

// ---------------------------------------------------------------------------
// 4. Dewey Decimal classification via LLM
// ---------------------------------------------------------------------------

export interface DeweyClassification {
  dewey_class: string | null;
  confidence_score: number;
  reasoning: string | null;
}

/**
 * Sends the OCR text + any enriched metadata to OpenAI and asks for a Dewey
 * Decimal classification with a confidence score.
 *
 * Prompt format matches the spec:
 *   "Based on the following book data (Title: …, Author: …, OCR Text: …),
 *    suggest the most accurate Dewey Decimal classification. Return ONLY a
 *    JSON object with two keys: 'dewey_class' (string) and
 *    'confidence_score' (number between 0 and 100)."
 *
 * If the confidence_score is below a configured threshold the front-end can
 * flag the entry for closer manual review.
 *
 * When `OPENAI_API_KEY` is missing the function returns a stub result.
 */
export async function classifyDeweyDecimal(
  ocrText: string,
  metadata: BookMetadata,
): Promise<DeweyClassification> {
  if (!process.env.OPENAI_API_KEY) {
    console.warn('[ingest] OPENAI_API_KEY not set – returning stub classification.');
    return {
      dewey_class: null,
      confidence_score: 0,
      reasoning: 'LLM unavailable (no API key configured).',
    };
  }

  const title = metadata.title || 'Unknown';
  const author = metadata.author || 'Unknown';
  const ocrSnippet = ocrText || '(no text extracted)';

  const userPrompt =
    `Based on the following book data (Title: ${title}, Author: ${author}, ` +
    `OCR Text: ${ocrSnippet}), suggest the most accurate Dewey Decimal ` +
    `classification. Return ONLY a JSON object with two keys: 'dewey_class' ` +
    `(string) and 'confidence_score' (number between 0 and 100).`;

  const systemPrompt =
    `You are a librarian assistant specializing in Dewey Decimal Classification. ` +
    `Respond ONLY with valid JSON — no markdown, no extra keys. ` +
    `Include exactly these keys: "dewey_class" (string), "confidence_score" (integer 0-100), ` +
    `and optionally "reasoning" (one-sentence explanation).`;

  try {
    const chat = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      temperature: 0.2,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
    });

    const raw = chat.choices[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(raw) as Record<string, any>;

    return {
      dewey_class: parsed.dewey_class ?? null,
      confidence_score:
        typeof parsed.confidence_score === 'number'
          ? Math.min(100, Math.max(0, Math.round(parsed.confidence_score)))
          : 0,
      reasoning: parsed.reasoning ?? null,
    };
  } catch (err: any) {
    console.error('[ingest] OpenAI classification error:', err.message);
    return {
      dewey_class: null,
      confidence_score: 0,
      reasoning: `LLM error: ${err.message}`,
    };
  }
}
