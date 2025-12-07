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
  $stakeId = isset($input['stakeId']) ? sanitize($input['stakeId']) : null;
  $message = isset($input['message']) ? $input['message'] : null;
  $signature = isset($input['signature']) ? $input['signature'] : null;

  // Validate inputs
  if (!$walletAddress || !$stakeId) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing required fields: wallet, stakeId']);
    exit();
  }

  // Verify signature
  if (!SignatureVerifier::verifySignature($message, $signature, $walletAddress)) {
    http_response_code(401);
    echo json_encode(['error' => 'Invalid signature']);
    exit();
  }

  // Get stake from database
  $db = new StakingDatabase();
  $stake = $db->getStakeById($stakeId);

  if (!$stake) {
    http_response_code(404);
    echo json_encode(['error' => 'Stake not found']);
    exit();
  }

  // Verify wallet owns this stake
  if ($stake['wallet_address'] !== $walletAddress) {
    http_response_code(403);
    echo json_encode(['error' => 'Unauthorized - You do not own this stake']);
    exit();
  }

  // Verify stake is active
  if ($stake['status'] !== 'active') {
    http_response_code(400);
    echo json_encode(['error' => 'Stake is not active']);
    exit();
  }

  // Check if staking period has ended
  $now = time() * 1000; // Convert to milliseconds
  if ($now < $stake['end_time']) {
    $timeRemaining = ($stake['end_time'] - $now) / 1000 / 60; // Convert to minutes
    http_response_code(400);
    echo json_encode([
      'error' => 'Staking period has not ended yet',
      'timeRemaining' => $timeRemaining
    ]);
    exit();
  }

  // Load reward configuration
  $rewardConfig = require(__DIR__ . '/../config/reward-config.php');

  // Update stake status to withdrawn
  $db->updateStakeStatus($stakeId, 'withdrawn');

  // Record reward distribution
  $totalAmount = $stake['amount'] + $stake['reward_amount'];
  $db->recordRewardDistribution(
    $stakeId,
    $walletAddress,
    $stake['reward_amount'],
    $stake['token_mint']
  );

  // Get updated stake
  $updatedStake = $db->getStakeById($stakeId);

  http_response_code(200);
  echo json_encode([
    'success' => true,
    'data' => [
      'stake' => $updatedStake,
      'totalAmount' => $totalAmount,
      'reward' => [
        'amount' => $stake['reward_amount'],
        'tokenMint' => $stake['token_mint'],
        'payerWallet' => $rewardConfig['reward_wallet'],
        'recipientWallet' => $walletAddress,
        'status' => 'ready_for_distribution'
      ]
    ]
  ]);

} catch (Exception $e) {
  http_response_code(500);
  echo json_encode(['error' => $e->getMessage()]);
}

function sanitize($input) {
  return htmlspecialchars(strip_tags(trim($input)), ENT_QUOTES, 'UTF-8');
}
?>
