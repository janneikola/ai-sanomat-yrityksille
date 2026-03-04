---
phase: quick-001
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - api/src/routes/clients.ts
  - web/src/app/(admin)/clients/[id]/page.tsx
autonomous: true
requirements:
  - QUICK-001
must_haves:
  truths:
    - "Admin can view all newsletter recipients for a client on the client detail page"
    - "Admin can add a single recipient (email + optional name) to a client"
    - "Admin can bulk-import multiple recipients via comma-separated emails"
    - "Admin can soft-delete (deactivate) a recipient"
    - "Bounced recipients are visually flagged"
  artifacts:
    - path: "api/src/routes/clients.ts"
      provides: "Admin member CRUD endpoints under /api/admin/clients/:id/members"
      contains: "GET, POST, POST bulk, PATCH members"
    - path: "web/src/app/(admin)/clients/[id]/page.tsx"
      provides: "Members management card on client detail page"
      contains: "MembersCard or members section"
  key_links:
    - from: "web/src/app/(admin)/clients/[id]/page.tsx"
      to: "/api/admin/clients/:id/members"
      via: "apiFetch calls"
      pattern: "apiFetch.*clients.*members"
---

<objective>
Add newsletter recipient (member) management to the admin client detail page, so the admin can view, add, bulk-import, and remove recipients directly from the `/clients/[id]` page without needing portal access.

Purpose: Currently member management is only available through the company portal (magic link auth). The admin (Janne) needs to manage recipients directly from the admin panel for onboarding and support.

Output: Admin API endpoints for member CRUD + Members management card on client detail page.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@api/src/routes/clients.ts (admin client routes — extend with member endpoints)
@api/src/routes/portal.ts (existing portal member routes — reuse same logic patterns)
@api/src/db/schema.ts (members table schema)
@web/src/app/(admin)/clients/[id]/page.tsx (client detail page — add members card)
@web/src/app/(portal)/tiimi/page.tsx (portal team page — copy UI patterns from here)
@web/src/lib/api.ts (apiFetch utility)

<interfaces>
<!-- Key types and contracts the executor needs. -->

From api/src/db/schema.ts:
```typescript
export const members = pgTable('members', {
  id: serial('id').primaryKey(),
  clientId: integer('client_id').notNull().references(() => clients.id),
  email: varchar('email', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }),
  isActive: boolean('is_active').notNull().default(true),
  isBounced: boolean('is_bounced').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().$onUpdate(() => new Date()),
});
```

From api/src/routes/portal.ts (reuse same response shapes):
```typescript
// Member response shape (GET /members, POST /members):
z.object({
  id: z.number(),
  email: z.string(),
  name: z.string().nullable(),
  isActive: z.boolean(),
  isBounced: z.boolean(),
})

// Bulk result shape (POST /members/bulk):
z.object({
  added: z.number(),
  reactivated: z.number(),
  skipped: z.number(),
  invalid: z.array(z.string()),
})
```

From web/src/lib/api.ts:
```typescript
export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T>;
```

Admin routes use `fastify.authenticate` middleware (onRequest: [fastify.authenticate]).
Portal routes use custom `authenticatePortal` that checks role=company.
Admin routes are mounted at prefix `/api/admin`.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add admin member API endpoints to clients route</name>
  <files>api/src/routes/clients.ts</files>
  <action>
Add 4 new admin endpoints to the existing clients.ts route file, below the existing schedule endpoint. These mirror the portal member routes but use admin auth (`fastify.authenticate`) instead of portal auth, and take clientId from the URL param instead of JWT.

1. **GET /clients/:id/members** — List all members for a client (include inactive so admin sees full picture). Select id, email, name, isActive, isBounced. Order by createdAt. Filter by `eq(members.clientId, id)`.

2. **POST /clients/:id/members** — Add single member. Body: `{ email: string (email), name?: string }`. Check for existing member with same email+clientId. If exists and active -> 409 "Jasen on jo lisatty". If exists and inactive -> reactivate (set isActive=true, isBounced=false). Otherwise insert new. Return member object.

3. **POST /clients/:id/members/bulk** — Bulk import. Body: `{ emails: string }` (comma-separated). Parse, validate each with `z.string().email()`, same add/reactivate/skip logic as portal bulk route. Return `{ added, reactivated, skipped, invalid }`.

4. **PATCH /clients/:id/members/:memberId** — Soft-delete (deactivate). Verify member belongs to this client. Set isActive=false. Return `{ success: true }` or 404.

Import `members` from schema.ts (already imported: `clients`). Import `and, eq` from drizzle-orm. Use same Zod schemas and response shapes as portal.ts to maintain consistency. All endpoints use `onRequest: [fastify.authenticate]` (admin auth).

