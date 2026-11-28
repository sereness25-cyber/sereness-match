begin;

create table public.daily_like_balances (
  user_id uuid references public.accounts on delete restrict,
  target_date date,
  granted_count integer not null check (granted_count in (5,20)),
  used_count integer not null default 0 check (used_count between 0 and granted_count),
  updated_at timestamptz not null default now(),
  primary key (user_id,target_date)
);
create table public.likes (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.accounts on delete restrict,
  receiver_id uuid not null references public.accounts on delete restrict,
  like_type text not null check (like_type in ('normal','message')),
  message text,
  cost integer not null,
  status text not null default 'pending' check (status in ('pending','accepted','skipped','cancelled')),
  client_request_id uuid not null,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  unique (sender_id,receiver_id),
  unique (sender_id,client_request_id),
  check (sender_id <> receiver_id),
  check ((like_type='normal' and message is null and cost=1) or
    (like_type='message' and message is not null and message ~ '[^[:space:]]' and char_length(message)<=100 and cost=3))
);
create index likes_inbox_idx on public.likes(receiver_id,created_at desc);
create table public.skips (
  user_id uuid references public.accounts on delete restrict,
  target_user_id uuid references public.accounts on delete restrict,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  primary key (user_id,target_user_id),
  check (user_id <> target_user_id)
);
create table public.matches (
  id uuid primary key default gen_random_uuid(),
  user_a_id uuid not null references public.accounts on delete restrict,
  user_b_id uuid not null references public.accounts on delete restrict,
  match_type text not null default 'normal' check (match_type in ('normal','introduction','event')),
  source_id uuid not null,
  status text not null default 'active' check (status in ('active','unmatched','blocked','closed')),
  matched_at timestamptz not null default now(),
  ended_at timestamptz,
  ended_by uuid references public.accounts on delete restrict,
  unique (user_a_id,user_b_id),
  check (user_a_id < user_b_id),
  check ((status='active')=(ended_at is null))
);
create index matches_user_b_idx on public.matches(user_b_id);
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null unique references public.matches on delete restrict,
  status text not null default 'active' check (status in ('active','closed')),
  last_message_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.conversation_members (
  conversation_id uuid references public.conversations on delete restrict,
  user_id uuid references public.accounts on delete restrict,
  joined_at timestamptz not null default now(),
  primary key (conversation_id,user_id)
);
create index conversation_members_user_idx on public.conversation_members(user_id);
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null,
  sender_id uuid not null,
  message_type text not null default 'text' check (message_type='text'),
  body text not null check (body ~ '[^[:space:]]' and char_length(body)<=1000),
  client_request_id uuid not null,
  created_at timestamptz not null default now(),
  foreign key (conversation_id,sender_id) references public.conversation_members on delete restrict,
  unique (sender_id,client_request_id)
);
create index messages_conversation_idx on public.messages(conversation_id,created_at,id);
create table public.blocks (
  blocker_id uuid references public.accounts on delete restrict,
  blocked_id uuid references public.accounts on delete restrict,
  created_at timestamptz not null default now(),
  primary key (blocker_id,blocked_id),
  check (blocker_id <> blocked_id)
);
create index blocks_target_idx on public.blocks(blocked_id);
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.accounts on delete restrict,
  reported_user_id uuid not null references public.accounts on delete restrict,
  target_type text not null check (target_type in ('member','message')),
  target_id uuid not null,
  reason text not null check (reason ~ '[^[:space:]]' and char_length(reason)<=500),
  assigned_admin_id uuid references public.admins on delete restrict,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  check (reporter_id <> reported_user_id)
);
create index reports_owner_idx on public.reports(reporter_id);
create table public.report_evidence (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null unique references public.reports on delete restrict,
  evidence_type text not null default 'message' check (evidence_type='message'),
  message_id uuid not null references public.messages on delete restrict,
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.admins on delete restrict,
  report_id uuid not null references public.reports on delete restrict,
  action text not null check (action='report_evidence_read'),
  reason text not null check (reason ~ '[^[:space:]]' and char_length(reason)<=500),
  created_at timestamptz not null default now()
);
create index audit_logs_report_idx on public.audit_logs(report_id);

-- Fresh tables are default-deny until the following migration defines RPCs and policies.
alter table public.daily_like_balances enable row level security;
alter table public.likes enable row level security;
alter table public.skips enable row level security;
alter table public.matches enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.blocks enable row level security;
alter table public.reports enable row level security;
alter table public.report_evidence enable row level security;
alter table public.audit_logs enable row level security;
revoke all on public.daily_like_balances,public.likes,public.skips,public.matches,
  public.conversations,public.conversation_members,public.messages,public.blocks,
  public.reports,public.report_evidence,public.audit_logs from public,anon,authenticated;

commit;
