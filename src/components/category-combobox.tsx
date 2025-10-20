"use client";

import { useEffect, useMemo, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { ChevronDown } from "lucide-react";
import { getClientLocale, tr } from "@/lib/i18n";
import { categories as allCategories } from "@/lib/categories";
import { db } from "@/lib/firebase";
import { collection, getDocs, limit, query, where } from "firebase/firestore";

export type CategoryComboboxProps = {
  value: string;
  onChange: (val: string) => void;
  allowAll?: boolean;
  allValue?: string; // e.g. "ALL_CATEGORIES"
  allLabel?: string; // e.g. "All Categories"
  placeholder?: string;
  mergeCommunity?: boolean; // if true, merge distinct categories from approved services
};

const GROUPS: Record<string, string[]> = {
  "Home & Repair": [
    'Plumbing','Electrical','Carpentry','Home Services','Cleaning','Painting','HVAC','Air Conditioning','Appliance Repair','Roofing','Flooring','Tiling','Handyman','Furniture Assembly','Metalwork & Welding','Masonry & Concrete','Glass & Aluminum','Electrical Appliances Install','Interior Design'
  ],
  "Outdoor & Utilities": [
    'Gardening','Landscaping','Pest Control','Water Tank Services','Water & Sanitation','Waste Removal','Solar & Renewable Energy'
  ],
  "Auto & Transport": [
    'Automotive','Car Wash & Detailing','Car Repair','Motorcycle Repair','Transport & Delivery','Boat & Marine'
  ],
  "Tech & IT": [
    'IT & Computer Repair','Mobile Repair','Internet & Networking','Satellite & TV','Web Development'
  ],
  "Creative & Media": [
    'Graphic Design','Photography','Videography','Printing','Branding','Copywriting','Advertising','Packaging & Label Design'
  ],
  Marketing: [
    'Digital Marketing','Social Media Marketing','SEO','SEM & Paid Ads','Content Marketing','Email Marketing','SMS Marketing','Affiliate Marketing','PR & Communications','Market Research','Influencer Marketing'
  ],
  "Stores & Retail": [
    'Retail & Store Fit-out','Visual Merchandising','Point of Sale (POS) Setup','Storefront Signage','Shop Interior Design','Inventory Setup','E-commerce Setup','Marketplace Listings'
  ],
  "Education & Care": [
    'Tutoring','Education','Childcare & Nanny','Elderly Care','Pet Services'
  ],
  "Business & Pro": [
    'Legal Services','Accounting & Tax','Insurance','Real Estate','Architecture & Engineering'
  ],
  Misc: [
    'Tailoring & Alterations','Locksmith','Agriculture Services'
  ],
};

function useGroupedCategories(extra: string[]) {
  const groups = useMemo(() => {
    // Keep only categories that are in the canonical list
    const set = new Set([...(allCategories as readonly string[]), ...extra]);
    const filtered: Record<string, string[]> = {};
    for (const [g, list] of Object.entries(GROUPS)) {
      const valid = list.filter((c) => set.has(c));
      if (valid.length) filtered[g] = valid;
    }
    // Add any categories not present in groups into Misc
    const grouped = new Set(Object.values(filtered).flat());
    const missing = ([...set] as string[]).filter((c) => !grouped.has(c));
    if (missing.length) {
      filtered["Misc"] = [...(filtered["Misc"] || []), ...missing];
    }
    return filtered;
  }, []);
  return groups;
}

export default function CategoryCombobox({ value, onChange, allowAll, allValue, allLabel, placeholder, mergeCommunity }: CategoryComboboxProps) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const locale = getClientLocale();
  const [community, setCommunity] = useState<string[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!mergeCommunity) return;
      try {
        const snap = await getDocs(
          query(
            collection(db, 'services'),
            where('status', '==', 'approved'),
            limit(200)
          )
        );
        const set = new Set<string>();
        snap.forEach((d) => {
          const c = String((d.data() as any)?.category || '').trim();
          if (c) set.add(c.slice(0, 60));
        });
        // remove canonical ones
        const canonical = new Set(allCategories as readonly string[]);
        const extras = [...set].filter((c) => !canonical.has(c));
        if (alive) setCommunity(extras);
      } catch {
        if (alive) setCommunity([]);
      }
    })();
    return () => { alive = false; };
  }, [mergeCommunity]);

  const groups = useGroupedCategories(community);
  const allPairs = useMemo(() => Object.entries(groups).flatMap(([g, cats]) => cats.map((c) => ({ group: g, cat: c }))), [groups]);

  const items = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return allPairs;
    return allPairs.filter(({ cat }) => {
      const t = tr(locale, `categories.${cat}`);
      const label = t && t.startsWith('categories.') ? cat : t;
      return (label || cat).toLowerCase().includes(needle) || cat.toLowerCase().includes(needle);
    });
  }, [allPairs, q, locale]);

  const currentLabel = useMemo(() => {
    if (!value || value === allValue) return allLabel || placeholder || 'Category';
    const t = tr(locale, `categories.${value}`);
    return t && t.startsWith('categories.') ? value : t;
  }, [value, allValue, allLabel, placeholder, locale]);

  function select(val: string) {
    onChange(val);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="h-12 w-full justify-between">
          <span className="truncate mr-2">{currentLabel}</span>
          <ChevronDown className="h-4 w-4 opacity-70" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-2" align="start">
        <div className="p-1">
          <Input autoFocus placeholder={placeholder || 'Search category…'} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {allowAll && allValue && (
          <div className="p-1">
            <Button variant="ghost" className="w-full justify-start" onClick={() => select(allValue)}>
              {allLabel || 'All Categories'}
            </Button>
          </div>
        )}
        <Separator className="my-1" />
        <ScrollArea className="h-72 w-full">
          <div className="space-y-1 pr-1">
            {Object.entries(groups).map(([group, cats]) => {
              // Filter within group according to search
              const grouped = items.filter((it) => it.group === group);
              if (q.trim() && grouped.length === 0) return null;
              const toShow = q.trim() ? grouped.map((it) => it.cat) : cats;
              return (
                <div key={group} className="px-1 py-1">
                  <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">{group}</div>
                  <div className="grid gap-1">
                    {toShow.map((cat) => {
                      const t = tr(locale, `categories.${cat}`);
                      const label = t && t.startsWith('categories.') ? cat : t;
                      return (
                        <Button key={cat} variant={value === cat ? 'secondary' : 'ghost'} className="justify-start" onClick={() => select(cat)}>
                          {label}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
