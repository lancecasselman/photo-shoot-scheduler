import { db } from './db';
import { users, photographySessions } from '../shared/schema';
import { eq } from 'drizzle-orm';
import type { User, UpsertUser } from '../shared/schema';

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(insertUser: UpsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User>;
  
  getSessions(): Promise<any[]>;
  getSession(id: string): Promise<any | undefined>;
  createSession(sessionData: any): Promise<any>;
  updateSession(id: string, updates: any): Promise<any>;
  deleteSession(id: string): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async getSessions(): Promise<any[]> {
    return await db.select().from(photographySessions);
  }

  async getSession(id: string): Promise<any | undefined> {
    const [session] = await db.select().from(photographySessions).where(eq(photographySessions.id, id));
    return session || undefined;
  }

  async createSession(sessionData: any): Promise<any> {
    const [session] = await db
      .insert(photographySessions)
      .values(sessionData)
      .returning();
    return session;
  }

  async updateSession(id: string, updates: any): Promise<any> {
    const [session] = await db
      .update(photographySessions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(photographySessions.id, id))
      .returning();
    return session;
  }

  async deleteSession(id: string): Promise<boolean> {
    const result = await db.delete(photographySessions).where(eq(photographySessions.id, id));
    return (result.rowCount ?? 0) > 0;
  }
}

export const storage = new DatabaseStorage();