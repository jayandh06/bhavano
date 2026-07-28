import { createReadStream, createWriteStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

/** Thin wrapper around R2's S3-compatible API — same code would work unchanged against
 * real AWS S3 later (just different endpoint/credentials), per the plan's storage choice. */
@Injectable()
export class R2StorageService {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(config: ConfigService) {
    const accountId = config.get<string>('R2_ACCOUNT_ID');
    this.bucket = config.get<string>('R2_BUCKET') ?? '';
    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.get<string>('R2_ACCESS_KEY_ID') ?? '',
        secretAccessKey: config.get<string>('R2_SECRET_ACCESS_KEY') ?? '',
      },
    });
  }

  async putObject(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }),
    );
  }

  async getObject(key: string): Promise<Buffer> {
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    const bytes = await result.Body?.transformToByteArray();
    if (!bytes) throw new Error(`Empty object body for key ${key}`);
    return Buffer.from(bytes);
  }

  /** Streams a local file to R2 instead of loading it into a Buffer first — used for video,
   * where holding the whole (up to 200MB) file in memory alongside the SDK's own internal copy
   * would be too much RSS on a 4GB box. ContentLength must be passed explicitly: without it, the
   * AWS SDK falls back to aws-chunked transfer encoding for a stream Body, which R2 rejects. */
  async putObjectStream(key: string, filePath: string, contentType: string): Promise<void> {
    const { size } = await stat(filePath);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: createReadStream(filePath),
        ContentType: contentType,
        ContentLength: size,
      }),
    );
  }

  /** Streams an R2 object straight to a local file instead of buffering it in memory — the video
   * processing worker's counterpart to putObjectStream, for the same reason. */
  async getObjectToFile(key: string, filePath: string): Promise<void> {
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    if (!result.Body) throw new Error(`Empty object body for key ${key}`);
    await pipeline(result.Body as NodeJS.ReadableStream, createWriteStream(filePath));
  }

  /** No-op-safe to call on a key that doesn't exist — callers (video delete) treat a failed
   * delete as harmless given opaque, write-once storage keys (see video-keys.ts). */
  async deleteObject(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
