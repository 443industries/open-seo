import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import { Pencil, Plus, Sparkles, Loader2 } from "lucide-react";
import { suggestProjectCompetitors } from "@/serverFunctions/competitors";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import type { ProjectContextUpdate } from "@/types/schemas/projectContext";
import {
  ConfirmDeleteButton,
  EmptyState,
  FormActions,
  listClass,
  Provenance,
  RowActions,
  SectionHeader,
  useContextUpdate,
  type ContextCompetitor,
} from "./shared";

export function CompetitorsSection({
  projectId,
  competitors,
}: {
  projectId: string;
  competitors: ContextCompetitor[];
}) {
  const update = useContextUpdate(projectId);
  const [adding, setAdding] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [suggesting, setSuggesting] = React.useState(false);

  const save = (previousDomain: string | null, draft: CompetitorDraft) => {
    const ops: ProjectContextUpdate[] = [];
    // Competitors upsert by domain, so a retyped domain has to drop the old row
    // before the new one lands.
    if (previousDomain && previousDomain !== draft.domain.trim()) {
      ops.push({ removeCompetitors: [previousDomain] });
    }
    // Send the fields even when blank: an omitted field means "keep what's
    // stored" (so agent writes merge), so clearing one from the form has to
    // send the empty string.
    ops.push({
      addCompetitors: [
        {
          domain: draft.domain.trim(),
          name: draft.name.trim(),
          notes: draft.notes.trim(),
        },
      ],
    });
    update.mutate(ops, {
      onSuccess: () => {
        setAdding(false);
        setEditingId(null);
      },
    });
  };

  return (
    <section className="space-y-3">
      <SectionHeader
        title="Competitors"
        hint="The sites you measure yourself against."
        action={
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="btn btn-ghost btn-xs"
              onClick={() => setSuggesting((v) => !v)}
            >
              <Sparkles className="size-3.5" />
              Suggest
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-xs"
              onClick={() => setAdding(true)}
            >
              <Plus className="size-3.5" />
              Add competitor
            </button>
          </div>
        }
      />

      {suggesting ? (
        <SuggestCompetitors
          projectId={projectId}
          existing={competitors.map((c) => c.domain)}
          onAdd={(domain) =>
            update.mutate([
              { addCompetitors: [{ domain, name: "", notes: "" }] },
            ])
          }
        />
      ) : null}

      {adding ? (
        <div className={listClass}>
          <CompetitorForm
            pending={update.isPending}
            onCancel={() => setAdding(false)}
            onSave={(draft) => save(null, draft)}
          />
        </div>
      ) : null}

      {competitors.length === 0 ? (
        adding ? null : (
          <EmptyState>
            No competitors yet. Add the sites you compete with, or ask SAM to
            find them from your rankings and save them here.
          </EmptyState>
        )
      ) : (
        <ul className={listClass}>
          {competitors.map((competitor) =>
            editingId === competitor.id ? (
              <li key={competitor.id}>
                <CompetitorForm
                  initial={competitor}
                  pending={update.isPending}
                  onCancel={() => setEditingId(null)}
                  onSave={(draft) => save(competitor.domain, draft)}
                />
              </li>
            ) : (
              <li
                key={competitor.id}
                className="flex items-start justify-between gap-3 p-3"
              >
                <div className="min-w-0 space-y-0.5">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="truncate text-sm font-medium">
                      {competitor.domain}
                    </span>
                    {competitor.name ? (
                      <span className="truncate text-xs text-base-content/60">
                        {competitor.name}
                      </span>
                    ) : null}
                  </div>
                  {competitor.notes ? (
                    <p className="text-sm text-base-content/70">
                      {competitor.notes}
                    </p>
                  ) : null}
                  <Provenance
                    by={competitor.updatedBy}
                    at={competitor.updatedAt}
                  />
                </div>
                <RowActions>
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs"
                    aria-label={`Edit ${competitor.domain}`}
                    onClick={() => setEditingId(competitor.id)}
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  <ConfirmDeleteButton
                    label={`Remove ${competitor.domain}`}
                    pending={update.isPending}
                    onConfirm={() =>
                      update.mutate([
                        { removeCompetitors: [competitor.domain] },
                      ])
                    }
                  />
                </RowActions>
              </li>
            ),
          )}
        </ul>
      )}
    </section>
  );
}

