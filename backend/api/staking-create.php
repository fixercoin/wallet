<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(200);
  exit();
}

require_once(__DIR__ . '/../lib/staking-db.php');
require_once(__DIR__ . '/../lib/auth.php');

try {
  // Get JSON input
  $input = json_decode(file_get_contents('php://input'), true);

  if (!$input) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON input']);
    exit();
  }

  // Validate required fields
  $walletAddress = isset($input['wallet']) ? sanitize($input['wallet']) : null;
  $tokenMint = isset($input['tokenMint']) ? sanitize($input['tokenMint']) : null;
  $amount = isset($input['amount']) ? floatval($input['amount']) : null;
  $periodDays = isset($input['periodDays']) ? intval($input['periodDays']) : null;
  $message = isset($input['message']) ? $input['message'] : null;
  $signature = isset($input['signature']) ? $input['signature'] : null;

  // Validate inputs
  if (!$walletAddress || !$tokenMint || $amount === null || !$periodDays) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing required fields: wallet, tokenMint, amount, periodDays']);
    exit();
  }

  // Verify signature
  if (!SignatureVerifier::verifySignature($message, $signature, $walletAddress)) {
    http_response_code(401);
    echo json_encode(['error' => 'Invalid signature']);
    exit();
  }

  // Validate period
  if (!in_array($periodDays, [30, 60, 90])) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid period. Must be 30, 60, or 90 days']);
    exit();
  }

  // Validate amount
  if ($amount <= 0) {
    http_response_code(400);
    echo json_encode(['error' => 'Amount must be greater than 0']);
    exit();
  }

  // Calculate timestamps and reward
  $now = time();
  $startTime = $now * 1000; // Convert to milliseconds
  $endTime = $startTime + ($periodDays * 24 * 60 * 60 * 1000);
  $rewardAmount = calculateReward($amount, $periodDays);
  $stakeId = generateStakeId();

  // Create stake in database
  $db = new StakingDatabase();
  $stake = $db->createStake(
    $stakeId,
    $walletAddress,
    $tokenMint,
    $amount,
    $periodDays,
    $startTime,
    $endTime,
    $rewardAmount
  );

  http_response_code(201);
  echo json_encode([
    'success' => true,
    'data' => $stake
  ]);

} catch (Exception $e) {
  http_response_code(500);
  echo json_encode(['error' => $e->getMessage()]);
}

function calculateReward($amount, $periodDays) {
  // 10% APY
  $yearlyReward = $amount * 0.1;
  $dailyRate = $yearlyReward / 365;
  return $dailyRate * $periodDays;
}

function generateStakeId() {
  return 'stake_' . time() . '_' . bin2hex(random_bytes(5));
}

function sanitize($input) {
  return htmlspecialchars(strip_tags(trim($input)), ENT_QUOTES, 'UTF-8');
}
?>
