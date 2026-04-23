import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { clsx } from "clsx";
import { AdminUser, Me, Tier, api } from "../lib/api";
import { Wordmark } from "../components/primitives/Wordmark";
import { IconButton } from "../components/primitives/IconButton";

const TIERS: Tier[] = ["free", "plus", "admin"];

export default function Admin() {
  const [me, setMe] = useState<Me | null>(null);
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);

  async function load() {
    try {
      const [mine, list] = await Promise.all([api.me(), api.adminListUsers()]);
      setMe(mine);
      setUsers(list);
    } catch (e: any) {
      setErr(e?.message || "Failed to load");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function setTier(userId: number, tier: Tier) {
    setSavingId(userId);
    try {
      await api.adminSetTier(userId, tier);
      await load();
    } catch (e: any) {
      alert(e?.message || "Failed to update tier");
    } finally {
      setSavingId(null);
    }
  }

  // Hard gate: if /api/me reveals we're not admin, kick back to home so a
  // free user can't see the page even if they typed the URL directly.
  if (me && me.tier !== "admin") {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-paper paper-noise text-ink">
      <header className="sticky top-0 z-20 border-b border-rule bg-paper/80 backdrop-blur pt-safe">
        <div className="mx-auto flex h-16 max-w-3xl items-center gap-3 px-5 md:px-8">
          <Link to="/" aria-label="Back to library">
            <IconButton icon={ArrowLeft} label="Back to library" />
          </Link>
          <Wordmark size="md" />
          <span className="hidden truncate font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint sm:inline">
            admin
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-5 pb-24 pt-8 md:px-8">
        <h1 className="font-display text-[32px] font-semibold leading-tight tracking-[-0.02em] text-ink">
          User management
        </h1>
        <p className="mt-2 font-display text-[15px] italic text-ink-muted">
          Promote, demote, see who's saving what.
        </p>

        {err && (
          <p className="mt-6 font-sans text-[13px] text-terracotta">{err}</p>
        )}

        {!users && !err && (
          <p className="mt-6 font-sans text-[13px] text-ink-muted">Loading…</p>
        )}

        {users && (
          <div className="mt-7 overflow-hidden rounded-xl border border-rule bg-paper-raised">
            <table className="w-full text-left text-[13px]">
              <thead className="border-b border-rule">
                <tr className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Tier</th>
                  <th className="px-4 py-3 text-right">Saves / mo</th>
                  <th className="px-4 py-3 text-right">Chats / mo</th>
                  <th className="px-4 py-3 text-right">Research / mo</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isMe = me?.id === u.id;
                  return (
                    <tr key={u.id} className="border-b border-dashed border-rule last:border-none">
                      <td className="px-4 py-3 font-sans text-ink">
                        {u.email || <em className="text-ink-faint">no email</em>}
                        {isMe && (
                          <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
                            you
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={u.tier}
                          disabled={savingId === u.id || isMe}
                          onChange={(e) => setTier(u.id, e.target.value as Tier)}
                          className={clsx(
                            "rounded-md border border-rule bg-paper px-2 py-1 font-sans text-[12px] text-ink",
                            (savingId === u.id || isMe) && "opacity-60 cursor-not-allowed",
                          )}
                        >
                          {TIERS.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-[12px] text-ink-muted">
                        {u.saves_this_month}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-[12px] text-ink-muted">
                        {u.chats_this_month}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-[12px] text-ink-muted">
                        {u.research_this_month}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-4 font-display text-[13px] italic text-ink-muted">
          You can't change your own tier. Promote another admin first if you need
          to demote yourself.
        </p>
      </div>
    </div>
  );
}
