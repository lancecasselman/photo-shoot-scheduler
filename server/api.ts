import { db } from './db';
import { users, sessions, photographySessions, photographerClients } from '../shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import type { User, UpsertUser, PhotographySession, InsertPhotographySession } from '../shared/schema';

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User>;
  
  getSessions(): Promise<PhotographySession[]>;
  getSession(id: string): Promise<PhotographySession | undefined>;
  createSession(insertSession: InsertPhotographySession): Promise<PhotographySession>;
  updateSession(id: string, updates: Partial<PhotographySession>): Promise<PhotographySession>;
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

  async upsertUser(user: UpsertUser): Promise<User> {
    // Normalize user ID for specific admin emails
    const adminEmails = [
      'lancecasselman2011@gmail.com',
      'lancecasselman@icloud.com', 
      'lance@thelegacyphotography.com'
    ];
    
    let normalizedUserId = user.id;
    if (user.email && adminEmails.includes(user.email.toLowerCase())) {
      normalizedUserId = '44735007'; // Normalize Lance's accounts to single ID
    }

    const existingUser = await this.getUser(normalizedUserId);
    
    if (existingUser) {
      // Update existing user
      return this.updateUser(normalizedUserId, {
        ...user,
        id: normalizedUserId,
        updatedAt: new Date()
      });
    } else {
      // Create new user
      const [newUser] = await db
        .insert(users)
        .values({
          ...user,
          id: normalizedUserId,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();
      return newUser;
    }
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async getSessions(): Promise<PhotographySession[]> {
    return await db.select().from(photographySessions);
  }

  async getSession(id: string): Promise<PhotographySession | undefined> {
    const [session] = await db.select().from(photographySessions).where(eq(photographySessions.id, id));
    return session || undefined;
  }

  async createSession(insertSession: InsertPhotographySession): Promise<PhotographySession> {
    // First create the session
    const [session] = await db
      .insert(photographySessions)
      .values(insertSession)
      .returning();
    
    // Automatically add client to the database if they don't exist
    if (session.clientName && session.userId) {
      try {
        // Check if client already exists for this photographer
        const existingClient = await db
          .select()
          .from(photographerClients)
          .where(
            and(
              eq(photographerClients.photographerId, session.userId),
              eq(photographerClients.clientName, session.clientName),
              session.email ? eq(photographerClients.email, session.email) : sql`true`,
              session.phoneNumber ? eq(photographerClients.phoneNumber, session.phoneNumber) : sql`true`
            )
          )
          .limit(1);
        
        // If client doesn't exist, create them
        if (existingClient.length === 0) {
          await db.insert(photographerClients).values({
            id: crypto.randomUUID(),
            photographerId: session.userId,
            clientName: session.clientName,
            email: session.email || null,
            phoneNumber: session.phoneNumber || null,
            notes: `Automatically added from ${session.sessionType} session`,
            source: 'Session Creation',
            createdAt: new Date(),
            updatedAt: new Date()
          });
          console.log(`✅ Automatically added client ${session.clientName} to database`);
        }
      } catch (error) {
        console.error('Error adding client automatically:', error);
        // Don't fail the session creation if client creation fails
      }
    }
    
    return session;
  }

  async updateSession(id: string, updates: Partial<PhotographySession>): Promise<PhotographySession> {
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