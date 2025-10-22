---
description: Start a long-running task execution with automatic checkpointing, validation, and recovery
---

# Start Long Task

You are starting a long task execution using the Long Task Execution Framework.

## Step 1: Get Task Description

Ask the user for the task description if not already provided. Accept:
- Direct description: "Execute Sprint 1"
- File reference: "Execute Sprint 1 from docs/llm-guide/post-editor-ux-improvements.md"
- Task definition file path: ".claude/tasks/my-task.json"

## Step 2: Parse and Decompose Task

If the user provided a file reference:
1. Read the source document
2. Extract the relevant section (e.g., Sprint 1 Implementation Checklists)
3. Decompose into atomic tasks (<10 min each)

If the user provided a direct description:
1. Decompose the task into atomic sub-tasks
2. Each atomic task must have:
   - id (e.g., "1.1", "1.2", etc)
   - description (clear, actionable)
   - estimatedTime (< 10min)
   - dependencies (array of task ids)

## Step 3: Create Task Definition

Create `.claude/tasks/current-task.json`:

```json
{
  "taskId": "{task-name}-{timestamp}",
  "description": "User provided description",
  "source": "path/to/source/doc.md (if applicable)",
  "status": "EXECUTING",
  "startTime": "{ISO-8601 timestamp}",
  "estimatedDuration": "{X}h",
  "currentTaskIndex": 0,
  "atomicTasks": [
    {
      "id": "1.1",
      "description": "First atomic task",
      "estimatedTime": "8min",
      "status": "pending",
      "dependencies": [],
      "retryCount": 0
    },
    {
      "id": "1.2",
      "description": "Second atomic task",
      "estimatedTime": "10min",
      "status": "pending",
      "dependencies": ["1.1"],
      "retryCount": 0
    }
    // ... more atomic tasks
  ]
}
```

## Step 4: Create Initial Checkpoint

Run:
```bash
node .claude/framework/checkpoint-manager.js create \
  --task-id=init \
  --context='{"phase":"initialization","totalTasks":N}'
```

## Step 5: Log Start Event

Run:
```bash
node .claude/framework/logger.js \
  --event=long_task_started \
  --data='{"taskId":"{task-id}","estimatedDuration":"{X}h"}'
```

## Step 6: Invoke Long Task Orchestrator

Use the Task tool to invoke the `long-task-orchestrator` agent:

Prompt:
```
Execute the long task defined in .claude/tasks/current-task.json

Follow the long-task-execution skill protocol strictly:
- Execute atomic tasks sequentially
- Validate after each task
- Create checkpoints automatically
- Use recovery protocol on failures
- Generate final report when complete

Task: {task description}
Estimated Duration: {X}h
Total Atomic Tasks: {N}
```

## Step 7: Inform User

Output:
```
🚀 Long task started: {task description}

📊 Task Details:
- Task ID: {task-id}
- Total atomic tasks: {N}
- Estimated duration: {X}h
- Source: {source file if applicable}

📁 Task file: .claude/tasks/current-task.json
💾 Initial checkpoint: created

🤖 Agent: long-task-orchestrator (executing...)

You can monitor progress with:
- /task-status (show current progress)
- /pause-task (pause execution)

Logs: .claude/state/execution-log.jsonl
Checkpoints: .claude/checkpoints/
```

## Example

User input: "Execute Sprint 1 from docs/llm-guide/post-editor-ux-improvements.md"

You would:
1. Read docs/llm-guide/post-editor-ux-improvements.md
2. Find Sprint 1 section
3. Extract 19 atomic tasks from checklist
4. Create current-task.json with all 19 tasks
5. Create initial checkpoint
6. Log start event
7. Invoke long-task-orchestrator agent
8. Output confirmation to user

## Error Handling

If task definition is invalid:
- Missing atomic tasks → Ask user to provide or help decompose
- Tasks > 10min → Ask user to break down further
- No clear description → Ask for clarification

If source file not found:
- Show error with exact path tried
- Ask user to verify path

## Notes

- This command creates `.claude/tasks/current-task.json` which acts as a "feature flag"
- While this file exists with status='EXECUTING', hooks are active
- When task completes, status changes to 'COMPLETED' (or file is deleted)
- Only ONE long task can run at a time
