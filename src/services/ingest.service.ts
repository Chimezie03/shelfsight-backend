import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import {
  TextractClient,
  DetectDocumentTextCommand,
} from '@aws-sdk/client-textract';
import OpenAI from 'openai';
import { forOrg } from '../lib/prisma';
import { AppError } from '../lib/errors';
import type { IngestionStatus } from '@prisma/client';
const fetch = require('node-fetch');
(globalThis as any).fetch = fetch;

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
  opts?: { organizationId?: string },
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
  await publishToSqs({
    bucket,
    key,
    url: s3Url,
    originalName,
    mimeType,
    organizationId: opts?.organizationId,
  });

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
  organizationId?: string;
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
          organizationId: payload.organizationId,
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
  coverImageUrl: string | null;
  subjects: string[];
  source: string | null;
}

export function normalizeIsbn(rawIsbn: string): string {
  return rawIsbn.replace(/[^0-9Xx]/g, '').toUpperCase();
}

export function isValidIsbn(isbn: string): boolean {
  return /^(?:\d{9}[\dX]|\d{13})$/.test(isbn);
}

function isbn13ChecksumOk(isbn: string): boolean {
  if (isbn.length !== 13 || !/^\d{13}$/.test(isbn)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const d = isbn.charCodeAt(i) - 48;
    sum += i % 2 === 0 ? d : d * 3;
  }
  return ((10 - (sum % 10)) % 10) === isbn.charCodeAt(12) - 48;
}

function isbn10ChecksumOk(isbn: string): boolean {
  if (isbn.length !== 10 || !/^\d{9}[\dX]$/.test(isbn)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += (isbn.charCodeAt(i) - 48) * (10 - i);
  sum += isbn[9] === 'X' ? 10 : isbn.charCodeAt(9) - 48;
  return sum % 11 === 0;
}

/**
 * Scans OCR text for an ISBN. Tolerant of multi-space, line breaks, and
 * digit groups split across formatting. Validates with check-digit so we
 * don't accept arbitrary 13-digit numbers (e.g. UPCs, phone numbers).
 */
export function detectIsbn(ocrText: string): string | null {
  if (!ocrText) return null;

  // Pass 1 — labeled form: "ISBN-13: 978-...". Take the next ~20 chars.
  const labeled = /ISBN(?:[-\s]*1[03])?[:\s]+([\d][\dXx\s-]{8,20})/i.exec(ocrText);
  if (labeled && labeled[1]) {
    const norm = normalizeIsbn(labeled[1]);
    if (norm.length >= 13 && isbn13ChecksumOk(norm.slice(0, 13))) return norm.slice(0, 13);
    if (norm.length >= 10 && isbn10ChecksumOk(norm.slice(0, 10))) return norm.slice(0, 10);
  }

  // Pass 2 — strip everything but digits/X and slide a window across the text.
  // Catches ISBNs split by line breaks or extra whitespace.
  const compact = ocrText.replace(/[^0-9Xx]/g, '').toUpperCase();

  for (let i = 0; i + 13 <= compact.length; i++) {
    const slice = compact.slice(i, i + 13);
    if (/^97[89]\d{10}$/.test(slice) && isbn13ChecksumOk(slice)) return slice;
  }

  for (let i = 0; i + 10 <= compact.length; i++) {
    const slice = compact.slice(i, i + 10);
    if (/^\d{9}[\dX]$/.test(slice) && isbn10ChecksumOk(slice)) return slice;
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
    coverImageUrl: null,
    subjects: [],
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
      base.coverImageUrl =
        entry.cover?.large ?? entry.cover?.medium ?? entry.cover?.small ?? null;
      base.subjects =
        entry.subjects?.map((subject: any) => subject.name).filter(Boolean) ?? [];
      base.source = 'Open Library';
      return base;
    }
  } catch (err: any) {
    console.warn('[ingest] Open Library lookup failed:', err.message);
  }

  // --- Fallback: Google Books ---
  try {
    const apiKey = process.env.GOOGLE_BOOKS_API_KEY || '';
    const gbUrl = new URL('https://www.googleapis.com/books/v1/volumes');
    gbUrl.searchParams.set('q', `isbn:${isbn}`);
    if (apiKey) gbUrl.searchParams.set('key', apiKey);
    const gRes = await fetch(gbUrl.toString());
    const gData = (await gRes.json()) as any;
    const vol = gData.items?.[0]?.volumeInfo;

    if (vol) {
      base.title = vol.title ?? null;
      base.author = vol.authors?.join(', ') ?? null;
      base.publisher = vol.publisher ?? null;
      base.publishDate = vol.publishedDate ?? null;
      base.coverImageUrl =
        vol.imageLinks?.thumbnail ??
        vol.imageLinks?.smallThumbnail ??
        null;
      base.subjects = vol.categories ?? [];
      base.source = 'Google Books';
      return base;
    }
  } catch (err: any) {
    console.warn('[ingest] Google Books lookup failed:', err.message);
  }

  return base;
}

