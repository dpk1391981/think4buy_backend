import { BadRequestException } from '@nestjs/common';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { memoryStorage } from 'multer';
import * as path from 'path';

/** MIME types that are permitted for image upload */
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

/**
 * File extensions that must always be rejected, regardless of MIME type.
 * Prevents polyglot files and server-side execution attacks.
 */
const BLOCKED_EXTENSIONS = new Set([
  '.exe', '.php', '.js', '.ts', '.sh', '.bat',
  '.cmd', '.py', '.rb', '.pl', '.svg', '.html', '.htm', '.xml',
]);

/**
 * Multer configuration for brochure PDF uploads.
 * Accepts a single PDF, max 10 MB.
 */
export function pdfMulterOptions(): MulterOptions {
  return {
    storage: memoryStorage(),
    limits: {
      fileSize: 10 * 1024 * 1024, // 10 MB
      files: 1,
    },
    fileFilter(_req, file, cb) {
      const ext = path.extname(file.originalname).toLowerCase();
      if (ext !== '.pdf') {
        return cb(new BadRequestException('Only PDF files are accepted for brochures'), false);
      }
      if (file.mimetype !== 'application/pdf') {
        return cb(new BadRequestException('MIME type must be application/pdf'), false);
      }
      cb(null, true);
    },
  };
}

/**
 * Returns a Multer configuration that:
 *  - Buffers uploads in memory (no raw files ever touch disk)
 *  - Enforces a 5 MB per-file limit
 *  - Blocks dangerous extensions and non-image MIME types
 *
 * @param maxFiles  Maximum number of files accepted in a single request (default 20)
 */
export function imageMulterOptions(maxFiles = 20): MulterOptions {
  return {
    storage: memoryStorage(),
    limits: {
      fileSize: 5 * 1024 * 1024, // 5 MB
      files: maxFiles,
    },
    fileFilter(_req, file, cb) {
      const ext = path.extname(file.originalname).toLowerCase();

      if (BLOCKED_EXTENSIONS.has(ext)) {
        return cb(
          new BadRequestException(`File extension "${ext}" is not permitted`),
          false,
        );
      }

      if (!ALLOWED_MIME.has(file.mimetype)) {
        return cb(
          new BadRequestException(
            `MIME type "${file.mimetype}" is not accepted. ` +
              'Only image/jpeg, image/png, and image/webp are allowed.',
          ),
          false,
        );
      }

      cb(null, true);
    },
  };
}
