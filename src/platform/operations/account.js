export const ACCOUNT_OPERATIONS = [
  {
    id: "account.balance",
    command: ["account", "balance"],
    method: "GET",
    path: "/openapi/v2/account/balance",
    bodyMode: "none",
    validationPolicy: "account.balance",
    billing: "read-only",
    asynchronous: false,
    resultIdPath: null,
  },
  {
    id: "account.usage",
    command: ["account", "usage"],
    method: "POST",
    path: "/openapi/v2/account/billing/usage-detail",
    bodyMode: "json",
    validationPolicy: "account.usage",
    billing: "read-only",
    asynchronous: false,
    resultIdPath: null,
  },
];
