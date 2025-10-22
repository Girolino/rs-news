---
description: Pause the currently executing long task
---

# Pause Task

Pause the current long task execution safely.

## Check for Active Task

Read `.claude/tasks/current-task.json`

If file doesn't exist:
```
📭 No active long task to pause
```

If status !== 'EXECUTING':
```
⚠️  Task is not currently executing (status: {status})

Cannot pause.
```

## Create Checkpoint Before Pausing

Run:
```bash
node .claude/framework/checkpoint-manager.js create \
  --task-id=pause \
  --context='{"phase":"pause","reason":"user requested"}'
```

This ensures no work is lost.

## Update Task Status

Update `.claude/tasks/current-task.json`:
```json
{
  ...
  "status": "PAUSED",
  "pausedAt": "{ISO-8601 timestamp}",
  "pausedAtTask": "{currentTaskIndex}"
}
```

## Log Event

Run:
```bash
node .claude/framework/logger.js \
  --event=task_paused \
  --data='{"taskId":"{task-id}","pausedAt":"{task.id}"}'
```

## Notify User

Output:
```
⏸️  Long task paused

Task: {description}
Paused at: Task {currentTask.id} - {currentTask.description}
Progress: {completedTasks}/{totalTasks} tasks completed

💾 Checkpoint created: {checkpoint.id}

The task has been safely paused. No work will be lost.

To resume:
  /resume-task

To check status:
  /task-status
```

## Notes

- Pausing changes status to 'PAUSED', which deactivates hooks
- The agent will naturally stop after the current atomic task completes
- All work is checkpointed before pausing
- Task can be resumed at any time with /resume-task
