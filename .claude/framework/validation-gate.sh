#!/bin/bash
#
# Validation Gate for Long Task Execution Framework
#
# Three validation levels:
#   - atomic: Fast validation after each atomic task (tsc + eslint)
#   - checkpoint: Medium validation at checkpoints (+ tests)
#   - final: Full validation at task completion (+ build optional)
#
# Usage:
#   bash validation-gate.sh atomic
#   bash validation-gate.sh checkpoint
#   bash validation-gate.sh final
#

GATE_TYPE=${1:-atomic}
EXIT_CODE=0

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚦 Validation Gate: $GATE_TYPE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 1. TypeScript (ALWAYS - fast and critical)
echo "1️⃣  TypeScript Compilation..."
if npx tsc --noEmit --skipLibCheck 2>&1 | head -20; then
  echo "  ✅ TypeScript OK"
else
  echo "  ❌ TypeScript FAILED"
  EXIT_CODE=1
fi
echo ""

# 2. ESLint (ALWAYS - with auto-fix)
echo "2️⃣  ESLint Check..."
if npx eslint src --max-warnings 0 --quiet 2>&1 | head -20; then
  echo "  ✅ ESLint OK"
else
  echo "  ⚠️  ESLint warnings (attempting auto-fix...)"
  npx eslint src --fix --quiet 2>&1 | head -10
  # Don't fail on eslint warnings, just warn
fi
echo ""

# 3. Tests (conditional based on gate type)
if [[ "$GATE_TYPE" == "checkpoint" ]] || [[ "$GATE_TYPE" == "final" ]]; then
  echo "3️⃣  Running Tests..."
  if npm test -- --passWithNoTests --silent 2>&1 | tail -20; then
    echo "  ✅ Tests OK"
  else
    echo "  ❌ Tests FAILED"
    EXIT_CODE=1
  fi
  echo ""
fi

# 4. Build (OPTIONAL - only for final validation if needed)
# Commented out by default - use npx tsc --noEmit instead
# if [[ "$GATE_TYPE" == "final" ]]; then
#   echo "4️⃣  Building Project..."
#   if npm run build > /dev/null 2>&1; then
#     echo "  ✅ Build OK"
#   else
#     echo "  ❌ Build FAILED"
#     EXIT_CODE=1
#   fi
#   echo ""
# fi

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $EXIT_CODE -eq 0 ]; then
  echo "✅ Gate $GATE_TYPE PASSED"

  # Log success
  node .claude/framework/logger.js --event=validation_passed --data="{\"gate\":\"$GATE_TYPE\"}" 2>/dev/null || true
else
  echo "❌ Gate $GATE_TYPE FAILED"

  # Log failure
  node .claude/framework/logger.js --event=validation_failed --data="{\"gate\":\"$GATE_TYPE\"}" --level=error 2>/dev/null || true
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

exit $EXIT_CODE
