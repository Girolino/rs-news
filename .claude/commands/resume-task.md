---
description: Resume a paused or blocked long task execution
---

# Resume Task

Resume execution of a paused or blocked long task.

## Check for Task

Read `.claude/tasks/current-task.json`

If file doesn't exist:
```
📭 No task to resume

Use /start-long-task to begin a new task.
```

## Check Status

Valid states for resume:
- PAUSED (user paused)
- BLOCKED (error occurred, user fixed it)

If status === 'EXECUTING':
```
⚠️  Task is already executing

Use /task-status to see progress.
```

If status === 'COMPLETED':
```
✅ Task is already completed

Use /start-long-task to begin a new task.
```

## Prepare Resume

### If PAUSED:

1. Show resume info:
```
🔄 Resuming paused task

Task: {description}
Paused at: Task {pausedAtTask.id}
Progress: {completedTasks}/{totalTasks} tasks
Time elapsed: {elapsed}
```

### If BLOCKED:

1. Show blocked info:
```
🔄 Resuming blocked task

Task: {description}
Blocked at: Task {blockedAt}
Error: {blockedReason.message}

⚠️  Make sure you've fixed the issue before resuming!

Last checkpoint: {checkpoint.id}
```

2. Ask user to confirm they've fixed the issue

## Update Task Status

Update `.claude/tasks/current-task.json`:
```json
{
  ...
  "status": "EXECUTING",
  "resumedAt": "{ISO-8601 timestamp}",
  "resumeCount": "{previous + 1}"
}
```

If previously BLOCKED, reset the failed task:
```json
{
  ...
  "atomicTasks": [
    ...
    {
      "id": "{blocked task id}",
      "status": "pending",  // Reset to pending
      "retryCount": 0       // Reset retry count
    }
  ]
}
```

## Log Event

Run:
```bash
node .claude/framework/logger.js \
  --event=task_resumed \
  --data='{"taskId":"{task-id}","resumedFrom":"{previous status}"}'
```

## Reinvoke Agent

Use the Task tool to invoke the `long-task-orchestrator` agent:

Prompt:
```
Resume execution of the long task defined in .claude/tasks/current-task.json

The task was {previously paused/blocked}. Continue from where it left off.

Current progress: {completedTasks}/{totalTasks} tasks completed
Next task: {nextTask.id} - {nextTask.description}

Follow the long-task-execution skill protocol strictly.
```

## Notify User

Output:
```
✅ Long task resumed

Task: {description}
Status: EXECUTING
Progress: {completedTasks}/{totalTasks} tasks
Next task: {nextTask.id} - {nextTask.description}

🤖 Agent: long-task-orchestrator (executing...)

Monitor with:
- /task-status (show progress)
- /pause-task (pause again if needed)

Execution continues...
```

## From Checkpoint

If user wants to resume from a specific checkpoint instead of current state:

1. List available checkpoints:
```bash
node .claude/framework/checkpoint-manager.js list
```

2. Ask user which checkpoint to restore

3. Restore checkpoint:
```bash
node .claude/framework/checkpoint-manager.js restore \
  --checkpoint-id={selected checkpoint}
```

4. Then resume as normal

## Example: Resume from Blocked

```
User: /resume-task

Output:
🔄 Resuming blocked task

Task: Execute Sprint 1
Blocked at: Task 1.5 - Unsaved changes warning
Error: TypeScript type error in use-unsaved-warning.ts

⚠️  Have you fixed the error? (yes/no)

User: yes

✅ Long task resumed

Task: Execute Sprint 1
Status: EXECUTING
Progress: 4/19 tasks
Next task: 1.5 - Unsaved changes warning (retry)

🤖 Agent: long-task-orchestrator (executing...)

The agent will retry task 1.5 with your fixes.
```

## Notes

- Resuming changes status back to 'EXECUTING', which reactivates hooks
- The agent continues from the next pending task
- If a task was blocked, it's reset to pending with retryCount=0
- All checkpoints remain available for rollback if needed
