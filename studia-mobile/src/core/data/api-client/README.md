# core data api-client

`api-client.ts` — fetch wrapper stub (base URL from `EXPO_PUBLIC_API_URL`, timeout, typed
`AppError`s, ready for an auth token). Not called by any repository yet; swapping a mock
repository for the real API means calling `apiRequest` from its implementation file only.
