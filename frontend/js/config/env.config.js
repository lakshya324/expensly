export const API_BASE = "http://localhost:3000/api";
export const WS_BASE = "ws://localhost:3000";

export const INDEXED_DB_CONFIG ={
    name: "ExpenslyDB",
    version: 1,
}

export const SESSION_KEYS = {
    user: "expensly_user_session",
    draft: "expensly_draft_expense",
}

export const LOCAL_KEYS = {
    userPreference: "expensly_user_preference",
    budgetData: "expensly_budget_data",
}

export const DEPARTMENTS = [
    "Finance",
    "HR",
    "IT",
    "Sales",
    "Marketing",
    "Operations",
];

export const WS_CONFIG = {
    maxReconnectAttempts: 5,
    reconnectDelay: 3000,
    heartbeatInterval: 15000,
    backoffFactor: 1.5,
};

export const LP_CONFIG = {
    pollInterval: 35000,
    maxPollAttempts: 12,
};

export const SP_CONFIG = {
    initialInterval: 5000,
    maxInterval: 60000,
    backoffFactor: 2,
    requestTimeout: 4000,
};