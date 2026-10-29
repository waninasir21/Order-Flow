# Backend image. Build context is the REPOSITORY ROOT (npm workspaces share one lockfile):
#   docker build -f apps/backend/Dockerfile -t orderflow-backend .
FROM node:22-bookworm-slim

# Prisma's query engine needs OpenSSL; the slim image doesn't ship it.
RUN apt-get update -y \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
RUN chown node:node /app
USER node
COPY --chown=node:node . .

# Install only the backend workspace's dependencies (skips Expo, Next and the rest).
# --ignore-scripts: the root `prepare` script installs git hooks, which is meaningless here.
RUN npm ci -w @orderflow/backend --ignore-scripts \
 && npm run prisma:generate -w @orderflow/backend \
 && npm run build -w @orderflow/backend

ENV NODE_ENV=production
EXPOSE 4000

# Apply pending migrations, then start. `migrate deploy` only applies committed migrations (it never
# creates or resets anything), so it is safe to run on every start. If it fails, the container
# exits and the host keeps the previous version running. PORT is set by the host.
CMD ["sh", "-c", "npx prisma migrate deploy --schema apps/backend/prisma/schema.prisma && node apps/backend/dist/src/index.js"]