function pickBestIsbn(isbns: string[]): string | null {
  for (const raw of isbns) {
    const norm = normalizeIsbn(raw);
    if (norm.length === 13 && isbn13ChecksumOk(norm)) return norm;
  }
  for (const raw of isbns) {
    const norm = normalizeIsbn(raw);
    if (norm.length === 10 && isbn10ChecksumOk(norm)) return norm;
  }
  return null;
}

async function searchOpenLibrary(
  titleQuery: string,
  authorQuery: string,
): Promise<BookMetadata | null> {
  const olUrl = new URL('https://openlibrary.org/search.json');
  olUrl.searchParams.set('title', titleQuery);
  if (authorQuery) olUrl.searchParams.set('author', authorQuery);
  olUrl.searchParams.set('limit', '5');
  const olRes = await fetch(olUrl.toString());
  const olData = (await olRes.json()) as { docs?: Array<Record<string, any>> };
  for (const doc of olData.docs ?? []) {
    const isbns: string[] = Array.isArray(doc.isbn) ? doc.isbn : [];
    const picked = pickBestIsbn(isbns);
    if (!picked) continue;
    const enriched = await enrichMetadata(picked);
    if (hasMetadata(enriched)) return enriched;
    return {
      isbn: picked,
      title: typeof doc.title === 'string' ? doc.title : null,
      author: Array.isArray(doc.author_name) ? doc.author_name.join(', ') : null,
      publisher: Array.isArray(doc.publisher) ? doc.publisher[0] : null,
      publishDate: doc.first_publish_year ? String(doc.first_publish_year) : null,
      coverImageUrl: doc.cover_i
        ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`
        : null,
      subjects: Array.isArray(doc.subject) ? doc.subject.slice(0, 5) : [],
      source: 'Open Library Search',
    };
  }
  return null;
}

async function searchGoogleBooks(
  titleQuery: string,
  authorQuery: string,
): Promise<BookMetadata | null> {
  const apiKey = process.env.GOOGLE_BOOKS_API_KEY || '';
  const gbUrl = new URL('https://www.googleapis.com/books/v1/volumes');
  const q = authorQuery ? `intitle:${titleQuery} inauthor:${authorQuery}` : `intitle:${titleQuery}`;
  gbUrl.searchParams.set('q', q);
  gbUrl.searchParams.set('maxResults', '5');
  if (apiKey) gbUrl.searchParams.set('key', apiKey);
  const gRes = await fetch(gbUrl.toString());
  const gData = (await gRes.json()) as { items?: Array<{ volumeInfo?: any }> };
  for (const item of gData.items ?? []) {
    const ids = item.volumeInfo?.industryIdentifiers ?? [];
    const candidates: string[] = ids
      .map((i: any) => (typeof i?.identifier === 'string' ? i.identifier : ''))
      .filter(Boolean);
    const picked = pickBestIsbn(candidates);
    if (!picked) continue;
    const enriched = await enrichMetadata(picked);
    if (hasMetadata(enriched)) return enriched;
    const vol = item.volumeInfo ?? {};
    return {
      isbn: picked,
      title: vol.title ?? null,
      author: Array.isArray(vol.authors) ? vol.authors.join(', ') : null,
      publisher: vol.publisher ?? null,
      publishDate: vol.publishedDate ?? null,
      coverImageUrl:
        vol.imageLinks?.thumbnail ?? vol.imageLinks?.smallThumbnail ?? null,
      subjects: Array.isArray(vol.categories) ? vol.categories : [],
      source: 'Google Books Search',
    };
  }
  return null;
}

function normalizeForCompare(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Loose match — equal, or one is a substring of the other after normalization. */
function titlesLooselyMatch(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  const na = normalizeForCompare(a);
  const nb = normalizeForCompare(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

/**
 * Last-resort: ask the LLM to suggest an ISBN, then VERIFY it against
 * Open Library / Google Books. The LLM is unreliable about ISBNs (it
 * confidently hallucinates plausible-looking numbers), so we never trust
 * the suggestion until enrichMetadata confirms a real catalog entry whose
 * title loosely matches the OCR-extracted title.
 */
async function guessIsbnViaLlm(
  title: string,
  author: string | null,
  ocrText: string,
): Promise<BookMetadata | null> {
  if (!process.env.OPENAI_API_KEY) {
    console.info('[ingest] LLM ISBN fallback skipped — OPENAI_API_KEY not set.');
    return null;
  }

  const ocrExcerpt = ocrText.trim().slice(0, 800);
  // Encourage the LLM to GUESS — we verify every candidate against Open Library
  // / Google Books before trusting it, so hallucinations are caught downstream.
  const systemPrompt =
    'You identify books from partial information. Given a title, optional author, ' +
    "and OCR text, return up to 5 candidate ISBN-13 (or ISBN-10) values for this exact book — " +
    'editions, reprints, regional variants, etc. Your guesses will be verified against ' +
    'Open Library and Google Books, so include even uncertain matches. ' +
    'Respond ONLY with JSON: {"isbns": ["<digits>", ...]}. Use [] if you have no idea.';

  const userPrompt =
    `Title: ${title}\n` +
    `Author: ${author ?? '(unknown)'}\n` +
    (ocrExcerpt ? `OCR text:\n${ocrExcerpt}\n` : '') +
    '\nReturn up to 5 ISBN candidates. We will verify each one — guessing is encouraged.';

  let candidates: string[] = [];
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
    const parsed = JSON.parse(raw) as { isbns?: unknown; isbn?: unknown };
    const list: unknown[] = Array.isArray(parsed.isbns)
      ? parsed.isbns
      : typeof parsed.isbn === 'string'
        ? [parsed.isbn]
        : [];
    candidates = list
      .map((v) => (typeof v === 'string' ? normalizeIsbn(v) : ''))
      .filter((c) => (c.length === 13 && isbn13ChecksumOk(c)) || (c.length === 10 && isbn10ChecksumOk(c)));
    console.info(
      `[ingest] LLM suggested ${candidates.length} ISBN candidate(s) for "${title}": ${candidates.join(', ') || '(none)'}`,
    );
  } catch (err: any) {
    console.warn('[ingest] LLM ISBN guess failed:', err.message);
    return null;
  }

  if (candidates.length === 0) return null;

  for (const candidate of candidates) {
    const enriched = await enrichMetadata(candidate);
    if (!hasMetadata(enriched)) {
      console.info(`[ingest] LLM ISBN ${candidate}: no catalog match — skipping.`);
      continue;
    }
    if (!titlesLooselyMatch(enriched.title, title)) {
      console.info(
        `[ingest] LLM ISBN ${candidate} → "${enriched.title}" doesn't match "${title}" — skipping.`,
      );
      continue;
    }
    console.info(`[ingest] LLM ISBN ${candidate} verified — accepting "${enriched.title}".`);
    return { ...enriched, source: enriched.source ? `${enriched.source}+LLM` : 'LLM-verified' };
  }
  console.info(`[ingest] LLM ISBN candidates all failed verification for "${title}".`);
  return null;
}