type CompetitorDraft = { domain: string; name: string; notes: string };

function CompetitorForm({
  initial,
  pending,
  onCancel,
  onSave,
}: {
  initial?: ContextCompetitor;
  pending: boolean;
  onCancel: () => void;
  onSave: (draft: CompetitorDraft) => void;
}) {
  const [draft, setDraft] = React.useState<CompetitorDraft>({
    domain: initial?.domain ?? "",
    name: initial?.name ?? "",
    notes: initial?.notes ?? "",
  });

  return (
    <form
      className="space-y-2 bg-base-200/40 p-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!draft.domain.trim() || pending) return;
        onSave(draft);
      }}
    >
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          autoFocus
          type="text"
          value={draft.domain}
          onChange={(event) =>
            setDraft({ ...draft, domain: event.target.value })
          }
          placeholder="competitor.com"
          maxLength={255}
          className="input input-bordered input-sm w-full"
          aria-label="Competitor domain"
        />
        <input
          type="text"
          value={draft.name}
          onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          placeholder="Name (optional)"
          maxLength={120}
          className="input input-bordered input-sm w-full"
          aria-label="Competitor name"
        />
      </div>
      <input
        type="text"
        value={draft.notes}
        onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
        placeholder="Why they matter — e.g. wins every comparison keyword (optional)"
        maxLength={500}
        className="input input-bordered input-sm w-full"
        aria-label="Competitor notes"
      />
      <FormActions
        pending={pending}
        disabled={!draft.domain.trim()}
        onCancel={onCancel}
      />
    </form>
  );
}

// One-click competitor discovery: Labs competitors_domain for the project's own
// domain. Already-added domains are hidden so the list is only new additions.
function SuggestCompetitors({
  projectId,
  existing,
  onAdd,
}: {
  projectId: string;
  existing: string[];
  onAdd: (domain: string) => void;
}) {
  const existingSet = new Set(existing);
  const [added, setAdded] = React.useState<Set<string>>(new Set());
  const suggest = useMutation({
    mutationFn: () => suggestProjectCompetitors({ data: { projectId } }),
  });

  return (
    <div className="rounded-box border border-base-300 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-base-content/70">
          Find competitors from your domain’s organic rankings.
        </p>
        <button
          type="button"
          className="btn btn-primary btn-xs"
          disabled={suggest.isPending}
          onClick={() => suggest.mutate()}
        >
          {suggest.isPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Sparkles className="size-3.5" />
          )}
          Suggest
        </button>
      </div>

      {suggest.isError ? (
        <p className="text-sm text-error">
          {getStandardErrorMessage(suggest.error)}
        </p>
      ) : null}

      {suggest.data && !suggest.data.hasDomain ? (
        <p className="text-sm text-base-content/60">
          Set the project’s domain first, then suggestions can be generated.
        </p>
      ) : null}

      {suggest.data?.hasDomain && suggest.data.competitors.length === 0 ? (
        <p className="text-sm text-base-content/60">No competitors found.</p>
      ) : null}

      {suggest.data && suggest.data.competitors.length > 0 ? (
        <ul className="divide-y divide-base-200">
          {suggest.data.competitors
            .filter((c) => !existingSet.has(c.domain))
            .map((c) => {
              const isAdded = added.has(c.domain);
              return (
                <li
                  key={c.domain}
                  className="flex items-center justify-between gap-2 py-1.5"
                >
                  <span className="text-sm truncate">
                    {c.domain}
                    {c.intersections != null ? (
                      <span className="text-xs text-base-content/40 ml-2">
                        {c.intersections} shared kw
                      </span>
                    ) : null}
                  </span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs"
                    disabled={isAdded}
                    onClick={() => {
                      onAdd(c.domain);
                      setAdded((prev) => new Set(prev).add(c.domain));
                    }}
                  >
                    {isAdded ? (
                      "Added"
                    ) : (
                      <>
                        <Plus className="size-3.5" /> Add
                      </>
                    )}
                  </button>
                </li>
              );
            })}
        </ul>
      ) : null}
    </div>
  );
}
