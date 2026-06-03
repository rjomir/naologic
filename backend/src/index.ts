import { ReflowService } from './reflow/reflow.service.js';
import { validateSchedule } from './reflow/constraint-checker.js';
import { scenario1 } from './data/scenario1.js';
import { scenario2 } from './data/scenario2.js';
import { scenario3 } from './data/scenario3.js';
import type { ReflowInput, ReflowResult } from './types.js';

const service = new ReflowService();

const scenarios: Array<{ name: string; description: string; input: ReflowInput }> = [
  {
    name: 'Scenario 1 – Delay Cascade',
    description: 'WO-001 starts late → cascades through WO-002 and WO-003 across shift boundaries.',
    input: scenario1,
  },
  {
    name: 'Scenario 2 – Shift Boundary + Maintenance Window',
    description:
      'WO-A hits a 2-hour maintenance window mid-shift. WO-B spans overnight. WO-C waits for both.',
    input: scenario2,
  },
  {
    name: 'Scenario 3 – Complex Multi-Constraint',
    description:
      'Dependency chain + different shift schedules + unplanned maintenance + resource conflict.',
    input: scenario3,
  },
];

function printResult(
  name: string,
  description: string,
  input: ReflowInput,
  result: ReflowResult,
): void {
  const divider = '═'.repeat(72);
  const thin = '─'.repeat(72);

  console.log(`\n${divider}`);
  console.log(`  ${name}`);
  console.log(`  ${description}`);
  console.log(divider);

  if (result.changes.length === 0) {
    console.log('  ✓ Schedule is already valid. No changes needed.\n');
    return;
  }

  console.log('\n  CHANGES:');
  for (const c of result.changes) {
    console.log(
      `\n  ${c.workOrderNumber}  (delay: ${c.delayMinutes >= 0 ? '+' : ''}${c.delayMinutes} min)`,
    );
    console.log(`    Before : ${c.originalStartDate}  →  ${c.originalEndDate}`);
    console.log(`    After  : ${c.newStartDate}  →  ${c.newEndDate}`);
    console.log(`    Reason : ${c.reason}`);
  }

  console.log(`\n${thin}`);
  console.log('  VALIDATION:');
  const violations = validateSchedule(result.updatedWorkOrders, input.workCenters);
  if (violations.length === 0) {
    console.log('  ✓ All constraints satisfied');
  } else {
    for (const v of violations) {
      console.log(`  ✗ [${v.type}] ${v.message}`);
    }
  }
  console.log();
}

for (const s of scenarios) {
  try {
    const result = service.reflow(s.input);
    printResult(s.name, s.description, s.input, result);
  } catch (err) {
    console.error(`\n[ERROR] ${s.name}:`, err instanceof Error ? err.message : err);
  }
}
