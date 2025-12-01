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

try {
  // Get wallet address from query params
  $walletAddress = isset($_GET['wallet']) ? sanitize($_GET['wallet']) : null;

  if (empty($walletAddress)) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing wallet address']);
    exit();
  }

  // Get rewards from database
  $db = new StakingDatabase();
  $rewards = $db->getRewardsByWallet($walletAddress);
  
  // Load reward configuration
  $rewardConfig = require(__DIR__ . '/../config/reward-config.php');

  // Calculate total rewards earned
  $totalEarned = 0;
  $processedRewards = [];
  
  foreach ($rewards as $reward) {
    $totalEarned += $reward['reward_amount'];
    if ($reward['status'] === 'processed') {
      $processedRewards[] = $reward;
    }
  }

  http_response_code(200);
  echo json_encode([
    'success' => true,
    'data' => [
      'walletAddress' => $walletAddress,
      'totalRewardsEarned' => $totalEarned,
      'rewardCount' => count($rewards),
      'rewardPayerWallet' => $rewardConfig['reward_wallet'],
      'rewards' => $processedRewards,
      'summary' => [
        'totalProcessed' => count($processedRewards),
        'totalPending' => count(array_filter($rewards, fn($r) => $r['status'] === 'pending')),
        'currencySymbol' => 'FIXERCOIN'
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
