# API image: Node + Prisma + headless Chromium for PDF rendering.
# Build from the repo root:  docker build -f apps/api/Dockerfile -t solar-epc-api .
FROM node:22-bookworm-slim

ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    NODE_ENV=production \
    PORT=4000

RUN corepack enable && apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install workspace dependencies for the API and the packages it uses.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY packages/core/package.json packages/core/
COPY packages/pdf/package.json packages/pdf/
RUN pnpm install --frozen-lockfile --filter @solar-epc/api... --prod=false

# Chromium (headless shell) plus the system libraries and fonts it needs, matching the playwright-core version.
RUN cd apps/api && pnpm exec playwright-core install --with-deps --only-shell chromium \
    && apt-get install -y --no-install-recommends fonts-noto-core && rm -rf /var/lib/apt/lists/*

COPY packages packages
COPY apps/api apps/api
RUN cd apps/api && pnpm exec prisma generate

WORKDIR /app/apps/api
EXPOSE 4000
# Applies pending migrations, then starts the server.
CMD ["pnpm", "start:prod"]
