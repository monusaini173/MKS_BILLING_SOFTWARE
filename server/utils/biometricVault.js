const crypto = require('crypto');

// Master Encryption Key (derived from environment or secure hardware salt)
const getVaultKey = () => {
  const secret = process.env.BIOMETRIC_VAULT_SECRET || process.env.JWT_SECRET || 'mks_biometric_super_secure_vault_key_2026';
  return crypto.createHash('sha256').update(secret).digest();
};

/**
 * Encrypt biometric descriptor array using AES-256-GCM with unique IV and Auth Tag
 * Prevents plain biometric theft even in case of full database dump
 */
const encryptDescriptor = (descriptorArray) => {
  try {
    if (!Array.isArray(descriptorArray)) return null;
    
    const key = getVaultKey();
    const iv = crypto.randomBytes(12); // 96-bit IV for GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    
    const plaintext = JSON.stringify(descriptorArray);
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag().toString('hex');
    
    return {
      version: 'AES-256-GCM-v1',
      iv: iv.toString('hex'),
      authTag,
      ciphertext: encrypted
    };
  } catch (err) {
    console.error('[CYBERSECURITY VAULT] Encryption error:', err.message);
    return null;
  }
};

/**
 * Decrypt biometric descriptor array and verify tamper-proof integrity tag
 */
const decryptDescriptor = (vaultObjectOrString) => {
  try {
    if (!vaultObjectOrString) return null;

    // Backward compatibility if stored as plain JSON string array
    if (typeof vaultObjectOrString === 'string') {
      try {
        const parsed = JSON.parse(vaultObjectOrString);
        if (Array.isArray(parsed)) return parsed;
        if (parsed.ciphertext && parsed.iv && parsed.authTag) {
          vaultObjectOrString = parsed;
        }
      } catch (e) {
        return null;
      }
    }

    if (vaultObjectOrString.ciphertext && vaultObjectOrString.iv && vaultObjectOrString.authTag) {
      const key = getVaultKey();
      const iv = Buffer.from(vaultObjectOrString.iv, 'hex');
      const authTag = Buffer.from(vaultObjectOrString.authTag, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(vaultObjectOrString.ciphertext, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return JSON.parse(decrypted);
    }

    return null;
  } catch (err) {
    console.warn('[CYBERSECURITY VAULT] Tampering / Decryption failure:', err.message);
    return null;
  }
};

module.exports = {
  encryptDescriptor,
  decryptDescriptor
};
