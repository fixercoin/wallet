<?php
/**
 * Staking Database Handler
 * Manages stake data storage using JSON files
 */

class StakingDatabase {
  private $dataDir;
  private $stakesFile;

  public function __construct() {
    $this->dataDir = __DIR__ . '/../data';
    $this->stakesFile = $this->dataDir . '/stakes.json';
    
    // Ensure data directory exists
    if (!is_dir($this->dataDir)) {
      mkdir($this->dataDir, 0755, true);
    }
    
    // Initialize stakes file if it doesn't exist
    if (!file_exists($this->stakesFile)) {
      file_put_contents($this->stakesFile, json_encode([], JSON_PRETTY_PRINT));
    }
  }

  /**
   * Get all stakes for a wallet
   */
  public function getStakesByWallet($walletAddress) {
    $stakes = $this->readStakes();
    $walletStakes = array_filter($stakes, function($stake) use ($walletAddress) {
      return $stake['wallet_address'] === $walletAddress;
    });
    
    // Add timeRemainingMs for active stakes
    return array_map(function($stake) {
      if ($stake['status'] === 'active') {
        $stake['timeRemainingMs'] = max(0, $stake['end_time'] - time() * 1000);
      } else {
        $stake['timeRemainingMs'] = 0;
      }
      return $stake;
    }, array_values($walletStakes));
  }

  /**
   * Get stake by ID
   */
  public function getStakeById($stakeId) {
    $stakes = $this->readStakes();
    foreach ($stakes as $stake) {
      if ($stake['id'] === $stakeId) {
        return $stake;
      }
    }
    return null;
  }

  /**
   * Create a new stake
   */
  public function createStake($id, $walletAddress, $tokenMint, $amount, $periodDays, $startTime, $endTime, $rewardAmount) {
    $stakes = $this->readStakes();
    
    $newStake = [
      'id' => $id,
      'wallet_address' => $walletAddress,
      'token_mint' => $tokenMint,
      'amount' => floatval($amount),
      'stake_period_days' => intval($periodDays),
      'start_time' => intval($startTime),
      'end_time' => intval($endTime),
      'reward_amount' => floatval($rewardAmount),
      'status' => 'active',
      'withdrawn_at' => null,
      'created_at' => intval(time() * 1000),
      'updated_at' => intval(time() * 1000),
      'timeRemainingMs' => max(0, $endTime - time() * 1000)
    ];
    
    $stakes[] = $newStake;
    $this->writeStakes($stakes);
    
    return $newStake;
  }

  /**
   * Update stake status (e.g., withdraw)
   */
  public function updateStakeStatus($stakeId, $status) {
    $stakes = $this->readStakes();
    $now = time() * 1000;
    
    foreach ($stakes as &$stake) {
      if ($stake['id'] === $stakeId) {
        $stake['status'] = $status;
        $stake['updated_at'] = intval($now);
        if ($status === 'withdrawn') {
          $stake['withdrawn_at'] = intval($now);
        }
        break;
      }
    }
    
    $this->writeStakes($stakes);
    return true;
  }

  /**
   * Read stakes from JSON file
   */
  private function readStakes() {
    if (!file_exists($this->stakesFile)) {
      return [];
    }
    
    $content = file_get_contents($this->stakesFile);
    $stakes = json_decode($content, true);
    
    return is_array($stakes) ? $stakes : [];
  }

  /**
   * Write stakes to JSON file
   */
  private function writeStakes($stakes) {
    file_put_contents($this->stakesFile, json_encode($stakes, JSON_PRETTY_PRINT));
  }
}
