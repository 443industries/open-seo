import { useState, type FormEvent } from "react";
import { AlertCircle, MapPin, Search, Loader2 } from "lucide-react";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import { OptimizationScorecard } from "@/client/features/local/components/OptimizationScorecard";
import {
  EmptyState,
  ProfileCard,
  GridTab,
} from "@/client/features/local/components/LocalProfileTabs";
import {
  ReviewsTab,
  CompetitorsTab,
} from "@/client/features/local/components/LocalReviewsCompetitorsTabs";
import { useLocalProfileQuery } from "@/client/features/local/hooks/useLocalQueries";

type Tab = "overview" | "grid" | "reviews" | "competitors";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Profile & Score" },
  { id: "grid", label: "Map Rank Grid" },
  { id: "reviews", label: "Reviews" },
  { id: "competitors", label: "Competitors" },
];

type Props = {
  projectId: string;
  initialBusiness: string;
  initialTab: Tab;
  onChange: (business: string, tab: Tab) => void;
};

export function LocalSeoPage({
  projectId,
  initialBusiness,
  initialTab,
  onChange,
}: Props) {
  const [input, setInput] = useState(initialBusiness);
  const [business, setBusiness] = useState(initialBusiness);
  const [tab, setTab] = useState<Tab>(initialTab);

  const profileQuery = useLocalProfileQuery({ projectId, businessName: business });
  const profile = profileQuery.data?.profile;
  const center =
    profile?.latitude != null && profile?.longitude != null
      ? { latitude: profile.latitude, longitude: profile.longitude }
      : undefined;

  function submit(e: FormEvent) {
    e.preventDefault();
    const next = input.trim();
    setBusiness(next);
    onChange(next, tab);
  }

  function selectTab(next: Tab) {
    setTab(next);
    onChange(business, next);
  }

  return (
    <div className="mx-auto w-full max-w-5xl p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <MapPin size={24} /> Local SEO
        </h1>
        <p className="text-sm text-base-content/60">
          Google Business Profile health, map-pack rank grid, reviews, and
          nearby competitors — all from one business lookup.
        </p>
      </div>

      <form onSubmit={submit} className="flex flex-col sm:flex-row gap-2">
        <input
          className="input input-bordered flex-1"
          placeholder="Business name as it appears on Google (e.g. Gracie Barra Surfers Paradise)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={200}
        />
        <button type="submit" className="btn btn-primary">
          <Search size={16} /> Look up
        </button>
      </form>

      {profileQuery.isError ? (
        <div className="alert alert-error">
          <AlertCircle size={18} />
          <span>{getStandardErrorMessage(profileQuery.error)}</span>
        </div>
      ) : null}

      {business === "" ? (
        <EmptyState />
      ) : profileQuery.isLoading ? (
        <div className="flex items-center gap-2 text-base-content/60 py-10 justify-center">
          <Loader2 className="animate-spin" size={18} /> Looking up business…
        </div>
      ) : profileQuery.data && !profileQuery.data.hasData ? (
        <div className="alert">
          <AlertCircle size={18} />
          <span>
            No Google Business Profile found for “{business}”. Try the exact
            name as shown on Google Maps.
          </span>
        </div>
      ) : profile ? (
        <>
          <div role="tablist" className="tabs tabs-boxed w-fit">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                className={`tab ${tab === t.id ? "tab-active" : ""}`}
                onClick={() => selectTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "overview" ? (
            <div className="grid gap-6 lg:grid-cols-2">
              <ProfileCard profile={profile} />
              {profileQuery.data ? (
                <OptimizationScorecard scorecard={profileQuery.data.scorecard} />
              ) : null}
            </div>
          ) : null}

          {tab === "grid" ? (
            <GridTab
              projectId={projectId}
              defaultKeyword={profile.category ?? business}
              target={{
                cid: profile.cid ?? undefined,
                placeId: profile.placeId ?? undefined,
                name: profile.title ?? business,
              }}
              center={center}
            />
          ) : null}

          {tab === "reviews" ? (
            <ReviewsTab
              projectId={projectId}
              cid={profile.cid ?? undefined}
              businessName={profile.title ?? business}
            />
          ) : null}

          {tab === "competitors" ? (
            <CompetitorsTab
              projectId={projectId}
              category={profile.category}
              center={center}
              selfTitle={profile.title}
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}

