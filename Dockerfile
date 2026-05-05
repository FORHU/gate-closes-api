# --------------------
# Build stage
# --------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json yarn.lock ./

# Install all dependencies (including devDependencies needed for types)
RUN yarn install --frozen-lockfile --production=false

# Copy TypeScript config and source code
COPY tsconfig.json ./
COPY src ./src
COPY types ./types

# Build TypeScript
RUN yarn build

# Prune devDependencies before moving to production stage
RUN yarn install --frozen-lockfile --production=true

# --------------------
# Production stage
# --------------------
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy built output, dependencies, and type declarations from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/types ./types

EXPOSE 3001

# Start the app
CMD ["node", "./dist/server.js"]
