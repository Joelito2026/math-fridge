# Math Fridge frontend

This directory contains the Expo SDK 57 client for Math Fridge. Start here only after PostgreSQL and the FastAPI backend are running.

```bash
npm install
cp .env.example .env
npx expo start
```

Tests remain outside `app/` so Expo Router never interprets them as routes:

```bash
npm test -- --verbose
npm run test:coverage
```

For the complete multi-terminal setup, environment variables, Android networking, and OAuth configuration, see the repository's [Setup and Deployment Guide](../docs/SETUP.md). The portfolio overview is in the [root README](../README.md).
