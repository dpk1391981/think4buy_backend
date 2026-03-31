import { BadRequestException } from '@nestjs/common';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { memoryStorage, diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

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
 * Multer configuration for spreadsheet uploads (.xlsx / .xls / .csv).
 * Uses diskStorage so large files are written directly to disk.
 * Destination: uploads/location-imports/
 */
export function spreadsheetMulterOptions(): MulterOptions {
  const dest = path.resolve(process.cwd(), 'uploads', 'location-imports');

  return {
    storage: diskStorage({
      destination(_req, _file, cb) {
        fs.mkdirSync(dest, { recursive: true });
        cb(null, dest);
      },
      filename(_req, file, cb) {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `${uuidv4()}${ext}`);
      },
    }),
    limits: {
      fileSize: 50 * 1024 * 1024, // 50 MB
      files: 1,
    },
    fileFilter(_req, file, cb) {
      const ext = path.extname(file.originalname).toLowerCase();
      const allowedExts = new Set(['.xlsx', '.xls', '.csv']);

      if (!allowedExts.has(ext)) {
        return cb(
          new BadRequestException(`Only .xlsx, .xls, and .csv files are accepted (got "${ext}")`),
          false,
        );
      }

      // Accept broad MIME set because CSV MIME varies across OS / browsers
      const allowedMimes = new Set([
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'text/csv',
        'text/plain',
        'application/csv',
        'application/octet-stream',
      ]);

      if (!allowedMimes.has(file.mimetype)) {
        return cb(
          new BadRequestException(`MIME type "${file.mimetype}" is not accepted for spreadsheets`),
          false,
        );
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
