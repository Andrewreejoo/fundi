import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { diskStorage } from 'multer';
import { AuthUser, CurrentUser, Public } from '../common/auth';
import { config } from '../config';
import { DbService } from '../db/db.service';

const ALLOWED = new Set([
  'image/jpeg', 'image/png', 'image/webp',
  'audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/webm', 'audio/wav',
]);

fs.mkdirSync(config.uploadDir, { recursive: true });

/**
 * Uploads land on local disk under UPLOAD_DIR. Clients resize images before upload (max 1280 px).
 * Swap diskStorage for an S3-compatible store in production; the files table keeps the same shape.
 */
@Controller()
export class FilesController {
  constructor(private readonly db: DbService) {}

  @Post('uploads')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: config.uploadDir,
        filename: (_req, file, cb) => cb(null, `${randomUUID()}${path.extname(file.originalname).toLowerCase().slice(0, 6)}`),
      }),
      limits: { fileSize: config.maxUploadMb * 1024 * 1024 },
      fileFilter: (_req, file, cb) =>
        ALLOWED.has(file.mimetype) ? cb(null, true) : cb(new BadRequestException('Only photos (JPG, PNG, WebP) and voice notes are allowed'), false),
    }),
  )
  async upload(@CurrentUser() user: AuthUser, @UploadedFile() file: Express.Multer.File, @Query('private') priv?: string) {
    if (!file) throw new BadRequestException('Attach a file in the "file" field');
    const row = await this.db.one(
      `INSERT INTO files (owner_id, mime, size_bytes, path, private) VALUES ($1,$2,$3,$4,$5) RETURNING id, mime, size_bytes, private`,
      [user.id, file.mimetype, file.size, path.basename(file.path), priv === 'true'],
    );
    return { ...row, url: `${config.publicApiUrl}/files/${row.id}` };
  }

  /** Public files are open; private ones (ID documents, selfies) only to their owner and admins. */
  @Public() @Get('files/:id')
  async get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser | undefined, @Res() res: Response) {
    const f = await this.db.one<{ path: string; mime: string; private: boolean; owner_id: string }>(
      'SELECT path, mime, private, owner_id FROM files WHERE id=$1',
      [id],
    );
    if (!f) throw new NotFoundException();
    if (f.private && !(user && (user.id === f.owner_id || user.roles.includes('admin')))) throw new ForbiddenException();
    const full = path.join(config.uploadDir, f.path);
    if (!fs.existsSync(full)) throw new NotFoundException();
    res.setHeader('Content-Type', f.mime);
    res.setHeader('Cache-Control', f.private ? 'private, no-store' : 'public, max-age=604800, immutable');
    fs.createReadStream(full).pipe(res);
  }
}