/**
 * Fallback when OCR text contains no ISBN. Uses LLM-extracted title/author
 * to search Open Library, then Google Books, returning enriched metadata
 * (including an ISBN) for the best match. Tries title+author first, then
 * retries title-only — author spellings from OCR/LLM often don't match
 * exactly. As a last resort, asks the LLM to suggest an ISBN and verifies
 * it against Open Library before trusting it. Returns null if nothing matches.
 */
export async function searchIsbnByTitleAuthor(
  title: string,
  author: string | null,
  ocrText = '',
): Promise<BookMetadata | null> {
  const titleQuery = title?.trim() ?? '';
  if (!titleQuery) return null;
  const authorQuery = author?.trim() ?? '';

  console.info(
    `[ingest] searchIsbnByTitleAuthor title="${titleQuery}" author="${authorQuery || '(none)'}"`,
  );

  const attempts: Array<{ title: string; author: string }> = [];
  if (authorQuery) attempts.push({ title: titleQuery, author: authorQuery });
  attempts.push({ title: titleQuery, author: '' });

  for (const attempt of attempts) {
    try {
      const ol = await searchOpenLibrary(attempt.title, attempt.author);
      if (ol) return ol;
    } catch (err: any) {
      console.warn('[ingest] Open Library search failed:', err.message);
    }
    try {
      const gb = await searchGoogleBooks(attempt.title, attempt.author);
      if (gb) return gb;
    } catch (err: any) {
      console.warn('[ingest] Google Books search failed:', err.message);
    }
  }

  // Last resort: ask the LLM, then verify the suggestion against real catalogs.
  const llmGuess = await guessIsbnViaLlm(titleQuery, authorQuery || null, ocrText);
  if (llmGuess) return llmGuess;

  return null;
}

