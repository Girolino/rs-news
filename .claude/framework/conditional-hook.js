#!/usr/bin/env node
/**
 * Conditional Hook for Long Task Execution Framework
 *
 * Acts as a "feature flag" - hooks are always configured but only execute
 * when a long-task is active (.claude/tasks/current-task.json exists with status='EXECUTING')
 *
 * Hook types:
 *   - validate-ts: TypeScript validation (quick in dev, full in long-task)
 *   - checkpoint: Create checkpoint after task completion
 *   - final-validation: Full validation at task end
 *
 * Usage:
 *   node conditional-hook.js validate-ts
 *   node conditional-hook.js checkpoint
 *   node conditional-hook.js final-validation
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const hookType = process.argv[2];

if (!hookType) {
  console.error('ERROR: Hook type parameter is required');
  console.error('Usage: node conditional-hook.js [validate-ts|checkpoint|final-validation]');
  process.exit(1);
}

/**
 * Check if long-task is active
 */
function isLongTaskActive() {
  const taskPath = path.join(process.cwd(), '.claude', 'tasks', 'current-task.json');

  if (!fs.existsSync(taskPath)) {
    return false;
  }

  try {
    const task = JSON.parse(fs.readFileSync(taskPath, 'utf8'));
    return task.status === 'EXECUTING';
  } catch (error) {
    return false;
  }
}

/**
 * Hook: validate-ts
 */
function handleValidateTs() {
  const active = isLongTaskActive();

  if (!active) {
    // In normal development: quick TypeScript check
    console.log('🔍 Quick TypeScript check (dev mode)...');
    try {
      execSync('npx tsc --noEmit --skipLibCheck 2>&1 | head -10', { stdio: 'inherit' });
    } catch (error) {
      // Show error but don't fail the hook (allow editing with errors in dev)
      console.log('⚠️  TypeScript errors detected (non-blocking in dev mode)');
    }
    process.exit(0);
  }

  // In long-task execution: full validation
  console.log('🔍 Full validation (long-task mode)...');
  try {
    execSync('bash .claude/framework/validation-gate.sh atomic', { stdio: 'inherit' });
    process.exit(0);
  } catch (error) {
    console.error('❌ Validation failed');
    process.exit(1);
  }
}

/**
 * Hook: checkpoint
 */
function handleCheckpoint() {
  const active = isLongTaskActive();

  if (!active) {
    console.log('⏭️  Skipping checkpoint (no active long-task)');
    process.exit(0);
  }

  console.log('💾 Creating checkpoint...');
  try {
    // Note: checkpoint-manager.js will read current-task.json to get context
    execSync('node .claude/framework/checkpoint-manager.js create --task-id=auto', {
      stdio: 'inherit'
    });
    process.exit(0);
  } catch (error) {
    console.error('⚠️  Checkpoint creation failed (non-critical)');
    // Don't fail the hook - checkpoints are important but not critical
    process.exit(0);
  }
}

/**
 * Hook: final-validation
 */
function handleFinalValidation() {
  const active = isLongTaskActive();

  if (!active) {
    console.log('⏭️  Skipping final validation (no active long-task)');
    process.exit(0);
  }

  console.log('🎯 Final validation...');
  try {
    execSync('bash .claude/framework/validation-gate.sh final', { stdio: 'inherit' });
    process.exit(0);
  } catch (error) {
    console.error('❌ Final validation failed');
    process.exit(1);
  }
}

// Execute appropriate handler
switch (hookType) {
  case 'validate-ts':
    handleValidateTs();
    break;

  case 'checkpoint':
    handleCheckpoint();
    break;

  case 'final-validation':
    handleFinalValidation();
    break;

  default:
    console.error(`ERROR: Unknown hook type: ${hookType}`);
    console.error('Valid types: validate-ts, checkpoint, final-validation');
    process.exit(1);
}
