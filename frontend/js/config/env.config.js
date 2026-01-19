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
};