export function hasMetadata(metadata: BookMetadata): boolean {
  return Boolean(
    metadata.title ||
      metadata.author ||
      metadata.publisher ||
      metadata.publishDate ||
      metadata.coverImageUrl ||
      metadata.subjects.length,
  );
}

// ---------------------------------------------------------------------------
// 4. Dewey Decimal classification via LLM
// ---------------------------------------------------------------------------

export interface DeweyClassification {
  dewey_class: string | null;
  confidence_score: number;
  reasoning: string | null;
  /**
   * KAN-60: indicates where the classification came from so the UI can
   * show a badge on non-LLM results. 'llm' = OpenAI, 'heuristic' = subject
   * keyword match, 'unavailable' = no signal at all (neither LLM nor
   * heuristic could decide).
   */
  source: 'llm' | 'heuristic' | 'unavailable';
}

// Subject keyword → Dewey hundreds. Coarse on purpose — it's only the
// fallback when OpenAI is unavailable and real catalog sources (WorldCat,
// Open Library) didn't return a classification.
const DEWEY_KEYWORD_MAP: Array<{ keywords: RegExp; dewey: string; label: string }> = [
  { keywords: /philosophy|ethics|logic|metaphysics/i, dewey: '100', label: 'Philosophy' },
  { keywords: /religion|theology|bible|christian|islam|buddh|hindu/i, dewey: '200', label: 'Religion' },
  { keywords: /politic|economic|sociolog|law|education|statistic|government/i, dewey: '300', label: 'Social sciences' },
  { keywords: /language|linguistic|grammar|dictionar/i, dewey: '400', label: 'Language' },
  { keywords: /mathematic|physics|chemistry|biolog|astronomy|geology|science/i, dewey: '500', label: 'Science' },
  { keywords: /medicine|engineering|technology|computer|agriculture|cooking|manufactur/i, dewey: '600', label: 'Technology' },
  { keywords: /art|music|sport|recreation|photograph|architecture|theatre/i, dewey: '700', label: 'Arts & recreation' },
  { keywords: /fiction|novel|poetry|drama|literature|essay/i, dewey: '800', label: 'Literature' },
  { keywords: /histor|geograph|biograph|travel/i, dewey: '900', label: 'History & geography' },
];

/**
 * KAN-60: deterministic Dewey guess from subjects/title when OpenAI is
 * unavailable. Returns null if nothing matches so callers can show a clear
 * "no classification" state instead of silently stubbing 0.
 */
