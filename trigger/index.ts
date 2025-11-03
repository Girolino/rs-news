/**
 * Trigger.dev Tasks Index
 *
 * Este arquivo exporta todas as tasks do Trigger.dev.
 * O CLI do Trigger.dev automaticamente descobre todas as tasks exportadas deste arquivo.
 */

// Exporta as tasks
export { newsOrchestratorTask } from "./orchestrator.task";
export { newsSenderTask } from "./sender.task";
export { newsDailyReportTask } from "./monitoring.task";

// Exporta os tipos para uso externo
export type {
  OrchestratorInput,
  OrchestratorOutput,
  SenderInput,
  SenderOutput,
} from "./types";
