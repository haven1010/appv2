/**
 * 更新所有现有用户的 phone_hash 字段
 * 运行方式: npx ts-node scripts/update-phone-hash.ts
 */

import { createConnection } from 'typeorm';
import { SysUser } from '../src/modules/user/entities/sys-user.entity';
import { SecurityService } from '../src/modules/common/services/security.service';
import { ConfigService } from '@nestjs/config';
import { ConfigModule } from '@nestjs/config';

async function updatePhoneHash() {
  // Initialize ConfigModule
  const configModule = ConfigModule.forRoot({
    isGlobal: true,
    envFilePath: '.env',
  });
  
  const configService = new ConfigService();
  const securityService = new SecurityService(configService);

  const connection = await createConnection({
    type: 'mysql',
    host: configService.get<string>('DB_HOST', 'localhost'),
    port: configService.get<number>('DB_PORT', 3307),
    username: configService.get<string>('DB_USERNAME', 'pickpass_user'),
    password: configService.get<string>('DB_PASSWORD', 'pickpass_password'),
    database: configService.get<string>('DB_DATABASE', 'pickpass_db'),
    entities: [SysUser],
  });

  const userRepository = connection.getRepository(SysUser);
  const users = await userRepository.find();

  console.log(`Found ${users.length} users to update`);

  let updated = 0;
  let failed = 0;

  for (const user of users) {
    try {
      // Decrypt phone
      const decryptedPhone = securityService.decrypt(user.phone);
      if (decryptedPhone) {
        // Calculate phone_hash
        const phoneHash = securityService.hash(decryptedPhone);
        
        // Update user
        user.phoneHash = phoneHash;
        await userRepository.save(user);
        
        console.log(`✓ Updated user ${user.uid} (${user.name}): phone_hash = ${phoneHash.substring(0, 16)}...`);
        updated++;
      } else {
        console.log(`✗ Failed to decrypt phone for user ${user.uid}`);
        failed++;
      }
    } catch (error) {
      console.error(`✗ Error updating user ${user.uid}:`, error.message);
      failed++;
    }
  }

  console.log(`\nUpdate complete: ${updated} updated, ${failed} failed`);
  await connection.close();
}

updatePhoneHash().catch(console.error);

