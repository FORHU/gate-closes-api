# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* yarn.lock* ./

# Install dependencies (including any native modules)
RUN npm ci

# Copy source and config
COPY tsconfig.json ./
COPY src ./src
COPY types ./types

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy built output, dependencies, and type declarations from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/types ./types

EXPOSE 3001

CMD ["node", "./dist/server.js"]
