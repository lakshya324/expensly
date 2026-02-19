// Server Entry Point
import 'dotenv/config';
import http from 'http';
import mongoose from 'mongoose';
import { createApp } from './app.js';
import { initWS } from './websocket/wsServer.js';
import { config } from './config/env.js';
import { User } from './models/index.js';
import { ROLES } from './config/constants.js';
import { hashPassword } from './services/auth.service.js';

async function bootstrap(): Promise<void> {
  // ── MongoDB ───────────────────────────────────────────────────────────────
  await mongoose.connect(config.mongodbUri);
  console.log('[MongoDB] Connected');

  // ── Seed Super Admin ──────────────────────────────────────────────────────
  if (config.superAdminEmail && config.superAdminPassword) {
    const existing = await User.findOne({ email: config.superAdminEmail });
    if (!existing) {
      const passwordHash = await hashPassword(config.superAdminPassword);
      await User.create({
        name: 'Super Admin',
        email: config.superAdminEmail,
        passwordHash,
        role: ROLES.SUPER_ADMIN,
        orgId: null,
      });
      console.log('[Seed] Super admin created');
    }
  }

  // ── HTTP Server ───────────────────────────────────────────────────────────
  const app = createApp();
  const server = http.createServer(app);

  // ── WebSocket Server ──────────────────────────────────────────────────────
  initWS(server);

  // ── Listen ────────────────────────────────────────────────────────────────
  server.listen(config.port, () => {
    console.log(`\x1b[36m[HTTP] Server listening on port ${config.port}\x1b[0m`);
    console.log(`\x1b[36m[WS]   WebSocket ready on ws://localhost:${config.port}\x1b[0m`);
    console.log(`\x1b[36m[ENV]  ${config.nodeEnv}\x1b[0m`);
  });
}

bootstrap().catch((err: unknown) => {
  console.error('[FATAL] Failed to start server:', err);
  process.exit(1);
});
