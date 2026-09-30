import { ActionPlan, ToolCall, ToolResult } from './schemas';

export type MessageType = 
    | 'RUN_AGENT_TASK'
    | 'EXECUTE_ACTION_PLAN'
    | 'ACTION_PROGRESS'
    | 'ACTION_RESULT'
    | 'AGENT_STATUS'
    | 'REQUEST_DOM_SNAPSHOT'
    | 'DOM_SNAPSHOT_RESULT'
    | 'EXECUTE_TOOL';

export interface RunAgentTaskMsg {
    type: 'RUN_AGENT_TASK';
    payload: { prompt: string };
}

export interface ExecuteActionPlanMsg {
    type: 'EXECUTE_ACTION_PLAN';
    payload: ActionPlan;
}

export interface ActionProgressMsg {
    type: 'ACTION_PROGRESS';
    payload: {
        planId: string;
        stepIndex: number;
        status: string;
    };
}

export interface ActionResultMsg {
    type: 'ACTION_RESULT';
    payload: {
        planId: string;
        status: 'SUCCESS' | 'FAILURE' | 'CANCELLED';
        completedSteps: number;
        error?: string;
    };
}

export interface RequestDomSnapshotMsg {
    type: 'REQUEST_DOM_SNAPSHOT';
}

export interface DomSnapshotResultMsg {
    type: 'DOM_SNAPSHOT_RESULT';
    payload: {
        elements: Array<any>;
        sensitiveNodes?: Array<any>;
        viewport?: { width: number, height: number };
    };
}

export interface ExecuteToolMsg {
    type: 'EXECUTE_TOOL';
    payload: ToolCall;
}

export type AnyMessage = RunAgentTaskMsg | ExecuteActionPlanMsg | ActionProgressMsg | ActionResultMsg | RequestDomSnapshotMsg | DomSnapshotResultMsg | ExecuteToolMsg;
