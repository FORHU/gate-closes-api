# gate-closes-api

Backend API for the Gate Closes application.

## Tech stack

- Node.js + TypeScript
- Express
- MongoDB
- Redis
- Socket.IO
- Docker

## Prerequisites

Install the following on your machine:

- Node.js 20.x (recommended)
- npm (bundled with Node.js)
- yarn
- Docker Desktop (optional but recommended for MongoDB and Redis)
- Git

## Getting started

### 1) Clone the repository

```bash
git clone <your-repo-url>
cd gate-closes-api
```

### 2) Install dependencies

Use one package manager only.

With npm:

```bash
npm install
```

With Yarn:

```bash
yarn install
```

If `yarn` is not recognized on Windows:

```bash
npm install -g yarn
```
### 3) Configure environment variables

Create a `.env` file in the project root:

```env
NODE_ENV=development
PORT=3001

MONGO_URI=mongodb://localhost:27017
MONGO_DB=gate-closes
MONGO_DB_DEV=gate-closes-dev

REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

SECRET_KEY=dev-secret
ACCESS_TOKEN_SECRET=dev-access-secret
REFRESH_TOKEN_SECRET=dev-refresh-secret
ACCESS_TOKEN_EXPIRY=7d
REFRESH_TOKEN_EXPIRY=30d

MAILER_TRANSPORT_HOST=smtp.example.com
MAILER_TRANSPORT_PORT=587
MAILER_TRANSPORT_SECURE=false
MAILER_EMAIL=example@example.com
MAILER_PASSWORD=example-password

SERVICE_ACCOUNT=
GOOGLE_CLIENT_ID=

AWS_ACCESS_KEY=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET=
AWS_REGION=
CLOUD_FRONT_DOMAIN=
```

## Running dependencies (MongoDB and Redis)

This repo includes a `docker-compose.yml` that can start MongoDB and Redis for local development.

Start services:

```bash
docker compose build
docker compose up -d
docker compose up
```

Stop services:

```bash
docker compose down
```

By default, the server runs on:

- `http://localhost:3001`

## Available scripts

- `dev` - run with nodemon + ts-node
- `build` - compile TypeScript to `dist`
- `start` - run compiled build
- `lint` - lint and auto-fix files in `src/**/*.ts`
- `test` - run mocha tests
- `backfill:ps-latest-events` - backfill conversation latest event data

Examples:

```bash
npm run lint
npm test
```

### Cannot connect to MongoDB or Redis

- Verify containers are running: `docker compose ps`
- Ensure your `.env` values match your runtime:
  - local host setup: `localhost`
  - Docker network setup: service names (`mongodb`, `redis`) as needed

### Port already in use

- Change `PORT` in `.env`
- Restart the app

## Project structure (high level)

- `src/server.ts` - app entry point
- `src/app.ts` - Express app and middleware setup
- `src/routes` - API routes
- `src/controllers` - request handlers
- `src/services` - business logic
- `src/repositories` - data access layer
- `src/utils` - utilities (Mongo, Redis, mailer, etc.)

## Notes

- Keep secrets in `.env`; do not commit real credentials.
- For production, use strong values for token secrets and keys.
