import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  public client: any = null;

  constructor() {
    try {
      // Lazy-load PrismaClient so API boots cleanly even if prisma generate hasn't been run
      // or PostgreSQL is not installed locally.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { PrismaClient } = require('@prisma/client');
      this.client = new PrismaClient();
    } catch (err: any) {
      this.logger.warn(`PrismaClient unavailable (running in offline/in-memory mode): ${err?.message}`);
      this.client = null;
    }
  }

  async onModuleInit() {
    if (!this.client) return;
    try {
      await this.client.$connect();
      this.logger.log('Connected to PostgreSQL via Prisma');
    } catch (err: any) {
      this.logger.warn(`Database connection skipped or pending: ${err?.message}`);
    }
  }

  async onModuleDestroy() {
    if (!this.client) return;
    try {
      await this.client.$disconnect();
    } catch {
      // ignore disconnect errors
    }
  }
}
