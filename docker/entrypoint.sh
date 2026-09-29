#!/bin/sh
set -e

# Arranca como root solo para dejar el volumen de uploads a nombre de `node` (los archivos
# viejos quedaron de root) y después se baja a `node` para todo lo demás.
if [ "$(id -u)" = "0" ]; then
  mkdir -p /app/uploads
  chown -R node:node /app/uploads
  exec setpriv --reuid=node --regid=node --init-groups "$0" "$@"
fi

if [ -n "$DATABASE_URL" ]; then
  echo "Waiting for database to be ready..."
  tries=0
  if [ ! -d "prisma/migrations" ] || [ -z "$(ls -A prisma/migrations 2>/dev/null)" ]; then
    # Sin --accept-data-loss: si el schema nuevo borra o cambia columnas con datos, el arranque
    # falla en vez de borrarlos en silencio. Para un deploy donde la pérdida es intencional
    # (revisada), levantar una vez con PRISMA_ACCEPT_DATA_LOSS=1 en el .env y después sacarlo.
    PUSH_FLAGS="--skip-generate"
    if [ "$PRISMA_ACCEPT_DATA_LOSS" = "1" ]; then
      echo "PRISMA_ACCEPT_DATA_LOSS=1: se aceptan cambios destructivos del schema en este arranque."
      PUSH_FLAGS="$PUSH_FLAGS --accept-data-loss"
    fi
    echo "No migrations found. Applying schema with prisma db push..."
    until out=$(npx prisma db push $PUSH_FLAGS 2>&1); do
      echo "$out"
      if echo "$out" | grep -q -- "--accept-data-loss"; then
        echo "*** El schema nuevo borraría datos (ver arriba). No se aplicó nada."
        echo "*** Si es intencional, arrancar UNA vez con PRISMA_ACCEPT_DATA_LOSS=1 en el .env y después sacarlo."
        exit 1
      fi
      tries=$((tries + 1))
      if [ "$tries" -ge 15 ]; then
        echo "Database not ready after retries, exiting."
        exit 1
      fi
      echo "DB not ready yet, retrying in 2s..."
      sleep 2
    done
    echo "$out"
  else
    until npx prisma migrate deploy; do
      tries=$((tries + 1))
      if [ "$tries" -ge 15 ]; then
        echo "Database not ready after retries, exiting."
        exit 1
      fi
      echo "DB not ready yet, retrying in 2s..."
      sleep 2
    done
  fi
fi

# Con argumentos (p. ej. `command:` de app-dev) se corre eso; si no, el server de producción.
if [ "$#" -gt 0 ]; then
  exec "$@"
fi
exec npm start -- -H 0.0.0.0 -p 3000
