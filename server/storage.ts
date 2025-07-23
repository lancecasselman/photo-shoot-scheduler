import {
  users,
  photographySessions,
  type User,
  type UpsertUser,
  type PhotographySession,
  type InsertPhotographySession,
} from "../shared/schema";
import { db } from "./db";
import { eq, and } from "drizzle-orm";

// Interface for storage operations
export interface IStorage {
  // User operations
  // (IMPORTANT) these user operations are mandatory for Replit Auth.
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Photography session operations
  getSessionById(sessionId: string, userId?: string): Promise<PhotographySession | undefined>;
  getSessionsByUser(userId: string): Promise<PhotographySession[]>;
  createSession(session: InsertPhotographySession): Promise<PhotographySession>;
  updateSession(sessionId: string, updates: Partial<PhotographySession>, userId?: string): Promise<PhotographySession | undefined>;
  deleteSession(sessionId: string, userId?: string): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  // (IMPORTANT) these user operations are mandatory for Replit Auth.

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Photography session operations
  async getSessionById(sessionId: string, userId?: string): Promise<PhotographySession | undefined> {
    const conditions = userId 
      ? and(eq(photographySessions.id, sessionId), eq(photographySessions.userId, userId))
      : eq(photographySessions.id, sessionId);
    
    const [session] = await db.select().from(photographySessions).where(conditions);
    return session;
  }

  async getSessionsByUser(userId: string): Promise<PhotographySession[]> {
    return await db.select().from(photographySessions).where(eq(photographySessions.userId, userId));
  }

  async createSession(session: InsertPhotographySession): Promise<PhotographySession> {
    const [newSession] = await db.insert(photographySessions).values(session).returning();
    return newSession;
  }

  async updateSession(sessionId: string, updates: Partial<PhotographySession>, userId?: string): Promise<PhotographySession | undefined> {
    const conditions = userId 
      ? and(eq(photographySessions.id, sessionId), eq(photographySessions.userId, userId))
      : eq(photographySessions.id, sessionId);
    
    const [updatedSession] = await db
      .update(photographySessions)
      .set({ ...updates, updatedAt: new Date() })
      .where(conditions)
      .returning();
    
    return updatedSession;
  }

  async deleteSession(sessionId: string, userId?: string): Promise<boolean> {
    const conditions = userId 
      ? and(eq(photographySessions.id, sessionId), eq(photographySessions.userId, userId))
      : eq(photographySessions.id, sessionId);
    
    const result = await db.delete(photographySessions).where(conditions);
    return (result.rowCount || 0) > 0;
  }
}

export const storage = new DatabaseStorage();