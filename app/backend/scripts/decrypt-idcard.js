const crypto = require('crypto');

const keyString = 'CaiZhiTong2025AES32ByteKey123456';
const ivString = '0123456789012345';
const encrypted = '96b7c18949551c6b70ea838a7ea563d6432ed6f15dd097cf01fd6792fbc57583';

// 密钥处理：确保是32字节
const keyBuffer = Buffer.from(keyString, 'utf8');
let key;
if (keyBuffer.length === 32) {
  key = keyBuffer;
} else if (keyBuffer.length < 32) {
  key = crypto.createHash('sha256').update(keyString).digest();
} else {
  key = keyBuffer.slice(0, 32);
}

// IV处理：确保是16字节
const ivBuffer = Buffer.from(ivString, 'utf8');
let iv;
if (ivBuffer.length === 16) {
  iv = ivBuffer;
} else if (ivBuffer.length < 16) {
  iv = crypto.createHash('md5').update(ivString).digest();
} else {
  iv = ivBuffer.slice(0, 16);
}

console.log('Key length:', key.length);
console.log('IV length:', iv.length);

try {
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  console.log('身份证号:', decrypted);
  console.log('身份证后6位:', decrypted.slice(-6));
} catch(e) {
  console.error('解密失败:', e.message);
}

