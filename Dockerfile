FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/* \
  && npm ci

FROM node:20-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/* \
  && npx prisma generate
RUN npm run build

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src ./src
# next.config debe estar en runtime: `next start` lo lee del disco para aplicar
# límites como proxyClientMaxBodySize (subida del Excel del padrón). Sin él, cae al default de 10MB.
COPY --from=builder /app/next.config.ts ./next.config.ts

COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["/entrypoint.sh"]
