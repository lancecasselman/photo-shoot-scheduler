import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "../shared/schema.js";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,  // Increased timeout
  allowExitOnIdle: true            // Allow process to exit when idle
});

// Monitor pool connections
pool.on('connect', () => {
  console.log('Database client connected');
});

pool.on('acquire', () => {
  console.log('Database client acquired from pool');
});

pool.on('remove', () => {
  console.log('Database client removed from pool');
});

pool.on('error', (err, client) => {
    console.error('Unexpected database pool error:', err);
    console.log('Database client removed from pool');

    // Attempt to reconnect after a brief delay
    setTimeout(() => {
      console.log('Attempting to reconnect to database...');
      try {
        pool.connect();
      } catch (reconnectErr) {
        console.error('Database reconnection failed:', reconnectErr);
      }
    }, 5000);
  });

export const db = drizzle({ client: pool, schema });