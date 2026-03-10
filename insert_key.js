const Database = require('better-sqlite3');
const db = new Database('./apps/web/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/6115944945e7a157c544c242d953f634c8d8936dd7ed26ffd269991639ad59a7.sqlite');

try {
  // Get an admin user
  const user = db.prepare('SELECT id FROM users WHERE is_admin = 1 LIMIT 1').get();
  
  if (!user) {
    console.log("No admin user found. Creating one...");
    db.prepare('INSERT INTO users (id, email, name, is_admin) VALUES (?, ?, ?, ?)').run(
      'admin-id-123', 'admin@example.com', 'Admin User', 1
    );
  }
  
  const userId = user ? user.id : 'admin-id-123';
  
  // Insert the API key
  // Raw key: nk_4bd490b5f5d3a642a4a09ec00d84388f54d44a594df02f80570cccb08c470dd5
  // Hash: 8ebecd0fcef1b5fa74d983db4edadd9aa9481b0fad8c8973d1444decddbdc1ec
  // Prefix: nk_4bd490b5
  
  db.prepare('INSERT INTO api_keys (id, user_id, name, key_hash, key_prefix) VALUES (?, ?, ?, ?, ?)').run(
    'test-key-id-123',
    userId,
    'Audit Override Key',
    '8ebecd0fcef1b5fa74d983db4edadd9aa9481b0fad8c8973d1444decddbdc1ec',
    'nk_4bd490b5'
  );
  
  console.log("Successfully inserted API key.");
} catch (e) {
  console.error("Error inserting key:", e);
} finally {
  db.close();
}
