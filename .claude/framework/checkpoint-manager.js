#!/usr/bin/env node
/**
 * Checkpoint Manager for Long Task Execution Framework
 *
 * Creates and restores checkpoints with rich metadata,
 * relying on filesystem snapshots instead of Git.
 *
 * Usage:
 *   node checkpoint-manager.js create --task-id=1.1 --context='{"decisions":"..."}'
 *   node checkpoint-manager.js restore --checkpoint-id=ckpt_xyz
 *   node checkpoint-manager.js list
 */

const fs = require('fs');
const path = require('path');

const projectRoot = process.cwd();
const checkpointsDir = path.join(projectRoot, '.claude', 'checkpoints');
const tasksDir = path.join(projectRoot, '.claude', 'tasks');

// Directories/files we never snapshot or overwrite
const EXCLUDE_PATTERNS = normalizePatterns([
  path.join('.claude', 'checkpoints'),
  '.git',
  'node_modules'
]);

// Parse command
const command = process.argv[2]; // 'create' | 'restore' | 'list'

// Parse arguments
const args = process.argv.slice(3);
const params = {};

args.forEach(arg => {
  const [key, value] = arg.split('=');
  if (key.startsWith('--')) {
    params[key.slice(2)] = value;
  }
});

ensureDir(checkpointsDir);

/**
 * Normalize pattern paths for consistent comparisons.
 */
function normalizePatterns(patterns) {
  return patterns.map(pattern =>
    pattern.split(path.sep).join('/').replace(/\/+$/, '')
  );
}

/**
 * Convert relative path to normalized form.
 */
function normalizeRelPath(relPath) {
  return relPath.split(path.sep).join('/');
}

/**
 * Should a relative path be excluded from snapshot/restore?
 */
function shouldExclude(relPath) {
  if (!relPath) return false;
  const normalized = normalizeRelPath(relPath);
  return EXCLUDE_PATTERNS.some(pattern => {
    return (
      normalized === pattern ||
      normalized.startsWith(`${pattern}/`)
    );
  });
}

/**
 * Ensure directory exists.
 */
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Recursively copy workspace into destination, ignoring excluded paths.
 */
function copyDirectoryContents(srcDir, destDir, relative = '') {
  ensureDir(destDir);
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });

  entries.forEach(entry => {
    const relPath = relative ? `${relative}/${entry.name}` : entry.name;
    if (shouldExclude(relPath)) {
      return;
    }

    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);

    if (entry.isSymbolicLink()) {
      ensureDir(path.dirname(destPath));
      const target = fs.readlinkSync(srcPath);
      fs.symlinkSync(target, destPath);
    } else if (entry.isDirectory()) {
      copyDirectoryContents(srcPath, destPath, relPath);
    } else {
      ensureDir(path.dirname(destPath));
      fs.copyFileSync(srcPath, destPath);
    }
  });
}

/**
 * Remove current workspace contents (except excluded paths).
 */
function cleanWorkspace(dir, relative = '') {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  entries.forEach(entry => {
    const relPath = relative ? `${relative}/${entry.name}` : entry.name;
    if (shouldExclude(relPath)) {
      return;
    }

    const targetPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      cleanWorkspace(targetPath, relPath);
      try {
        fs.rmdirSync(targetPath);
      } catch (error) {
        // Directory not empty (likely contains excluded paths). Ignore.
      }
    } else {
      fs.rmSync(targetPath, { force: true });
    }
  });
}

/**
 * Create a new checkpoint.
 */
function createCheckpoint() {
  // Get current task
  const currentTaskPath = path.join(tasksDir, 'current-task.json');

  if (!fs.existsSync(currentTaskPath)) {
    console.error('ERROR: No active long-task found');
    process.exit(1);
  }

  const currentTask = JSON.parse(fs.readFileSync(currentTaskPath, 'utf8'));

  // Parse context
  let context = {};
  if (params.context) {
    try {
      context = JSON.parse(params.context);
    } catch (error) {
      console.error('ERROR: Invalid JSON in --context parameter');
      process.exit(1);
    }
  }

  // Create checkpoint ID
  const timestamp = Date.now();
  const taskId = params['task-id'] || 'unknown';
  const checkpointId = `ckpt_${currentTask.taskId}_${taskId}_${timestamp}`;

  // Prepare snapshot directories
  const checkpointBaseDir = path.join(checkpointsDir, checkpointId);
  const snapshotDir = path.join(checkpointBaseDir, 'snapshot');

  fs.rmSync(checkpointBaseDir, { recursive: true, force: true });
  ensureDir(snapshotDir);

  // Copy workspace into snapshot
  copyDirectoryContents(projectRoot, snapshotDir);

  // Create checkpoint metadata
  const checkpoint = {
    id: checkpointId,
    timestamp: new Date().toISOString(),
    taskId: currentTask.taskId,
    atomicTaskId: taskId,
    git: {
      commit: null,
      branch: null
    },
    snapshot: {
      path: path.relative(projectRoot, snapshotDir),
      excludes: EXCLUDE_PATTERNS
    },
    context,
    taskState: {
      currentTaskIndex: currentTask.currentTaskIndex,
      completedTasks: currentTask.atomicTasks.filter(t => t.status === 'completed').length,
      totalTasks: currentTask.atomicTasks.length
    }
  };

  // Write checkpoint metadata file
  const checkpointPath = path.join(checkpointsDir, `${checkpointId}.json`);
  fs.writeFileSync(checkpointPath, JSON.stringify(checkpoint, null, 2));

  console.log(`💾 Checkpoint created: ${checkpointId}`);

  // Log event (best effort)
  try {
    const payload = JSON.stringify({
      id: checkpointId,
      task: taskId,
      snapshot: checkpoint.snapshot.path
    });
    require('child_process').execSync(
      `node .claude/framework/logger.js --event=checkpoint_created --data='${payload}'`,
      { stdio: 'inherit' }
    );
  } catch (error) {
    // Logger failure is non-fatal
  }

  // Output checkpoint ID for scripts to consume
  console.log(checkpointId);
  process.exit(0);
}

