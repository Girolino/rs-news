---
description: Show current progress of active long task execution
---

# Task Status

Display real-time status of the currently executing long task.

## Check for Active Task

Read `.claude/tasks/current-task.json`

If file doesn't exist:
```
📭 No active long task

Use /start-long-task to begin a new task.
```

## Read Task State

Parse current-task.json and extract:
- taskId
- description
- status
- startTime
- estimatedDuration
- currentTaskIndex
- atomicTasks array

## Calculate Progress

```javascript
const completedTasks = atomicTasks.filter(t => t.status === 'completed').length
const inProgressTasks = atomicTasks.filter(t => t.status === 'in_progress').length
const pendingTasks = atomicTasks.filter(t => t.status === 'pending').length
const totalTasks = atomicTasks.length

const progressPercent = Math.round((completedTasks / totalTasks) * 100)
```

## Calculate Time

```javascript
const elapsed = now - startTime
const estimatedRemaining = estimatedDuration - elapsed
```

## Find Current Task

```javascript
const currentTask = atomicTasks[currentTaskIndex]
```

## Get Recent Events

Read last 5 lines from `.claude/state/execution-log.jsonl`:
```bash
tail -5 .claude/state/execution-log.jsonl
```

## Get Last Checkpoint

List checkpoints and get most recent:
```bash
ls -t .claude/checkpoints/*.json | head -1
```

## Display Status

Output:
```
🎯 Long Task: {description}

Progress: {progress bar} {progressPercent}% ({completedTasks}/{totalTasks} tasks)

⏱️  Time: {elapsed} elapsed / {estimatedDuration} estimated
⏳ Remaining: ~{estimatedRemaining}

📍 Current Task: {currentTask.id} - {currentTask.description}
🤖 Agent: long-task-orchestrator
📊 Status: {status}

✅ Completed: {completedTasks} tasks
🔄 In Progress: {inProgressTasks} tasks
⏸️  Pending: {pendingTasks} tasks

💾 Last Checkpoint: {checkpoint.id} ({time ago})
📊 Total Checkpoints: {checkpoint count}

🔍 Validation: {recent validation results}

📝 Recent Events (last 5):
- {event 1}
- {event 2}
- {event 3}
- {event 4}
- {event 5}

Commands:
- /task-status      (refresh status)
- /pause-task       (pause execution)
- /resume-task      (resume if paused)
```

## Progress Bar

Create visual progress bar:
```
Progress: ████████████░░░░░░░░ 63% (12/19 tasks)
```

## Time Formatting

Format times human-readable:
- 3723 seconds → "1h 2min"
- 185 seconds → "3min 5s"

## Example Output

```
🎯 Long Task: Execute Sprint 1 - Performance & Missing Features

Progress: ████████████░░░░░░░░ 63% (12/19 tasks)

⏱️  Time: 2h 14min elapsed / 3h 30min estimated
⏳ Remaining: ~1h 16min

📍 Current Task: 1.13 - Table support implementation
🤖 Agent: tiptap-editor-specialist (delegated)
📊 Status: EXECUTING

✅ Completed: 12 tasks
🔄 In Progress: 1 task
⏸️  Pending: 6 tasks

💾 Last Checkpoint: ckpt_sprint-1_1.12_1729615120 (3min ago)
📊 Total Checkpoints: 13

🔍 Validation: ✅ ✅ ✅ (all passing)

📝 Recent Events (last 5):
- 14:32 - atomic_task_completed: 1.12 (9min)
- 14:32 - checkpoint_created: ckpt_sprint-1_1.12
- 14:25 - atomic_task_completed: 1.11 (11min)
- 14:25 - checkpoint_created: ckpt_sprint-1_1.11
- 14:18 - recovery_success: 1.11 (retry attempt 1)

Commands:
- /task-status      (refresh status)
- /pause-task       (pause execution)
```

## If Task is BLOCKED

If status === 'BLOCKED':
```
⚠️  Long Task: {description}

Status: BLOCKED at task {blockedAt}

Error:
  Type: {blockedReason.type}
  Message: {blockedReason.message}

Last Checkpoint: {checkpoint.id}

Options:
1. Review error and fix manually
2. /resume-task (retry after manual fix)
3. /skip-task (mark as blocked, continue)
4. Abandon task

Use /resume-task when ready to continue.
```

## If Task is COMPLETED

If status === 'COMPLETED':
```
✅ Long Task COMPLETED: {description}

Duration: {actualDuration} (estimated: {estimatedDuration})
Tasks: {completedTasks}/{totalTasks} completed
Checkpoints: {checkpoint count}
Recovery Events: {recovery count}

📄 Report: {report path}

Next Steps:
- Review report for details
- Start next task with /start-long-task
```

## Error Handling

If current-task.json exists but is malformed:
```
⚠️  Error reading task file

File: .claude/tasks/current-task.json
Error: Invalid JSON or missing required fields

Please check the file or start a new task with /start-long-task
```
