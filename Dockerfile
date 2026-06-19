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
# next.config.ts lo lee `next start` en RUNTIME (no es build standalone). Sin él,
# Next cae a los defaults — entre ellos middlewareClientMaxBodySize=10MB, lo que
# truncaba la subida de varias facturas. Hay que incluirlo en la imagen final.
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src ./src

COPY docker/entrypoint.sh /entrypoint.sh
# Normalizar a LF + marcar ejecutable. En checkouts de Windows (core.autocrlf=true)
# el script puede quedar con CRLF, lo que rompe el shebang dentro del contenedor
# ("exec /entrypoint.sh: no such file or directory"). El sed lo hace inmune.
RUN sed -i 's/\r$//' /entrypoint.sh && chmod +x /entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["/entrypoint.sh"]
