import { BadRequestException, Body, Controller, Post, UseGuards, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '../auth/guards/auth.guard';
import { R2StorageService } from '../storage/r2-storage.service';
import { UploadPhotoDto } from './dto/upload-photo.dto';
import { extFromMimeType, originalKey } from './photo-keys';
import { computeDHash } from './photo-hash';
import { imageFileInterceptorOptions } from './photo-upload.config';

@Controller('uploads')
export class UploadsController {
  constructor(private readonly storage: R2StorageService) {}

  @Post()
  @UseGuards(AuthGuard)
  @UseInterceptors(FileInterceptor('file', imageFileInterceptorOptions()))
  async upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: UploadPhotoDto,
  ): Promise<{ hash: string; ext: string }> {
    if (!file) throw new BadRequestException('No file uploaded');

    const hash = await computeDHash(file.buffer);
    const ext = extFromMimeType(file.mimetype);
    await this.storage.putObject(originalKey(dto.listingId, dto.photoNo, ext), file.buffer, file.mimetype);

    // Resized variants are generated asynchronously once the listing is actually created
    // (ListingsService.create() enqueues the PhotoVariantJob rows) — not here, so abandoning
    // the wizard mid-upload never wastes worker cycles on a listing that's never posted.
    return { hash, ext };
  }
}
