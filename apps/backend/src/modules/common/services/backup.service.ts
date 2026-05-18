/**
 * Layer: Backend Service
 * Responsibility: Implements the Backup application service for the Common module, including business rules, side effects, and persistence coordination.
 * Notes: Keep comments focused on intent, invariants, side effects, and cross-module contracts.
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';

/**
 * 数据备份服务
 * 建立数据备份机制，每日自动备份
 */
@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private readonly execFileAsync = promisify(execFile);

  constructor(
    private configService: ConfigService,
  ) {}

  private getScriptPath(): string {
    return path.resolve(process.cwd(), 'scripts', 'db-backup.js');
  }

  private buildScriptArgs(): string[] {
    const backupPath = this.configService.get<string>('BACKUP_PATH');
    const retentionDays = this.configService.get<string>('BACKUP_RETENTION_DAYS');
    const args = [this.getScriptPath()];

    if (backupPath) {
      args.push('--output-dir', backupPath);
    }
    if (retentionDays) {
      args.push('--retention-days', retentionDays);
    }

    return args;
  }

  private async runBackupScript(): Promise<string> {
    const { stdout, stderr } = await this.execFileAsync(process.execPath, this.buildScriptArgs(), {
      cwd: process.cwd(),
      env: process.env,
    });

    if (stderr?.trim()) {
      this.logger.warn(`[数据备份] stderr: ${stderr.trim()}`);
    }

    return stdout.trim();
  }

  /**
   * 每日自动备份（凌晨2点执行）
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async dailyBackup() {
    this.logger.log('[数据备份] 开始执行每日自动备份...');

    try {
      const result = await this.runBackupScript();
      this.logger.log(`[数据备份] 备份完成: ${result}`);
    } catch (error) {
      this.logger.error(`[数据备份] 执行失败: ${error.message}`);
    }
  }

  /**
   * 手动触发备份
   */
  async manualBackup(): Promise<string> {
    this.logger.log('[数据备份] 手动触发备份...');
    return this.runBackupScript();
  }
}
