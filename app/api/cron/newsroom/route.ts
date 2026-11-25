import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { runSourceDiscoveryCore } from "@/app/admin/actions";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function christchurchClock(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-NZ", {
    timeZone: "Pacific/Auckland",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    hour: Number(values.hour),
    minute: Number(values.minute)
  };
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const local = christchurchClock();
  // Two UTC triggers cover NZ daylight saving. Only the one that lands at
  // 02:00 in Pacific/Auckland is allowed to start the newsroom run.
  if (local.hour !== 2 || local.minute > 5) {
    return NextResponse.json({ skipped: true, reason: "Not the 02:00 Christchurch run window", local });
  }

  const sql = getSql();
  const prior = await sql`select id,status from workflow_runs
    where workflow_type='source_fetch'
      and metadata->>'trigger'='overnight_newsroom'
      and metadata->>'local_date'=${local.date}
      and status in ('running','succeeded')
    limit 1`;
  if (prior.length) {
    return NextResponse.json({ skipped: true, reason: "Already run or currently running today", local_date: local.date });
  }

  const marker = await sql`insert into workflow_runs (workflow_type,status,started_at,metadata)
    values ('source_fetch','running',now(),jsonb_build_object('trigger','overnight_newsroom','local_date',${local.date}::text))
    returning id`;
  const markerId = (marker[0] as { id: string }).id;

  try {
    const result = await runSourceDiscoveryCore();
    await sql`update workflow_runs set status='succeeded',completed_at=now(),items_processed=${result.draftsCreated},
      metadata=jsonb_build_object('trigger','overnight_newsroom','local_date',${local.date}::text,
        'checked',${result.checked}::int,'fetched',${result.fetched}::int,'imported',${result.imported}::int,
        'extracted',${result.extracted}::int,'drafts_created',${result.draftsCreated}::int,
        'feed_errors',${result.feedErrors}::int,'draft_errors',${result.draftErrors}::int)
      where id=${markerId}`;
    return NextResponse.json({ success: true, local_date: local.date, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Overnight newsroom run failed";
    await sql`update workflow_runs set status='failed',completed_at=now(),error_message=${message}
      where id=${markerId}`;
    return NextResponse.json({ success: false, error: message, local_date: local.date }, { status: 500 });
  }
}
