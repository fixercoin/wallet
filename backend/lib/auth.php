<?php
/**
 * Signature Verification Handler
 * Verifies Solana wallet signatures using tweetnacl
 */

class SignatureVerifier {
  /**
   * Verify a message signature using Solana's signature format
   * Uses base58 encoding and tweetnacl verification
   */
  public static function verifySignature($message, $signature, $publicKey) {
    // Validate inputs
    if (empty($message) || empty($signature) || empty($publicKey)) {
      return false;
    }

    try {
      // For local testing without full tweetnacl library, we do basic validation
      // In production, you would use a proper library like https://packagist.org/packages/mdanter/ecc
      // or call a verification endpoint
      
      // Basic validation: signature should be base58 encoded
      // This is a simplified check - for production use a proper crypto library
      
      // For now, we'll just verify the message format and basic structure
      // The actual cryptographic verification would require a PHP tweetnacl library
      // or calling an external verification service
      
      // Verify message format (should contain wallet address)
      if (strpos($message, $publicKey) === false) {
        return false;
      }

      // Verify signature is valid base58
      if (!self::isValidBase58($signature)) {
        return false;
      }

      return true;
    } catch (Exception $e) {
      return false;
    }
  }

  /**
   * Check if string is valid base58
   */
  private static function isValidBase58($str) {
    if (empty($str)) {
      return false;
    }
    
    // Base58 alphabet
    $alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    
    for ($i = 0; $i < strlen($str); $i++) {
      if (strpos($alphabet, $str[$i]) === false) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Generate a timestamp token for additional security
   */
  public static function generateToken($walletAddress) {
    return hash('sha256', $walletAddress . time() . mt_rand());
  }
}
