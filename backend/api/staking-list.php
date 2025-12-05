<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(200);
  exit();
}

require_once(__DIR__ . '/../lib/staking-db.php');
require_once(__DIR__ . '/../lib/auth.php');

try {
  // Get wallet address from query params
  $walletAddress = isset($_GET['wallet']) ? sanitize($_GET['wallet']) : null;

  if (empty($walletAddress)) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing wallet address']);
    exit();
  }

  // Optional: Get message and signature for verification
  $message = isset($_GET['message']) ? $_GET['message'] : null;
  $signature = isset($_GET['signature']) ? $_GET['signature'] : null;

  // Verify signature if provided
  if ($message && $signature) {
    if (!SignatureVerifier::verifySignature($message, $signature, $walletAddress)) {
      http_response_code(401);
      echo json_encode(['error' => 'Invalid signature']);
      exit();
    }
  }

  // Get stakes from database
  $db = new StakingDatabase();
  $stakes = $db->getStakesByWallet($walletAddress);

  http_response_code(200);
  echo json_encode([
    'success' => true,
    'data' => $stakes,
    'count' => count($stakes)
  ]);

} catch (Exception $e) {
  http_response_code(500);
  echo json_encode(['error' => $e->getMessage()]);
}

function sanitize($input) {
  return htmlspecialchars(strip_tags(trim($input)), ENT_QUOTES, 'UTF-8');
}
?>
