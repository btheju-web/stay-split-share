# Email invitations with a truly shared group

Today each signed-in person keeps their own private copy of all group data, and invite links only push a *name* into the owner's copy. To let several accounts work on the same group, the group's data has to live in one shared record that every member reads and writes.

## What you'll get

- **Invite by email**: in the invite dialog, type someone's email address and send. They get a link tied to that address.
- **Accepting**: the invitee opens the link, signs in (or creates an account with that email), and is joined to the group — no name typing, their account is the membership.
- **Shared data**: once joined, every member sees the same expenses, payments, budgets and members list. Anyone's change shows up for everyone (refresh / short polling).
- **Common group ID**: the group gets one shared ID that all linked accounts point at, instead of a per-user copy.
- **Guest mode unchanged**: not signed in? Everything still works locally, exactly as now.
- **Membership management**: the owner can see pending invites, revoke them, and remove members.

## Data model (technical)

New tables, all with grants + RLS:

- `shared_groups` — `id`, `owner_id`, `name`, `state` (jsonb: members/expenses/payments/budgets), timestamps.
- `group_members` — `group_id`, `user_id`, `display_name`, `role` (owner/member), unique per pair.
- `group_email_invites` — `group_id`, `token`, `email`, `invited_by`, `accepted_at`, `expires_at`.

Access is gated by a security-definer function `is_group_member(_group_id, _user_id)` so policies don't recurse: members can read and update their group's row; only the owner can delete it or manage invites.

Existing `group_invites` / `group_join_requests` (name-only links) stay in place so current links keep working.

## Flow (technical)

1. `sendGroupEmailInvite` server fn (auth'd): verifies caller owns the group, upserts the shared group row from the caller's local group, creates a token row for the email, returns the link. Email delivery is via the built-in mailer; the copyable link is always shown as a fallback.
2. `acceptGroupEmailInvite` server fn (auth'd): validates token, checks the signed-in email matches the invited address, inserts into `group_members`, marks accepted.
3. `/join/$token` detects an email invite: if signed out, sends the user to `/auth` and returns to the invite afterwards; if signed in, accepts and routes to the dashboard.
4. `use-splitstay` gains a shared-group layer: for each shared group the user belongs to, load/write `shared_groups.state` (debounced, last-write-wins) instead of the private `user_data` blob; private groups keep the current behaviour. A poll every ~10s picks up others' edits.
5. Dashboard shows a "Shared" badge and a members panel listing linked accounts and pending invites.

## Notes

- Concurrent edits use last-write-wins on the whole group state; simultaneous edits by two people in the same seconds can overwrite each other. Fine-grained per-row expenses would be a later step.
- Invited addresses must match at sign-in, so an invite can't be redeemed by forwarding the link to someone else.
