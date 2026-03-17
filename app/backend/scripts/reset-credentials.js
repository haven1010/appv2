const mysql = require('mysql2/promise');
const crypto = require('crypto');

const alg = 'aes-256-cbc';
const keyRaw = 'CaiZhiTong2025AES32ByteKey123456';
const ivRaw = '0123456789012345';
const keyBuffer = Buffer.from(keyRaw, 'utf8');
const ivBuffer = Buffer.from(ivRaw, 'utf8');

function encrypt(text) {
  const cipher = crypto.createCipheriv(alg, keyBuffer, ivBuffer);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

function hash(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

async function run() {
  const connection = await mysql.createConnection({
    host: '127.0.0.1', port: 3307, 
    user: 'pickpass_user', password: 'pickpass_password', database: 'pickpass_db'
  });
  
  const [rows] = await connection.execute('SELECT id, name, role_key FROM sys_user ORDER BY id ASC');
  
  console.log("=== Overwriting user phones and ID cards ===");
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    // Base phone: 13800000000 + id
    const phone = `138${String(row.id).padStart(8, '0')}`;
    
    // Example ID Card: 33010619900101xxxy
    const suffix = String(row.id).padStart(4, '0');
    const idCard = `33010619900101${suffix}`;
    
    const phoneEnc = encrypt(phone);
    const phoneHash = hash(phone);
    const idCardEnc = encrypt(idCard);
    const idCardHash = hash(idCard);
    
    await connection.execute(
      'UPDATE sys_user SET phone_enc = ?, phone_hash = ?, id_card_enc = ?, id_card_hash = ? WHERE id = ?',
      [phoneEnc, phoneHash, idCardEnc, idCardHash, row.id]
    );
    
    console.log(`Updated ID: ${row.id}, Name: ${row.name}, Role: ${row.role_key}`);
    console.log(` -> Login Phone: ${phone}`);
    console.log(` -> Password (last 6 of ID): 01${suffix}`);
  }
  
  console.log("\nDone! You can now log in using these generated credentials.");
  process.exit(0);
}

run();