function heuristicDewey(metadata: BookMetadata, ocrText = ''): { dewey_class: string; label: string } | null {
  const haystack = [
    ...(metadata.subjects ?? []),
    metadata.title ?? '',
    ocrText.slice(0, 500),
  ]
    .filter(Boolean)
    .join(' ');
  if (!haystack.trim()) return null;

  for (const rule of DEWEY_KEYWORD_MAP) {
    if (rule.keywords.test(haystack)) {
      return { dewey_class: rule.dewey, label: rule.label };
    }
  }
  return null;
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
    console.warn('[ingest] OPENAI_API_KEY not set – trying heuristic Dewey fallback.');
    const guess = heuristicDewey(metadata, ocrText);
    if (guess) {
      return {
        dewey_class: guess.dewey_class,
        confidence_score: 30, // low — heuristic only
        reasoning: `Heuristic match on ${guess.label} keywords (no LLM configured).`,
        source: 'heuristic',
      };
    }
    return {
      dewey_class: null,
      confidence_score: 0,
      reasoning: 'LLM unavailable and heuristic fallback found no matching subjects. Reviewer must set Dewey manually.',
      source: 'unavailable',
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
      source: 'llm',
    };
  } catch (err: any) {
    console.error('[ingest] OpenAI classification error:', err.message);
    const guess = heuristicDewey(metadata, ocrText);
    if (guess) {
      return {
        dewey_class: guess.dewey_class,
        confidence_score: 30,
        reasoning: `LLM error (${err.message}); fell back to heuristic match on ${guess.label} keywords.`,
        source: 'heuristic',
      };
    }
    return {
      dewey_class: null,
      confidence_score: 0,
      reasoning: `LLM error: ${err.message}`,
      source: 'unavailable',
    };
  }
}

// ---------------------------------------------------------------------------
// 5. OCR-based metadata extraction for no-ISBN books
// ---------------------------------------------------------------------------

export interface OcrMetadataResult {
  title: string | null;
  author: string | null;
  language: string | null;
  subjects: string[];
  dewey_class: string | null;
  confidence_score: number;
  reasoning: string | null;
}

/**
 * When no ISBN is detected from OCR text (common for non-English books or
 * books without a visible ISBN), sends the raw OCR text to OpenAI to extract
 * metadata directly. Handles books in any language.
 */
export async function extractMetadataFromOcr(
  ocrText: string,
): Promise<OcrMetadataResult> {
  if (!process.env.OPENAI_API_KEY) {
    console.warn('[ingest] OPENAI_API_KEY not set – returning stub OCR metadata.');
    return {
      title: null,
      author: null,
      language: null,
      subjects: [],
      dewey_class: null,
      confidence_score: 0,
      reasoning: 'LLM unavailable (no API key configured).',
    };
  }

  if (!ocrText.trim()) {
    return {
      title: null,
      author: null,
      language: null,
      subjects: [],
      dewey_class: null,
      confidence_score: 0,
      reasoning: 'No OCR text available for analysis.',
    };
  }

  const systemPrompt =
    `You are a multilingual librarian assistant. You can identify books from any language. ` +
    `Given OCR text extracted from a book cover or spine, extract the metadata and suggest ` +
    `a Dewey Decimal classification. Respond ONLY with valid JSON — no markdown, no extra keys.`;

  const userPrompt =
    `The following text was OCR-extracted from a book cover or spine. The book may be in any language.\n\n` +
    `OCR Text:\n${ocrText}\n\n` +
    `Extract the following and return as JSON:\n` +
    `- "title" (string or null): the book title\n` +
    `- "author" (string or null): the author name(s)\n` +
    `- "language" (string or null): the detected language (e.g. "English", "Spanish", "Arabic", "Japanese")\n` +
    `- "subjects" (string[]): subject categories\n` +
    `- "dewey_class" (string or null): suggested Dewey Decimal classification\n` +
    `- "confidence_score" (integer 0-100): how confident you are in this classification\n` +
    `- "reasoning" (string): brief explanation`;

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
      title: parsed.title ?? null,
      author: parsed.author ?? null,
      language: parsed.language ?? null,
      subjects: Array.isArray(parsed.subjects) ? parsed.subjects : [],
      dewey_class: parsed.dewey_class ?? null,
      confidence_score:
        typeof parsed.confidence_score === 'number'
          ? Math.min(100, Math.max(0, Math.round(parsed.confidence_score)))
          : 0,
      reasoning: parsed.reasoning ?? null,
    };
  } catch (err: any) {
    console.error('[ingest] OpenAI OCR metadata error:', err.message);
    return {
      title: null,
      author: null,
      language: null,
      subjects: [],
      dewey_class: null,
      confidence_score: 0,
      reasoning: `LLM error: ${err.message}`,
    };
  }
}

// ---------------------------------------------------------------------------
// 6. IngestionJob management
// ---------------------------------------------------------------------------

