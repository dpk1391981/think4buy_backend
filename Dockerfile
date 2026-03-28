FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app

# Install ffmpeg for async video transcoding (video-processing worker)
RUN apk add --no-cache ffmpeg

COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/dist ./dist
RUN mkdir -p uploads/properties uploads/tmp

# Non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup \
    && chown -R appuser:appgroup /app
USER appuser

EXPOSE 3001

# Graceful shutdown
STOPSIGNAL SIGTERM

CMD ["node", "dist/main"]
