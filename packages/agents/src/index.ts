import { PROTOCOL_VERSION } from '@openscut/core';

export const DEMO_SCENARIOS_VERSION = `scut/v${PROTOCOL_VERSION}/demo`;

export {
  SCENARIOS,
  revealScriptFromScenarios,
  type Scenario,
  type ScenarioTurn,
  type Role,
} from './scenarios.js';
export {
  startDemoStack,
  runAllScenarios,
  runScenario,
  type DemoAgent,
  type DemoHandles,
  type DemoConfig,
} from './orchestrator.js';
