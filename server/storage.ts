import {
  users,
  photographySessions,
  aiCreditPurchases,
  aiCreditUsage,
  type User,
  type UpsertUser,
  type PhotographySession,
  type InsertPhotographySession,
  type InsertAiCreditPurchase,
  type InsertAiCreditUsage,
} from "../shared/schema";
import { db } from "./db";
import { eq, and, sql } from "drizzle-orm";

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
  
  // AI Credits operations
  getUserAiCredits(userId: string): Promise<number>;
  useAiCredits(userId: string, credits: number, requestType: string, prompt?: string): Promise<boolean>;
  addAiCredits(userId: string, credits: number, priceUsd: number, stripePaymentIntentId?: string): Promise<void>;
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
    return (result.rowCount ?? 0) > 0;
  }

  async updateUserStripeInfo(userId: string, stripeInfo: { stripeCustomerId?: string; stripeSubscriptionId?: string }): Promise<User | undefined> {
    const [updatedUser] = await db
      .update(users)
      .set({ ...stripeInfo, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    
    return updatedUser;
  }

  async updateUserSubscription(userId: string, subscriptionData: { 
    subscriptionStatus?: string; 
    subscriptionPlan?: string; 
    subscriptionExpiresAt?: Date;
  }): Promise<User | undefined> {
    const [updatedUser] = await db
      .update(users)
      .set({ ...subscriptionData, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    
    return updatedUser;
  }

  // AI Credits operations
  async getUserAiCredits(userId: string): Promise<number> {
    const [user] = await db.select({ aiCredits: users.aiCredits }).from(users).where(eq(users.id, userId));
    return user?.aiCredits ?? 0;
  }

  async useAiCredits(userId: string, credits: number, requestType: string, prompt?: string): Promise<boolean> {
    // Start transaction to ensure atomicity
    const result = await db.transaction(async (tx) => {
      // Check if user has enough credits
      const [user] = await tx.select({ aiCredits: users.aiCredits }).from(users).where(eq(users.id, userId));
      
      if (!user || user.aiCredits < credits) {
        return false;
      }

      // Deduct credits from user
      await tx
        .update(users)
        .set({ 
          aiCredits: sql`${users.aiCredits} - ${credits}`,
          totalAiCreditsUsed: sql`${users.totalAiCreditsUsed} + ${credits}`,
          updatedAt: new Date()
        })
        .where(eq(users.id, userId));

      // Log the usage
      await tx.insert(aiCreditUsage).values({
        id: crypto.randomUUID(),
        userId,
        requestType,
        creditsUsed: credits,
        prompt: prompt?.substring(0, 500) || null, // Truncate long prompts
        success: true,
      });

      return true;
    });

    return result;
  }

  async addAiCredits(userId: string, credits: number, priceUsd: number, stripePaymentIntentId?: string): Promise<void> {
    await db.transaction(async (tx) => {
      // Add credits to user
      await tx
        .update(users)
        .set({ 
          aiCredits: sql`${users.aiCredits} + ${credits}`,
          lastAiCreditPurchase: new Date(),
          updatedAt: new Date()
        })
        .where(eq(users.id, userId));

      // Record the purchase
      await tx.insert(aiCreditPurchases).values({
        id: crypto.randomUUID(),
        userId,
        creditsAmount: credits,
        priceUsd,
        stripePaymentIntentId,
        status: 'completed',
      });
    });
  }
}

export const storage = new DatabaseStorage();