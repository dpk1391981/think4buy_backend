import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import * as helmet from 'helmet';
import * as compression from 'compression';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // rawBody=true is required for Stripe/Razorpay webhook signature verification
    // NestJS stores the raw buffer on req.rawBody before body-parser processes it
    rawBody: true,
    // Suppress internal NestJS logger in production; use our interceptor instead
    logger: process.env.NODE_ENV === 'production'
      ? ['error', 'warn']
      : ['log', 'debug', 'error', 'warn', 'verbose'],
  });

  // ── Cookie parser (required for HTTP-only refresh token) ─────────────────
  app.use(cookieParser());

  // ── Compression (gzip) ───────────────────────────────────────────────────
  app.use(compression());

  // ── Helmet — comprehensive HTTP security headers ─────────────────────────
  app.use(
    (helmet as any).default({
      // Content-Security-Policy
      contentSecurityPolicy: {
        directives: {
          defaultSrc:     ["'self'"],
          scriptSrc:      ["'self'"],
          styleSrc:       ["'self'", "'unsafe-inline'"],
          imgSrc:         ["'self'", 'data:', 'https:'],
          connectSrc:     ["'self'"],
          fontSrc:        ["'self'"],
          objectSrc:      ["'none'"],
          mediaSrc:       ["'self'"],
          frameSrc:       ["'none'"],
          upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
        },
      },
      // HTTP Strict Transport Security (1 year in production)
      hsts: process.env.NODE_ENV === 'production'
        ? { maxAge: 31_536_000, includeSubDomains: true, preload: true }
        : false,
      // Prevent MIME sniffing
      noSniff: true,
      // Prevent clickjacking
      frameguard: { action: 'deny' },
      // Hide "X-Powered-By: Express"
      hidePoweredBy: true,
      // XSS protection for older browsers
      xssFilter: true,
      // Referrer policy
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      // Permission policy
      permittedCrossDomainPolicies: false,
    }),
  );

  // ── Global Validation Pipe ───────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist:           true,  // strip unknown properties
      forbidNonWhitelisted: false,
      transform:            true,  // auto-transform to DTO classes
      transformOptions:     { enableImplicitConversion: true },
    }),
  );

  // ── Global Exception Filter ──────────────────────────────────────────────
  app.useGlobalFilters(new GlobalExceptionFilter());

  // ── Global Interceptors ──────────────────────────────────────────────────
  // TransformInterceptor is NOT registered globally — it would double-wrap all
  // existing controller responses and break frontend API consumers.
  // Apply @UseInterceptors(TransformInterceptor) only on new endpoints
  // that are explicitly designed for the { success, data, timestamp } envelope.
  app.useGlobalInterceptors(new LoggingInterceptor());

  // Global guards (ThrottlerGuard + RolesGuard) are registered via APP_GUARD
  // in app.module.ts so they participate fully in NestJS DI.

  // ── CORS ─────────────────────────────────────────────────────────────────
  const allowedOrigins = (process.env.FRONTEND_URL ?? 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim());

  // Vercel preview deployments: any subdomain of vercel.app whose hostname
  // contains the project identifier from VERCEL_PROJECT_ID env var, or all
  // *.vercel.app origins when ALLOW_VERCEL_PREVIEWS=true.
  const vercelProjectId = process.env.VERCEL_PROJECT_ID ?? '';
  const allowVercelPreviews = process.env.ALLOW_VERCEL_PREVIEWS === 'true';

  app.enableCors({
    origin: (origin, cb) => {
      // Allow requests with no origin (mobile apps, server-to-server)
      if (!origin) return cb(null, true);
      // Exact match against configured origins
      if (allowedOrigins.some((o) => o === origin)) return cb(null, true);
      // Vercel preview URLs: *.vercel.app
      if (origin.endsWith('.vercel.app')) {
        if (allowVercelPreviews) return cb(null, true);
        if (vercelProjectId && origin.includes(vercelProjectId)) return cb(null, true);
      }
      cb(new Error(`CORS: origin ${origin} not allowed`));
    },
    methods:          ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders:   ['Content-Type', 'Authorization', 'X-Request-ID', 'X-API-KEY', 'X-SIGNATURE', 'X-TIMESTAMP'],
    exposedHeaders:   ['X-Request-ID'],
    credentials:       true,
    maxAge:            86_400, // preflight cache 24h
  });

  // ── Static Assets ────────────────────────────────────────────────────────
  // Use process.cwd() so this resolves correctly regardless of dist structure
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads',
    // Cache static files for 1 day
    setHeaders: (res) => {
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.setHeader('X-Content-Type-Options', 'nosniff');
    },
  });

  // ── API prefix ────────────────────────────────────────────────────────────
  app.setGlobalPrefix('api/v1');

  // ── Swagger — disabled in production ─────────────────────────────────────
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Think4BuySale API')
      .setDescription('Real Estate Platform API')
      .setVersion('1.0')
      .addBearerAuth()
      .addCookieAuth('rt')
      .addTag('auth', 'Authentication')
      .addTag('properties', 'Property Listings')
      .addTag('users', 'User Management')
      .addTag('locations', 'Location Data')
      .addTag('inquiries', 'Property Inquiries')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  const port = process.env.PORT || 3001;
  // In production, bind to loopback or VPC internal IP only.
  // Set BIND_HOST=0.0.0.0 only for local dev / docker networking.
  // On VPS: set BIND_HOST=127.0.0.1 so backend is unreachable from public internet.
  const bindHost = process.env.BIND_HOST ?? (process.env.NODE_ENV === 'production' ? '127.0.0.1' : '0.0.0.0');
  await app.listen(port, bindHost);
  console.log(`Backend running on: http://${bindHost}:${port}`);
  if (process.env.NODE_ENV !== 'production') {
    console.log(`API Docs: http://${bindHost}:${port}/api/docs`);
  }
}

bootstrap();
