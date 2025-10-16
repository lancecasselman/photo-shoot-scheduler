import { neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "../shared/schema.js";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

console.log('🔗 Database: Using DATABASE_URL from environment (db.ts)');
console.log('📍 REPLIT_DEPLOYMENT:', process.env.REPLIT_DEPLOYMENT ? 'PRODUCTION' : 'DEVELOPMENT');

/**
 * Create a Drizzle ORM instance using a shared database pool
 * NO POOL CREATION - requires pool to be passed in
 */
export function createDb(sharedPool) {
  if (!sharedPool) {
    throw new Error('createDb() requires a shared database pool parameter - no pool creation allowed');
  }
  
  console.log('✅ db.ts: Using shared database pool (no duplicate pool creation)');
  
  return drizzle({ client: sharedPool, schema });
}

// For backward compatibility, export pool and db but they throw errors
export const pool = new Proxy({}, {
  get() {
    throw new Error('DEPRECATED: Do not import pool from db.ts. Use shared pool from server.js');
  }
});

export const db = new Proxy({}, {
  get() {
    throw new Error('DEPRECATED: Do not import db from db.ts. Use createDb(sharedPool) instead');
  }
});
