/**
 * AWS Lambda handler – triggered by SQS when a new image lands in S3.
 *
 * This file is designed to be deployed as a standalone Lambda function.
 * It runs the same Textract → ISBN → Dewey pipeline that the synchronous
 * Express endpoint uses, but asynchronously via the SQS queue.
 *
 * Deployment: bundle this file (and its dependencies) separately from the
 * Express server, e.g. with `esbuild` or `sam build`.
 */

import {
  TextractClient,
  DetectDocumentTextCommand,
} from '@aws-sdk/client-textract';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import type { SQSEvent, SQSRecord } from 'aws-lambda';

import {
  detectIsbn,
  enrichMetadata,
  classifyDeweyDecimal,
} from '../services/ingest.service';

const awsRegion = process.env.AWS_REGION || 'us-east-1';
const s3 = new S3Client({ region: awsRegion });
const textract = new TextractClient({ region: awsRegion });

// ---------------------------------------------------------------------------
// Helper: stream → Buffer
// ---------------------------------------------------------------------------
async function streamToBuffer(stream: any): Promise<Buffer> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

// ---------------------------------------------------------------------------
// Lambda entry point
// ---------------------------------------------------------------------------
export async function handler(event: SQSEvent): Promise<void> {
  for (const record of event.Records) {
    await processRecord(record);
  }
}

async function processRecord(record: SQSRecord): Promise<void> {
  const body = JSON.parse(record.body) as {
    action: string;
    s3Bucket: string;
    s3Key: string;
    s3Url: string;
    originalName: string;
    mimeType: string;
  };

  if (body.action !== 'INGEST_ANALYZE') {
    console.log('[lambda] Ignoring unrecognised action:', body.action);
    return;
  }

  console.log('[lambda] Processing', body.s3Key);

  // 1. Fetch the image from S3
  const s3Obj = await s3.send(
    new GetObjectCommand({ Bucket: body.s3Bucket, Key: body.s3Key }),
  );
  const imageBuffer = await streamToBuffer(s3Obj.Body);

  // 2. OCR via Textract
  const textractRes = await textract.send(
    new DetectDocumentTextCommand({ Document: { Bytes: imageBuffer } }),
  );
  const ocrText =
    textractRes.Blocks?.filter((b) => b.BlockType === 'LINE')
      .map((b) => b.Text ?? '')
      .join('\n') ?? '';

  // 3. ISBN detection + metadata enrichment
  const isbn = detectIsbn(ocrText);
  const metadata = isbn
    ? await enrichMetadata(isbn)
    : {
        isbn: null,
        title: null,
        author: null,
        publisher: null,
        publishDate: null,
        coverImageUrl: null,
        subjects: [],
        source: null,
      };

  // 4. Dewey classification via LLM
  const dewey = await classifyDeweyDecimal(ocrText, metadata);

  // 5. Results – in a full implementation you would persist these to the
  //    database or push to another queue / webhook so the front-end can
  //    retrieve them.
  const result = {
    s3Url: body.s3Url,
    ocr: { rawText: ocrText, characterCount: ocrText.length },
    isbn: { detected: isbn, metadata },
    classification: {
      dewey_class: dewey.dewey_class,
      confidence_score: dewey.confidence_score,
      reasoning: dewey.reasoning,
    },
  };

  console.log('[lambda] Result:', JSON.stringify(result, null, 2));

  // TODO: persist result to the database (Prisma) or notify the client
  //       via WebSocket / callback URL.
}
