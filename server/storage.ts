import {
  users,
  photographySessions,
  aiCreditPurchases,
  aiCreditUsage,
  r2Files,
  r2StorageUsage,
  type User,
  type UpsertUser,
  type PhotographySession,
  type InsertPhotographySession,
  type InsertAiCreditPurchase,
  type InsertAiCreditUsage,
  type R2File,
  type InsertR2File,
  type R2StorageUsage,
  type InsertR2StorageUsage,
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
  
  // R2 Storage operations (RAW files, gallery images, documents)
  createR2File(r2File: InsertR2File): Promise<R2File>;
  getR2FilesBySession(sessionId: string, userId: string): Promise<R2File[]>;
  getR2FileById(fileId: string, userId: string): Promise<R2File | undefined>;
  deleteR2File(fileId: string, userId: string): Promise<boolean>;
  updateR2FileStatus(fileId: string, status: string, uploadCompletedAt?: Date): Promise<boolean>;
  
  getUserR2StorageUsage(userId: string): Promise<R2StorageUsage | undefined>;
  updateR2StorageUsage(userId: string, updates: Partial<R2StorageUsage>): Promise<R2StorageUsage>;
  createR2StorageUsage(usage: InsertR2StorageUsage): Promise<R2StorageUsage>;
  recalculateUserStorageUsage(userId: string): Promise<R2StorageUsage>;
  checkStorageLimit(userId: string, additionalSizeBytes: number): Promise<{ allowed: boolean; usage: R2StorageUsage }>;
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
      
      if (!user || (user.aiCredits || 0) < credits) {
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
        priceUsd: priceUsd.toString(),
        stripePaymentIntentId,
        status: 'completed',
      });
    });
  }

  // R2 Storage operations (RAW files, gallery images, documents)
  async createR2File(r2File: InsertR2File): Promise<R2File> {
    const [newR2File] = await db.insert(r2Files).values(r2File).returning();
    
    // Update user's storage usage after creating file
    await this.recalculateUserStorageUsage(r2File.userId);
    
    return newR2File;
  }

  async getR2FilesBySession(sessionId: string, userId: string): Promise<R2File[]> {
    return await db.select().from(r2Files)
      .where(and(eq(r2Files.sessionId, sessionId), eq(r2Files.userId, userId)));
  }

  async getR2FileById(fileId: string, userId: string): Promise<R2File | undefined> {
    const [r2File] = await db.select().from(r2Files)
      .where(and(eq(r2Files.id, fileId), eq(r2Files.userId, userId)));
    return r2File;
  }

  async deleteR2File(fileId: string, userId: string): Promise<boolean> {
    const result = await db.delete(r2Files)
      .where(and(eq(r2Files.id, fileId), eq(r2Files.userId, userId)));
    
    // Update user's storage usage after deleting file
    if ((result.rowCount ?? 0) > 0) {
      await this.recalculateUserStorageUsage(userId);
    }
    
    return (result.rowCount ?? 0) > 0;
  }

  async updateR2FileStatus(fileId: string, status: string, uploadCompletedAt?: Date): Promise<boolean> {
    const updates: any = { uploadStatus: status, updatedAt: new Date() };
    if (uploadCompletedAt) {
      updates.uploadCompletedAt = uploadCompletedAt;
    }
    
    const result = await db.update(r2Files)
      .set(updates)
      .where(eq(r2Files.id, fileId));
    return (result.rowCount ?? 0) > 0;
  }

  async getUserR2StorageUsage(userId: string): Promise<R2StorageUsage | undefined> {
    const [usage] = await db.select().from(r2StorageUsage)
      .where(eq(r2StorageUsage.userId, userId));
    return usage;
  }

  async updateR2StorageUsage(userId: string, updates: Partial<R2StorageUsage>): Promise<R2StorageUsage> {
    const [updatedUsage] = await db.update(r2StorageUsage)
      .set({ ...updates, updatedAt: new Date(), lastUsageUpdate: new Date() })
      .where(eq(r2StorageUsage.userId, userId))
      .returning();
    return updatedUsage;
  }

  async createR2StorageUsage(usage: InsertR2StorageUsage): Promise<R2StorageUsage> {
    const [newUsage] = await db.insert(r2StorageUsage).values(usage).returning();
    return newUsage;
  }

  /**
   * Recalculate user's total storage usage from all R2 files
   * This ensures real-time accuracy of storage tracking
   */
  async recalculateUserStorageUsage(userId: string): Promise<R2StorageUsage> {
    // Get sum of all file sizes for this user
    const [totals] = await db
      .select({
        totalFiles: sql<number>`CAST(COUNT(*) AS INTEGER)`,
        totalSizeBytes: sql<string>`CAST(SUM(CAST(${r2Files.fileSizeBytes} AS BIGINT)) AS TEXT)`,
      })
      .from(r2Files)
      .where(and(eq(r2Files.userId, userId), eq(r2Files.uploadStatus, 'completed')));

    const totalSizeBytes = BigInt(totals.totalSizeBytes || '0');
    const totalSizeGB = Number(totalSizeBytes) / (1024 * 1024 * 1024);
    const totalSizeTB = totalSizeGB / 1024;

    // Get or create storage usage record
    let usage = await this.getUserR2StorageUsage(userId);
    
    if (!usage) {
      usage = await this.createR2StorageUsage({
        id: crypto.randomUUID(),
        userId,
        totalFiles: totals.totalFiles,
        totalSizeBytes: totals.totalSizeBytes || '0',
        totalSizeGB: totalSizeGB.toFixed(3),
        totalSizeTB: totalSizeTB.toFixed(6),
        baseStorageTB: '1.00',
        additionalStorageTB: 0,
        maxAllowedTB: '1.00',
        storageStatus: 'active',
        monthlyStorageCost: '0.00',
      });
    } else {
      // Update existing usage record
      const maxAllowedTB = Number(usage.baseStorageTB) + usage.additionalStorageTB;
      const storageStatus = totalSizeTB > maxAllowedTB ? 'overlimit' : 'active';
      const monthlyStorageCost = usage.additionalStorageTB * 35; // $35 per additional TB

      usage = await this.updateR2StorageUsage(userId, {
        totalFiles: totals.totalFiles,
        totalSizeBytes: totals.totalSizeBytes || '0',
        totalSizeGB: totalSizeGB.toFixed(3),
        totalSizeTB: totalSizeTB.toFixed(6),
        maxAllowedTB: maxAllowedTB.toFixed(2),
        storageStatus,
        monthlyStorageCost: monthlyStorageCost.toFixed(2),
      });
    }

    return usage;
  }

  /**
   * Check if user can upload additional files without exceeding storage limit
   * Returns usage info and whether upload is allowed
   */
  async checkStorageLimit(userId: string, additionalSizeBytes: number): Promise<{ allowed: boolean; usage: R2StorageUsage }> {
    const usage = await this.recalculateUserStorageUsage(userId);
    
    const currentSizeBytes = BigInt(usage.totalSizeBytes);
    const newTotalSizeBytes = currentSizeBytes + BigInt(additionalSizeBytes);
    const newTotalSizeTB = Number(newTotalSizeBytes) / (1024 * 1024 * 1024 * 1024);
    
    const maxAllowedTB = Number(usage.maxAllowedTB);
    const allowed = newTotalSizeTB <= maxAllowedTB;
    
    return { allowed, usage };
  }
}

export const storage = new DatabaseStorage();