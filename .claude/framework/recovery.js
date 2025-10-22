#!/usr/bin/env node
/**
 * Recovery Protocol for Long Task Execution Framework
 *
 * Implements multi-level recovery:
 *   Level 1: Retry (up to 3 attempts)
 *   Level 2: Rollback to last valid checkpoint
 *   Level 3: Escalate to human
 *
 * Usage:
 *   node recovery.js --task-id=1.5 --error='{"type":"validation","message":"..."}'
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Parse arguments
const args = process.argv.slice(2);
const params = {};

args.forEach(arg => {
  const [key, value] = arg.split('=');
  if (key.startsWith('--')) {
    params[key.slice(2)] = value;
  }
});

// Validate required params
if (!params['task-id']) {
  console.error('ERROR: --task-id parameter is required');
  process.exit(1);
}

const taskId = params['task-id'];

// Parse error
let error = {};
if (params.error) {
  try {
    error = JSON.parse(params.error);
  } catch (e) {
    error = { message: params.error };
  }
}

// Load current task
const currentTaskPath = path.join(process.cwd(), '.claude', 'tasks', 'current-task.json');

if (!fs.existsSync(currentTaskPath)) {
  console.error('ERROR: No active long-task found');
  process.exit(1);
}

const currentTask = JSON.parse(fs.readFileSync(currentTaskPath, 'utf8'));

// Find the failed task
const failedTask = currentTask.atomicTasks.find(t => t.id === taskId);

if (!failedTask) {
  console.error(`ERROR: Task ${taskId} not found`);
  process.exit(1);
}

// Check retry count
if (!failedTask.retryCount) {
  failedTask.retryCount = 0;
}

console.log('');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🔄 Recovery Protocol Activated');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');
console.log(`Task: ${taskId}`);
console.log(`Error: ${error.type || 'unknown'} - ${error.message || 'no message'}`);
console.log(`Retry Count: ${failedTask.retryCount}/3`);
console.log('');

/**
 * Level 1: Retry
 */
if (failedTask.retryCount < 3) {
  failedTask.retryCount++;

  console.log(`🔄 Level 1: RETRY (attempt ${failedTask.retryCount}/3)`);
  console.log('');
  console.log('The agent will retry this task with the same approach.');
  console.log('This may succeed if the error was transient.');
  console.log('');

  // Update task
  failedTask.status = 'pending'; // Reset to pending for retry
  fs.writeFileSync(currentTaskPath, JSON.stringify(currentTask, null, 2));

  // Log
  try {
    execSync(`node .claude/framework/logger.js --event=recovery_started --data='${JSON.stringify({
      task: taskId,
      level: 'retry',
      attempt: failedTask.retryCount
    })}'`, { stdio: 'inherit' });
  } catch (e) {
    // Logger failed, continue
  }

  console.log('✅ Task reset to pending - agent will retry');
  process.exit(0);
}

/**
 * Level 2: Rollback to last checkpoint
 */
console.log('❌ Retry limit exceeded (3 attempts)');
console.log('');
console.log('🔄 Level 2: ROLLBACK to last valid checkpoint');
console.log('');

// Find last valid checkpoint
const checkpointsDir = path.join(process.cwd(), '.claude', 'checkpoints');
const checkpoints = fs.readdirSync(checkpointsDir)
  .filter(f => f.endsWith('.json'))
  .map(f => {
    const checkpoint = JSON.parse(fs.readFileSync(path.join(checkpointsDir, f), 'utf8'));
    return checkpoint;
  })
  .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

if (checkpoints.length === 0) {
  console.error('ERROR: No checkpoints found for rollback');
  console.error('');
  console.error('🔄 Level 3: ESCALATE to human');
  console.error('');
  escalateToHuman();
  process.exit(1);
}

const lastCheckpoint = checkpoints[0];

console.log(`Restoring checkpoint: ${lastCheckpoint.id}`);
console.log(`  Task: ${lastCheckpoint.atomicTaskId}`);
console.log(`  Time: ${lastCheckpoint.timestamp}`);
console.log('');

// Execute rollback
try {
  execSync(`node .claude/framework/checkpoint-manager.js restore --checkpoint-id=${lastCheckpoint.id}`, {
    stdio: 'inherit'
  });

  console.log('');
  console.log('✅ Rollback successful');
  console.log('');
  console.log('The agent will now retry the task with a different approach.');

  process.exit(0);
} catch (rollbackError) {
  console.error('ERROR: Rollback failed');
  console.error('');
  console.error('🔄 Level 3: ESCALATE to human');
  console.error('');
  escalateToHuman();
  process.exit(1);
}

/**
 * Level 3: Escalate to human
 */
function escalateToHuman() {
  // Mark task as blocked
  currentTask.status = 'BLOCKED';
  currentTask.blockedAt = taskId;
  currentTask.blockedReason = error;
  fs.writeFileSync(currentTaskPath, JSON.stringify(currentTask, null, 2));

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('⚠️  HUMAN INTERVENTION REQUIRED');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log(`Task ${taskId} failed after all recovery attempts.`);
  console.log('');
  console.log('Error Details:');
  console.log(`  Type: ${error.type || 'unknown'}`);
  console.log(`  Message: ${error.message || 'no message'}`);
  console.log('');
  console.log('Last Checkpoint:', checkpoints.length > 0 ? checkpoints[0].id : 'none');
  console.log('');
  console.log('Available Options:');
  console.log('  1. Review error and fix manually');
  console.log('  2. /resume-task (retry after manual fix)');
  console.log('  3. /skip-task (mark as blocked, continue with other tasks)');
  console.log('  4. Abandon task');
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Log escalation
  try {
    execSync(`node .claude/framework/logger.js --event=escalate --data='${JSON.stringify({
      task: taskId,
      error: error,
      checkpoint: checkpoints.length > 0 ? checkpoints[0].id : 'none'
    })}' --level=error`, { stdio: 'inherit' });
  } catch (e) {
    // Logger failed, continue
  }
}
