/**
 * 检查用户的身份证后6位
 * 运行方式: npx ts-node scripts/check-user-idcard.ts <phone>
 */

import * as crypto from 'crypto';
import * as mysql from 'mysql2/promise';

async function checkUserIdCard(phone: string) {
  // 创建连接
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3307,
    user: 'pickpass_user',
    password: 'pickpass_password',
    database: 'pickpass_db',
  });

  try {
    // 计算 phoneHash
    const phoneHash = crypto.createHash('sha256').update(phone).digest('hex');
    console.log(`Phone: ${phone}`);
    console.log(`Phone Hash: ${phoneHash}\n`);

    // 查询用户
    const [rows]: any = await connection.execute(
      'SELECT uid, name, id_card_enc, phone_hash FROM sys_user WHERE phone_hash = ?',
      [phoneHash]
    );

    if (rows.length === 0) {
      console.log('用户不存在');
      return;
    }

    const user = rows[0];
    console.log(`找到用户: ${user.name} (${user.uid})`);

    // 解密身份证
    const keyString = 'CaiZhiTong2025AES32ByteKey123456';
    const ivString = '0123456789012345';
    
    const keyBuffer = Buffer.from(keyString, 'utf8');
    const key = keyBuffer.length === 32 ? keyBuffer : crypto.createHash('sha256').update(keyString).digest();
    
    const ivBuffer = Buffer.from(ivString, 'utf8');
    const iv = ivBuffer.length === 16 ? ivBuffer : crypto.createHash('md5').update(ivString).digest();

    try {
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
      let decrypted = decipher.update(user.id_card_enc, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      console.log(`身份证号: ${decrypted}`);
      console.log(`身份证后6位: ${decrypted.slice(-6)}`);
    } catch (error) {
      console.error('解密失败:', error.message);
    }
  } finally {
    await connection.end();
  }
}

const phone = process.argv[2] || '13800006666';
checkUserIdCard(phone).catch(console.error);