export async function createIngestionJob(
  organizationId: string,
  data: {
    imageUrl: string;
    status: IngestionStatus;
    ocrText: string | null;
    detectedIsbn: string | null;
    suggestedDewey: string | null;
    confidenceScore: number;
    suggestedTitle: string | null;
    suggestedAuthor: string | null;
    suggestedPublisher: string | null;
    suggestedPublishDate: string | null;
    suggestedGenre: string | null;
    coverImageUrl: string | null;
    metadataSource: string | null;
    deweyReasoning: string | null;
    language: string | null;
  },
) {
  const db = forOrg(organizationId);
  return db.ingestionJob.create({ data: data as any });
}

export async function listIngestionJobs(
  organizationId: string,
  filters: {
    status?: IngestionStatus;
    page?: number;
    limit?: number;
  },
) {
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 20;
  const skip = (page - 1) * limit;
  const db = forOrg(organizationId);

  const where = filters.status ? { status: filters.status } : {};

  const [jobs, total] = await Promise.all([
    db.ingestionJob.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    db.ingestionJob.count({ where }),
  ]);

  return { jobs, total, page, limit };
}

export async function getIngestionJobById(organizationId: string, id: string) {
  const db = forOrg(organizationId);
  const job = await db.ingestionJob.findFirst({ where: { id } });
  if (!job) {
    throw new AppError(404, 'NOT_FOUND', `Ingestion job ${id} not found.`);
  }
  return job;
}

export async function approveIngestionJob(
  organizationId: string,
  id: string,
  overrides: {
    title: string;
    author: string;
    isbn: string;
    genre?: string;
    deweyDecimal?: string;
    coverImageUrl?: string;
    publishYear?: string;
    language?: string;
    copies?: number;
  },
  reviewedBy: string,
) {
  const db = forOrg(organizationId);
  const job = await db.ingestionJob.findFirst({ where: { id } });
  if (!job) {
    throw new AppError(404, 'NOT_FOUND', `Ingestion job ${id} not found.`);
  }
  if (job.status !== 'COMPLETED') {
    throw new AppError(
      400,
      'INVALID_STATUS',
      `Job must be in COMPLETED status to approve. Current: ${job.status}`,
    );
  }

  const requestedCopies = Number(overrides.copies);
  const copiesCount = Number.isFinite(requestedCopies)
    ? Math.max(0, Math.min(1000, Math.trunc(requestedCopies)))
    : 1;
  const cleanIsbn = String(overrides.isbn).replace(/-/g, '');

  const result = await db.$transaction(async (tx) => {
    const book = await tx.book.create({
      data: {
        title: overrides.title,
        author: overrides.author,
        isbn: overrides.isbn,
        genre: overrides.genre || null,
        deweyDecimal: overrides.deweyDecimal || null,
        language: overrides.language || job.language || 'English',
        coverImageUrl: overrides.coverImageUrl || null,
        publishYear: overrides.publishYear || null,
        copies:
          copiesCount > 0
            ? {
                create: Array.from({ length: copiesCount }, (_, i) => ({
                  barcode: `${cleanIsbn}-${i + 1}`,
                  status: 'AVAILABLE',
                  organizationId,
                })),
              }
            : undefined,
      } as any,
    });

    const updatedJob = await tx.ingestionJob.update({
      where: { id },
      data: {
        status: 'APPROVED',
        reviewedBy,
        reviewedAt: new Date(),
        createdBookId: book.id,
      },
    });

    return { job: updatedJob, book };
  });

  return result;
}

export async function rejectIngestionJob(organizationId: string, id: string, reviewedBy: string) {
  const db = forOrg(organizationId);
  const job = await db.ingestionJob.findFirst({ where: { id } });
  if (!job) {
    throw new AppError(404, 'NOT_FOUND', `Ingestion job ${id} not found.`);
  }
  if (job.status !== 'COMPLETED') {
    throw new AppError(
      400,
      'INVALID_STATUS',
      `Job must be in COMPLETED status to reject. Current: ${job.status}`,
    );
  }

  return db.ingestionJob.update({
    where: { id },
    data: {
      status: 'REJECTED',
      reviewedBy,
      reviewedAt: new Date(),
    },
  });
}
