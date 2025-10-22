#!/usr/bin/env node
/**
 * Structured Logger for Long Task Execution Framework
 *
 * Logs all events as JSON to .claude/state/execution-log.jsonl
 *
 * Usage:
 *   node logger.js --event=atomic_task_started --data='{"task":"1.1"}'
 *   node logger.js --event=checkpoint_created --data='{"id":"ckpt_xyz"}'
 */

const fs = require('fs');
const path = require('path');

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
if (!params.event) {
  console.error('ERROR: --event parameter is required');
  console.error('Usage: node logger.js --event=EVENT_NAME --data=\'{"key":"value"}\'');
  process.exit(1);
}

// Parse data
let data = {};
if (params.data) {
  try {
    data = JSON.parse(params.data);
  } catch (error) {
    console.error('ERROR: Invalid JSON in --data parameter');
    process.exit(1);
  }
}

// Create log entry
const logEntry = {
  level: params.level || 'info',
  event: params.event,
  time: new Date().toISOString(),
  ...data
};

// Ensure log directory exists
const logDir = path.join(process.cwd(), '.claude', 'state');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Append to log file (JSONL format - one JSON per line)
const logFile = path.join(logDir, 'execution-log.jsonl');
fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n');

// Also output to console for immediate feedback
const emoji = {
  'long_task_started': '🚀',
  'atomic_task_started': '▶️',
  'atomic_task_completed': '✅',
  'checkpoint_created': '💾',
  'validation_passed': '🔍',
  'validation_failed': '❌',
  'recovery_started': '🔄',
  'recovery_success': '✅',
  'rollback': '⏮️',
  'escalate': '⚠️',
  'long_task_completed': '🎉'
}[params.event] || '📝';

console.log(`${emoji} ${params.event}${data.task ? ` (${data.task})` : ''}${data.duration ? ` - ${data.duration}` : ''}`);

process.exit(0);
