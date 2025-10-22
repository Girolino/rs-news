---
name: {{LIB_ID}}-docs
description: Query and manage local {{LIB_DISPLAY_NAME}} documentation mirror. Search {{LIB_DISPLAY_NAME}} topics for [key features]. Use when implementing {{LIB_DISPLAY_NAME}} features or answering {{LIB_DISPLAY_NAME}}-related questions. (user)
---

# {{LIB_DISPLAY_NAME}} Documentation Skill

Query local {{LIB_DISPLAY_NAME}} documentation covering [core topics].

## Overview

This skill provides access to a complete local mirror of {{LIB_DISPLAY_NAME}} documentation. The documentation is structured, indexed, and optimized for AI/LLM consumption.

## Documentation Structure

```
docs/libs/{{LIB_ID}}/
├── _index.md              # Navigation index
├── _meta.json             # Metadata
├── README.md              # Overview
├── getting-started/       # Getting started
├── core-concepts/         # Core concepts
└── api-reference/         # API docs
```

## Core Concepts

### 1. Concept Name
Location: `docs/libs/{{LIB_ID}}/core-concepts/concept.md`
- Description of the concept
- How it works
- When to use it

### 2. Another Concept
Location: `docs/libs/{{LIB_ID}}/core-concepts/another.md`
- Description
- Usage patterns

## Usage Protocol

### When to Activate

Use this skill when:
1. User asks about {{LIB_DISPLAY_NAME}} implementation
2. Questions about [key feature]
3. Need to integrate {{LIB_DISPLAY_NAME}}
4. Troubleshooting {{LIB_DISPLAY_NAME}} issues

### Search Strategy

1. **Check Navigation First**
   ```bash
   Read: docs/libs/{{LIB_ID}}/_index.md
   Purpose: See all available documentation
   ```

2. **Section-Based Search**
   - Getting Started: `docs/libs/{{LIB_ID}}/getting-started/`
   - Core Concepts: `docs/libs/{{LIB_ID}}/core-concepts/`
   - API Reference: `docs/libs/{{LIB_ID}}/api-reference/`

3. **Specific Queries**
   ```bash
   # Getting started
   Read: docs/libs/{{LIB_ID}}/getting-started/introduction.md

   # Core concept
   Read: docs/libs/{{LIB_ID}}/core-concepts/[topic].md

   # API reference
   Read: docs/libs/{{LIB_ID}}/api-reference/[function].md
   ```

## Common Queries

### "How do I get started with {{LIB_DISPLAY_NAME}}?"
1. Read `docs/libs/{{LIB_ID}}/getting-started/introduction.md`
2. Read `docs/libs/{{LIB_ID}}/getting-started/installation.md`
3. Provide setup steps with code examples

### "How do I [specific task]?"
1. Read relevant section based on task
2. Show implementation patterns
3. Provide code examples

## Response Format

When answering {{LIB_DISPLAY_NAME}} questions:

1. **Start with Context**
   - Briefly explain the concept
   - Reference the source doc

2. **Provide Code Examples**
   - Show practical implementation
   - Include TypeScript types if applicable
   - Demonstrate best practices

3. **Cite Sources**
   - Format: `docs/libs/{{LIB_ID}}/[section]/[file].md`
   - Include line numbers if relevant

4. **Related Topics**
   - Link to related documentation
   - Suggest next steps

## Key {{LIB_DISPLAY_NAME}} Features

- Feature 1: Description
- Feature 2: Description
- Feature 3: Description

## Example Response

```
User: "How do I [specific task] with {{LIB_DISPLAY_NAME}}?"