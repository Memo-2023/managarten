/**
 * @mana/shared-ai
 *
 * AI Workbench code that both the webapp (SvelteKit/Vite) and the
 * server-side mana-ai service (Bun) import. Keep this package free of
 * runtime imports from storage layers (Dexie, Postgres) — the types +
 * pure functions here must work in both environments.
 */

export type {
	Actor,
	ActorKind,
	BaseActor,
	UserActor,
	AiActor,
	SystemActor,
	SystemSource,
} from './actor';
export {
	SYSTEM_PROJECTION,
	SYSTEM_RULE,
	SYSTEM_MIGRATION,
	SYSTEM_STREAM,
	SYSTEM_MISSION_RUNNER,
	SYSTEM_BOOTSTRAP,
	SYSTEM_ARTICLES_IMPORT_WORKER,
	LEGACY_USER_PRINCIPAL,
	LEGACY_AI_PRINCIPAL,
	LEGACY_SYSTEM_PRINCIPAL,
	LEGACY_DISPLAY_NAME,
	USER_ACTOR,
	makeUserActor,
	makeAgentActor,
	makeSystemActor,
	normalizeActor,
	isUserActor,
	isAiActor,
	isSystemActor,
	isFromMissionRunner,
} from './actor';

export type { FieldMeta, FieldOrigin } from './field-meta';
export { makeFieldMeta, isUserOriginatedField, originFromActor } from './field-meta';

export type {
	IterationPhase,
	Mission,
	MissionCadence,
	MissionInputRef,
	MissionIteration,
	MissionState,
	PlanStep,
	GrantDerivation,
	GrantDerivationVersion,
	MissionGrant,
} from './missions';
export {
	GRANT_DERIVATION_VERSION,
	canonicalInfoString,
	deriveMissionDataKey,
	deriveMissionDataKeyRaw,
} from './missions';

export type {
	AiPlanInput,
	AiPlanOutput,
	AvailableTool,
	ChatMessage,
	ChatRole,
	ExecutedCall,
	LlmClient,
	LlmCompletionRequest,
	LlmCompletionResponse,
	LlmFinishReason,
	LoopState,
	LoopStopReason,
	ParseResult,
	PlannedStep,
	PlannerLoopInput,
	PlannerLoopResult,
	PlannerMessages,
	ReminderChannel,
	ResolvedInput,
	SystemPromptInput,
	SystemPromptOutput,
	TokenUsage,
	ToolCallRequest,
	ToolResult,
} from './planner';
export {
	buildPlannerPrompt,
	buildSystemPrompt,
	compactHistory,
	COMPACT_SYSTEM_PROMPT,
	DEFAULT_COMPACT_KEEP_RECENT,
	DEFAULT_COMPACT_MODEL,
	DEFAULT_COMPACT_THRESHOLD,
	createTaskToolHandler,
	MAX_SUB_AGENT_DEPTH,
	MockLlmClient,
	parseCompactSummary,
	parsePlannerResponse,
	renderCompactSummary,
	runPlannerLoop,
	runSubAgent,
	shouldCompact,
	SubAgentRecursionError,
	TASK_TOOL_NAME,
	TASK_TOOL_SCHEMA,
} from './planner';
export type {
	CompactHistoryOptions,
	CompactHistoryResult,
	CompactSummary,
	RunSubAgentInput,
	SubAgentResult,
	SubAgentType,
	TaskToolHandler,
	TaskToolHandlerOptions,
} from './planner';

export {
	AI_PROPOSABLE_TOOL_NAMES,
	AI_PROPOSABLE_TOOL_SET,
	type AiProposableToolName,
	type AiPolicy,
	type PolicyDecision,
} from './policy';

export type {
	FunctionSpec,
	JsonSchemaObject,
	JsonSchemaProperty,
	ToolSchema,
	ToolSpec,
} from './tools';
export {
	AI_TOOL_CATALOG,
	AI_TOOL_CATALOG_BY_NAME,
	toolToFunctionSchema,
	toolsToFunctionSchemas,
} from './tools';

export type {
	Guardrail,
	GuardrailPhase,
	GuardrailResult,
	GuardrailCheckResult,
} from './guardrails';
export {
	BUILTIN_GUARDRAILS,
	runPrePlanGuardrails,
	runPostPlanGuardrails,
	runPreExecuteGuardrails,
} from './guardrails';

export type {
	Agent,
	AgentState,
	AgentTemplate,
	AgentTemplateAgentPart,
	AgentTemplateScenePart,
	AgentTemplateSceneApp,
	AgentTemplateMissionPart,
	WorkbenchTemplate,
	WorkbenchTemplateAgentPart,
	WorkbenchTemplateScenePart,
	WorkbenchTemplateSceneApp,
	WorkbenchTemplateMissionPart,
	WorkbenchTemplateSeedItem,
	WorkbenchTemplateCategory,
} from './agents';
export { DEFAULT_AGENT_ID, DEFAULT_AGENT_NAME, ALL_TEMPLATES, getTemplateById } from './agents';

export { MANA_LLM, type ManaLlmAlias } from './llm-aliases';
