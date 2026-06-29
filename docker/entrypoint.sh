#!/bin/sh
set -e

if [ -n "$DATABASE_URL" ]; then
  echo "Waiting for database to be ready..."
  tries=0
  if [ ! -d "prisma/migrations" ] || [ -z "$(ls -A prisma/migrations 2>/dev/null)" ]; then
    echo "No migrations found. Applying schema with prisma db push..."
    # --accept-data-loss: en flujo de "db push" sin migraciones, Prisma marca cambios
    # aditivos (p.ej. índices únicos) como posible pérdida y abortaría el arranque.
    until npx prisma db push --accept-data-loss; do
      tries=$((tries + 1))
      if [ "$tries" -ge 15 ]; then
        echo "Database not ready after retries, exiting."
        exit 1
      fi
      echo "DB not ready yet, retrying in 2s..."
      sleep 2
    done
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

npm start -- -H 0.0.0.0 -p 3000
