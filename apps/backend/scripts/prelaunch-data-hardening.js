require('reflect-metadata');
require('dotenv').config({ path: '.env' });

const { DataSource } = require('typeorm');
const { SysUser } = require('../dist/modules/user/entities/sys-user.entity');
const { BaseInfo } = require('../dist/modules/base/entities/base-info.entity');
const { SecurityService } = require('../dist/modules/common/services/security.service');

async function main() {
  if (!process.env.AES_KEY) {
    throw new Error('AES_KEY is required before running prelaunch hardening');
  }

  const securityService = new SecurityService();

  const dataSource = new DataSource({
    type: 'mysql',
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    username: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || '123456',
    database: process.env.DB_DATABASE || 'pickpass_db',
    entities: [SysUser, BaseInfo],
    synchronize: false,
  });

  await dataSource.initialize();

  const userRepo = dataSource.getRepository(SysUser);
  const baseRepo = dataSource.getRepository(BaseInfo);

  const users = await userRepo.find();
  let updatedUsers = 0;

  for (const user of users) {
    let changed = false;
    const idCardHash = securityService.hash(user.idCard);
    const phoneHash = user.phone ? securityService.hash(user.phone) : null;
    const emergencyPhoneHash = user.emergencyPhone
      ? securityService.hash(user.emergencyPhone)
      : null;

    if (user.idCardHash !== idCardHash) {
      user.idCardHash = idCardHash;
      changed = true;
    }
    if (user.phoneHash !== phoneHash) {
      user.phoneHash = phoneHash;
      changed = true;
    }
    if (user.emergencyPhoneHash !== emergencyPhoneHash) {
      user.emergencyPhoneHash = emergencyPhoneHash;
      changed = true;
    }

    if (changed) {
      await userRepo.save(user);
      updatedUsers += 1;
    }
  }

  const bases = await baseRepo.find();
  let updatedBases = 0;

  for (const base of bases) {
    await baseRepo.save(base);
    updatedBases += 1;
  }

  await dataSource.destroy();

  console.log(
    `Prelaunch hardening complete: users updated=${updatedUsers}, bases re-encrypted=${updatedBases}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
