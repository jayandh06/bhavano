# Admin Users list page

## Context

Admin currently has no way to browse the full user base — only `GET /admin/users/search` (a
`q`-only typeahead used by `UserPicker`, capped at 25 results, no pagination) and
`/users/[id]` (a single-user activity detail page, linked to only from the logins list). There's
no page to see "who are our users, filtered/sorted, with their welcome-notification status."

This matters right now because this session just did a WhatsApp-welcome backfill
(`docs/plans/whatsapp-welcome-mobile-signups.md`) and discovered, by writing a one-off script, that
34 phone-login users had `welcomedAt` set but **zero** real `UserNotificationLog` rows — the
original send had silently failed for all of them with no way to see that from the admin UI. A
Users list with a real notification-status column makes that kind of gap visible going forward
without needing another one-off script.

**Key design point carried over from that discovery**: "notification status" must be derived from
the `UserNotificationLog` relation (`kind: 'welcome'`), not from `welcomedAt` — `welcomedAt` is set
unconditionally as a dispatch-attempted flag and does not mean the send succeeded.

## 1. `apps/bff/src/admin/dto/list-users.dto.ts` (new)

Mirrors `list-logins.dto.ts`'s exact shape:

```ts
import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import type { UserRole } from '@bhavano/types';

const USER_ROLES: UserRole[] = ['user', 'admin']; // confirmed against schema.prisma:41-44
const USER_SORT_VALUES = ['createdAt_desc', 'createdAt_asc', 'name_asc'] as const;
export type UserSort = (typeof USER_SORT_VALUES)[number];

export class ListUsersDto {
  @IsOptional() @IsString() cursor?: string;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @IsString() q?: string; // name/phone/email contains, case-insensitive
  @IsOptional() @IsIn(USER_ROLES) role?: UserRole;
  @IsOptional() @IsIn(['yes', 'no']) welcomed?: 'yes' | 'no';
  @IsOptional() @IsIn(USER_SORT_VALUES) sort?: UserSort;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit: number = 50;
}
```

## 2. `packages/types/src/index.ts` — new `UserSummaryDto` / `AdminUsersPage`

Follow the existing `{items, nextCursor, total}` page-DTO pattern (see `PageVisitsPage`):

```ts
export interface UserSummaryDto {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  role: UserRole;
  cityName: string | null;
  createdAt: string;
  welcomed: boolean;       // derived: notificationLogs.some(kind: 'welcome')
  welcomedChannel: string | null; // 'whatsapp' | 'email' | null
  welcomedAt: string | null;      // the log's sentAt, not the raw User.welcomedAt flag
}
export interface AdminUsersPage {
  items: UserSummaryDto[];
  nextCursor: string | null;
  total: number;
}
```

Built with `pnpm --filter @bhavano/types build` (per this repo's established `packages/types`
dist-build step — `dist/` is checked in).

## 3. `AdminService.listUsers()` (`apps/bff/src/admin/admin.service.ts`)

Same `Promise.all([findMany, count])` cursor pattern as `listRecentLogins()`:

```ts
async listUsers(query: ListUsersDto): Promise<AdminUsersPage> {
  const { cursor, from, to, q, role, welcomed, sort, limit } = query;
  const where: Prisma.UserWhereInput = {
    deletedAt: null,
    ...(from || to ? { createdAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } } : {}),
    ...(role ? { role } : {}),
    ...(q ? { OR: [
      { name: { contains: q, mode: 'insensitive' } },
      { phone: { contains: q } },
      { email: { contains: q, mode: 'insensitive' } },
    ] } : {}),
    ...(welcomed === 'yes' ? { notificationLogs: { some: { kind: 'welcome' } } } : {}),
    ...(welcomed === 'no' ? { notificationLogs: { none: { kind: 'welcome' } } } : {}),
  };
  const [rows, total] = await Promise.all([
    this.prisma.user.findMany({
      where,
      include: { city: true, notificationLogs: { where: { kind: 'welcome' }, orderBy: { sentAt: 'desc' }, take: 1 } },
      orderBy: USER_ORDER_BY[sort ?? 'createdAt_desc'],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    }),
    this.prisma.user.count({ where }),
  ]);
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  return {
    items: page.map((u) => ({
      id: u.id, name: u.name, phone: u.phone, email: u.email, role: u.role,
      cityName: u.city?.name ?? null, createdAt: u.createdAt.toISOString(),
      welcomed: u.notificationLogs.length > 0,
      welcomedChannel: u.notificationLogs[0]?.channel ?? null,
      welcomedAt: u.notificationLogs[0]?.sentAt.toISOString() ?? null,
    })),
    nextCursor: hasMore ? page[page.length - 1].id : null,
    total,
  };
}
```

`USER_ORDER_BY: Record<UserSort, Prisma.UserOrderByWithRelationInput[]>` sits alongside the
existing `LOGIN_ORDER_BY`/`PAGE_VISIT_ORDER_BY` constants: `createdAt_desc`/`createdAt_asc` (with
an `id` tie-breaker) and `name_asc` (nulls last).

## 4. `AdminController` — new `GET admin/users` route

Added alongside the existing `users/search` and `users/:id/activity` routes in
`apps/bff/src/admin/admin.controller.ts`, guarded by the same `AdminGuard`. No route collision:
both existing routes require extra path segments (`/search`, `/:id/activity`), so a bare `users`
route is distinct regardless of declaration order.

## 5. `apps/admin/src/lib/bff.ts` — `AdminUserSort` + `fetchUsers()`

`AdminUserSort` as a locally-duplicated union (same convention as `AdminLoginSort`/
`AdminPageVisitSort`, pointing back at `ListUsersDto`), and `fetchUsers()` following
`fetchPageVisits`'s existing fetch-and-parse pattern.

## 6. `apps/admin/src/app/users/page.tsx` (new)

Server component using a real `<table>` (per `page-visits/page.tsx`'s convention, since the ask
was "filters and sorts on table" rather than the card-list style `logins/page.tsx` uses):

- `requireAdmin()` guard.
- Filter `<form method="get">`: free-text `q`, `role` select, `welcomed` select (Any/Welcomed/Not
  welcomed), `from`/`to` date inputs, `sort` select.
- Table columns: Created, Name, Phone, Email, Role, City, Notification status — "✓ whatsapp — Sep
  3" style when welcomed, `var(--danger)`-colored "Not welcomed" otherwise.
- Each row's name links to `/users/[id]`.
- Cursor "Load more" preserving all active filters/sort in the query string.

## 7. Nav link

`apps/admin/src/components/AdminNav.tsx` — added `{ href: "/users", label: "Users" }` between
"Recent logins" and "Page visits".

## Verification (done)

1. `pnpm --filter @bhavano/types build`, `pnpm --filter bff typecheck`/`build`,
   `pnpm --filter admin typecheck`/`build` — all pass, `next build`'s route list includes `/users`.
2. Ran the bff dev server locally and confirmed `GET /admin/users` is registered and reachable.
3. Queried the local dev DB directly with the same `notificationLogs: { some/none: kind:
   'welcome' } }` shape used by `listUsers` and confirmed the welcomed/not-welcomed counts sum to
   the total user count — the derived-from-log filter logic is sound.
