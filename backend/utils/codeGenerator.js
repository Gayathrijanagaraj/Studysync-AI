const crypto = require('crypto');

/**
 * Generates a clean, readable, non-guessable study room code.
 * Format: SYNC-XXXX (e.g. SYNC-8F2K)
 */
function generateRoomCode(prefix = 'SYNC') {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // exclude 0, 1, I, O to prevent confusion
  let code = '';
  for (let i = 0; i < 4; i++) {
    const randomIndex = crypto.randomInt(0, chars.length);
    code += chars[randomIndex];
  }
  return `${prefix}-${code}`;
}

module.exports = { generateRoomCode };
