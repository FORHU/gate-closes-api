# --------------------
# Build stage
# --------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json yarn.lock ./

# Install dependencies using Yarn
RUN yarn install --frozen-lockfile

# Copy TypeScript config and source code
COPY tsconfig.json ./
COPY src ./src
COPY types ./types

# Build TypeScript
RUN yarn build

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
