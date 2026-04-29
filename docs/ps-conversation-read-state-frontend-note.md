# PS Conversation Read-State Frontend Note

## Summary
Backend now provides authoritative, cross-device conversation unread state for PS inbox.
Frontend should trust backend fields and remove local viewed-state memory logic.

## Updated Conversation Fields (`GET /api/ps/conversations`)
- `lastReadAt: string | null`
- `hasUnread: boolean`
- Existing latest-event fields remain available (`lastEventAt`, `lastEventActorId`, `lastEventType`, `lastEventText`, `lastEventPayload`).

## Backend Unread Semantics
`hasUnread` is true only when all are true:
- `lastEventAt` exists
- `lastEventActorId !== currentUserId`
- `lastReadAt` is null, or `lastEventAt > lastReadAt`

This means outgoing latest events are never unread for sender.

## New Mark-Read API
- `POST /api/ps/conversations/:conversationId/read`
- Auth + participant required
- Idempotent
- Backend stores `lastReadAt` as `conversation.lastEventAt` snapshot (or now if no event exists)
- Response shape:
  - `conversationId`
  - `lastReadAt`
  - `hasUnread: false`

## Frontend Migration Steps
1. Remove local viewed-state fallback logic for PS conversation highlights.
2. Use `hasUnread` directly to render inbox highlight.
3. On opening a thread, call `POST /api/ps/conversations/:conversationId/read`.
4. Refresh/reload inbox from server state after mark-read flow.
5. Keep existing sort behavior as-is (do not sort by read status).

## Defensive Fallback (Temporary)
If `hasUnread` is unexpectedly missing during rollout, compute fallback:
- `Boolean(lastEventAt && lastEventActorId !== me && (!lastReadAt || lastEventAt > lastReadAt))`

## Acceptance Validation
- Marking read on one device clears unread on another after next fetch.
- Pull-to-refresh does not re-introduce cleared highlights.
- New incoming event after read flips `hasUnread` back to true.