/**
 * Restore from a checkpoint snapshot.
 */
function restoreCheckpoint() {
  const checkpointId = params['checkpoint-id'];

  if (!checkpointId) {
    console.error('ERROR: --checkpoint-id parameter is required');
    process.exit(1);
  }

  const metadataPath = path.join(checkpointsDir, `${checkpointId}.json`);

  if (!fs.existsSync(metadataPath)) {
    console.error(`ERROR: Checkpoint ${checkpointId} not found`);
    process.exit(1);
  }

  const checkpoint = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
  const snapshotDir = path.join(checkpointsDir, checkpointId, 'snapshot');

  if (!fs.existsSync(snapshotDir)) {
    console.error(`ERROR: Snapshot directory missing for ${checkpointId}`);
    process.exit(1);
  }

  console.log(`⏮️  Restoring checkpoint: ${checkpointId}`);
  console.log(`   Task: ${checkpoint.atomicTaskId}`);
  console.log(`   Time: ${checkpoint.timestamp}`);

  // Clear current workspace state (without touching other checkpoints)
  cleanWorkspace(projectRoot);

  // Copy snapshot back into workspace
  copyDirectoryContents(snapshotDir, projectRoot);
  console.log('✅ Workspace restored from snapshot');

  // Restore task index (current progress)
  const currentTaskPath = path.join(tasksDir, 'current-task.json');
  if (fs.existsSync(currentTaskPath)) {
    const currentTask = JSON.parse(fs.readFileSync(currentTaskPath, 'utf8'));
    currentTask.currentTaskIndex = checkpoint.taskState.currentTaskIndex;
    fs.writeFileSync(currentTaskPath, JSON.stringify(currentTask, null, 2));
    console.log('✅ Task state restored');
  }

  // Log event (best effort)
  try {
    const payload = JSON.stringify({
      to: checkpoint.atomicTaskId,
      checkpoint: checkpointId
    });
    require('child_process').execSync(
      `node .claude/framework/logger.js --event=rollback --data='${payload}'`,
      { stdio: 'inherit' }
    );
  } catch (error) {
    // Logger failure is non-fatal
  }

  console.log('✅ Checkpoint restored successfully');
  process.exit(0);
}

/**
 * List available checkpoints.
 */
function listCheckpoints() {
  const files = fs
    .readdirSync(checkpointsDir)
    .filter(f => f.endsWith('.json'));

  if (files.length === 0) {
    console.log('No checkpoints found');
    process.exit(0);
  }

  console.log(`\n📦 Checkpoints (${files.length} total):\n`);

  files.forEach(file => {
    const checkpoint = JSON.parse(
      fs.readFileSync(path.join(checkpointsDir, file), 'utf8')
    );
    console.log(`  ${checkpoint.id}`);
    console.log(`    Task: ${checkpoint.atomicTaskId}`);
    console.log(`    Time: ${checkpoint.timestamp}`);
    console.log(
      `    Progress: ${checkpoint.taskState.completedTasks}/${checkpoint.taskState.totalTasks} tasks`
    );
    if (checkpoint.snapshot?.path) {
      console.log(`    Snapshot: ${checkpoint.snapshot.path}`);
    }
    console.log('');
  });

  process.exit(0);
}

// Execute command
switch (command) {
  case 'create':
    createCheckpoint();
    break;
  case 'restore':
    restoreCheckpoint();
    break;
  case 'list':
    listCheckpoints();
    break;
  default:
    console.error('ERROR: Invalid command. Use: create | restore | list');
    process.exit(1);
}
