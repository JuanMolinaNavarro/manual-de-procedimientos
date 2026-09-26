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
# .next a nombre de `node`: `next start` escribe su cache ahí (el proceso no corre como root).
COPY --from=builder --chown=node:node /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
# next.config debe estar en runtime: `next start` lo lee del disco para aplicar
# límites como proxyClientMaxBodySize (subida del Excel del padrón). Sin él, cae al default de 10MB.
COPY --from=builder /app/next.config.ts ./next.config.ts

COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 3000
# El entrypoint arranca como root solo para ajustar el dueño del volumen de uploads y se baja a `node`.
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3   CMD node -e "fetch('http://127.0.0.1:3000/login').then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/entrypoint.sh"]