Do NOT modify any existing endpoints. Only add new ones after the schedule route.
  </action>
  <verify>
    <automated>cd /Users/janne/coding/ai-sanomat-yrityksille && npx tsc --noEmit --project api/tsconfig.json 2>&1 | head -30</automated>
  </verify>
  <done>Four admin member endpoints compile without errors and follow the same patterns as portal member routes</done>
</task>

<task type="auto">
  <name>Task 2: Add members management card to admin client detail page</name>
  <files>web/src/app/(admin)/clients/[id]/page.tsx</files>
  <action>
Add a "Vastaanottajat" (Recipients) Card to the client detail page, below the existing Schedule card. Copy UI patterns from the portal tiimi page but adapt for admin context (show inactive members too, since admin needs full visibility).

**Member interface** (add at top with other interfaces):
```typescript
interface Member {
  id: number;
  email: string;
  name: string | null;
  isActive: boolean;
  isBounced: boolean;
}
interface BulkResult {
  added: number;
  reactivated: number;
  skipped: number;
  invalid: string[];
}
```

**State variables** (add to component):
- `members: Member[]`, `loadingMembers: boolean`
- `addMemberOpen: boolean`, `addMemberEmail: string`, `addMemberName: string`, `addMemberLoading: boolean`
- `bulkOpen: boolean`, `bulkEmails: string`, `bulkLoading: boolean`
- `removeTarget: Member | null`, `removeLoading: boolean`

**Data loading:**
- Add `fetchMembers` callback that calls `apiFetch<Member[]>(`/api/admin/clients/${clientId}/members`)`. Call in useEffect alongside existing loadClient/loadDigest.

**UI — New Card after Schedule card:**
- Card with CardHeader: title "Vastaanottajat" with Users icon, member count badge, and two buttons: "Lisaa vastaanottaja" (Plus icon) and "Tuo useita" (Upload icon, variant=outline).
- Card body: Table with columns Sahkoposti, Nimi, Tila, Toiminnot.
- Show ALL members (not filtered by isActive like portal does). Inactive members show "Poistettu" badge (variant=secondary). Bounced show "Palautunut" (variant=destructive). Active show "Aktiivinen" (green badge).
- Remove button (Trash2 icon) only for active members. For inactive members, no action needed (admin can see history).
- Empty state: "Ei vastaanottajia. Lisaa ensimmainen vastaanottaja."

**Dialogs** (copy from portal tiimi page, same structure):
1. Add single member dialog — form with email (required) + name (optional) fields
2. Bulk import dialog — textarea for comma-separated emails
3. Remove confirmation dialog — confirm soft-delete

**Handlers:**
- `handleAddMember`: POST to `/api/admin/clients/${clientId}/members`, toast success/error, refresh list
- `handleBulkImport`: POST to `/api/admin/clients/${clientId}/members/bulk`, toast with counts, refresh list
- `handleRemoveMember`: PATCH to `/api/admin/clients/${clientId}/members/${removeTarget.id}`, toast, refresh list

Import additional icons: `Users, Trash2, Plus, Upload` from lucide-react.
Import additional UI: `Input, Label, Textarea, Table/TableBody/TableCell/TableHead/TableHeader/TableRow, Dialog/DialogContent/DialogDescription/DialogFooter/DialogHeader/DialogTitle/DialogTrigger, Badge` — check which are already imported and only add missing ones.

Finnish language for all UI text, matching existing patterns.
  </action>
  <verify>
    <automated>cd /Users/janne/coding/ai-sanomat-yrityksille && npx tsc --noEmit --project web/tsconfig.json 2>&1 | head -30</automated>
  </verify>
  <done>Client detail page shows a Recipients card with table of members, add/bulk/remove dialogs, all matching portal tiimi page UX patterns. Admin can manage newsletter recipients directly from client detail.</done>
</task>

</tasks>

<verification>
1. `cd api && npx tsc --noEmit` — API compiles without errors
2. `cd web && npx tsc --noEmit` — Frontend compiles without errors
3. Manual: Start API + frontend, navigate to /clients/1, see Recipients card with member table and working add/bulk/remove flows
</verification>

<success_criteria>
- Admin client detail page at `/clients/[id]` shows a Recipients management card
- Admin can add a single recipient with email and optional name
- Admin can bulk-import recipients via comma-separated emails
- Admin can soft-delete recipients
- Member table shows status badges (active/bounced/removed)
- All new API endpoints use admin auth (not portal auth)
- TypeScript compiles without errors in both api and web packages
</success_criteria>

<output>
After completion, create `.planning/quick/001-add-user-mgmt-newsletter-recipients/001-SUMMARY.md`
</output>
