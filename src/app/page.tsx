<<<<<<< HEAD
import Link from 'next/link';

export default function Home() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Owner Console</h1>
      <p className="mt-2">
        Go to <Link className="underline" href="/services">Services Moderation</Link>,{' '}
        <Link className="underline" href="/ads">Ads Manager</Link> or{' '}
        <Link className="underline" href="/login">Login</Link>.
      </p>
=======
"use client";

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Briefcase,
  Car,
  Hammer,
  Home as HomeIcon,
  Search,
  Megaphone,
  ShoppingCart,
} from 'lucide-react';
import { Footer } from '@/components/layout/footer';
import { Header } from '@/components/layout/header';
import { ServiceCard } from '@/components/service-card';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { listServicesFiltered, type Service, type ListFilters } from '@/lib/services';
import { getClientLocale, tr } from '@/lib/i18n';
import { libyanCities, cityLabel } from '@/lib/cities';
import { categories as allCategories } from '@/lib/categories';
import CategoryCombobox from '@/components/category-combobox';


const featuredCategories = [
  { name: 'Education', icon: Briefcase },
  { name: 'Home Services', icon: HomeIcon },
  { name: 'Automotive', icon: Car },
  { name: 'Electrical', icon: Hammer },
  { name: 'Digital Marketing', icon: Megaphone },
  { name: 'Sales', icon: ShoppingCart },
];
// Stable sentinel values so labels can be localized while values remain constant
const ALL_CATEGORIES = 'ALL_CATEGORIES';
const ALL_CITIES = 'ALL_CITIES';
const cityOptions = [ALL_CITIES, ...libyanCities.map((c) => c.value)];

export default function Home() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [q, setQ] = useState('');
  const [city, setCity] = useState<string>(ALL_CITIES);
  const [category, setCategory] = useState<string>(ALL_CATEGORIES);
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [sort, setSort] = useState<'newest' | 'priceLow' | 'priceHigh'>('newest');
  const [searchFocused, setSearchFocused] = useState(false);
  const locale = getClientLocale();

  useEffect(() => {
    // Initial load
    void fetchServices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Auto-refetch on filter changes except text query (which requires pressing Search)
    void fetchServices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city, category, maxPrice, sort]);

  async function fetchServices() {
    try {
      setLoading(true);
      const filters: ListFilters = {};
      if (category && category !== ALL_CATEGORIES) filters.category = category;
      if (city && city !== ALL_CITIES) filters.city = city;
      if (maxPrice) filters.maxPrice = Number(maxPrice);
      const data = await listServicesFiltered({ ...filters, limit: 24 });
      const needle = q.trim().toLowerCase();
      let filtered = needle
        ? data.filter((s) =>
            (s.title || '').toLowerCase().includes(needle) ||
            (s.description || '').toLowerCase().includes(needle) ||
            (s.category || '').toLowerCase().includes(needle) ||
            (s.city || '').toLowerCase().includes(needle)
          )
        : data;
      // Apply client-side sort for price; for newest, keep backend default
      if (sort === 'priceLow') {
        filtered = [...filtered].sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
      } else if (sort === 'priceHigh') {
        filtered = [...filtered].sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
      }
      // Promote services flagged as boosted/featured to the top while preserving current order within groups
      {
        const isBoosted = (s: Service) => (((s as any)?.priority ?? 0) > 0) || ((s as any)?.featured === true);
        if (filtered.some((s) => isBoosted(s))) {
          const boosted = filtered.filter(isBoosted);
          const normal = filtered.filter((s) => !isBoosted(s));
          filtered = [...boosted, ...normal];
        }
      }
      setServices(filtered);
    } catch (e) {
      console.warn('Failed to load services, showing empty state.', e);
      setServices([]);
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="flex min-h-screen flex-col bg-ink">
      <Header />
      <main className="flex-1">
        <section className="relative bg-gradient-to-b from-ink via-copperDark to-copper text-snow overflow-hidden py-12 md:py-24">
          <div className="container relative text-center">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold leading-tight font-headline">
              {tr(locale, 'home.heroTitle')}
            </h1>
            <p className="mt-3 text-base md:text-lg text-snow/80">
              {tr(locale, 'home.heroSubtitle')}
            </p>
            <div className="mt-6 mb-5 flex flex-wrap items-center justify-center gap-2 md:gap-3">
              <Link href="/dashboard/services">
                <Button size="sm" className="h-9 md:h-10 bg-copper hover:bg-copperDark text-ink font-semibold">
                  {tr(locale, 'home.providerCta')}
                </Button>
              </Link>
              <Link href="#search">
                <Button size="sm" className="h-9 md:h-10 bg-power hover:bg-powerDark text-snow font-semibold">
                  {tr(locale, 'home.seekerCta')}
                </Button>
              </Link>
            </div>
            <div id="search" className="mx-auto max-w-6xl mt-6 scroll-mt-[calc(var(--ad-height,0px)+4rem)]">
              <div className="rounded-2xl copper-gradient p-[2px]">
                <div className="rounded-[1rem] bg-background text-foreground p-3 md:p-4 shadow-lg">
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-7">
                  <div className="md:col-span-2">
                    <Input
                      type="text"
                      inputMode="search"
                      autoComplete="off"
                      placeholder={tr(locale, 'home.searchPlaceholder')}
                      className="h-11 text-sm md:text-base text-foreground placeholder:text-muted-foreground"
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      onFocus={() => setSearchFocused(true)}
                      onBlur={() => setSearchFocused(false)}
                    />
                  </div>
                  <CategoryCombobox
                    value={category}
                    onChange={setCategory}
                    allowAll
                    allValue={ALL_CATEGORIES}
                    allLabel={tr(locale, 'home.allCategories')}
                    placeholder={tr(locale, 'home.categoryPlaceholder')}
                    mergeCommunity
                  />
                  <Select value={city} onValueChange={setCity}>
                    <SelectTrigger className="h-11 text-sm md:text-base text-foreground">
                      <SelectValue className="text-foreground" placeholder={tr(locale, 'home.cityPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_CITIES}>{tr(locale, 'home.allCities')}</SelectItem>
                      {libyanCities.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {cityLabel(locale, c.value)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    inputMode="numeric"
                    dir="ltr"
                    placeholder={tr(locale, 'home.maxPricePlaceholder')}
                    className="h-11 text-sm md:text-base text-foreground placeholder:text-muted-foreground"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                  />
                  <Select value={sort} onValueChange={(v) => setSort(v as any)}>
                    <SelectTrigger className="h-11 text-sm md:text-base text-foreground">
                      <SelectValue className="text-foreground" placeholder={tr(locale, 'home.sortBy')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="newest">{tr(locale, 'home.sortNewest')}</SelectItem>
                      <SelectItem value="priceLow">{tr(locale, 'home.sortPriceLow')}</SelectItem>
                      <SelectItem value="priceHigh">{tr(locale, 'home.sortPriceHigh')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="lg" className="h-11 md:h-12 text-base" onClick={fetchServices}>
                    <Search className="mr-2" />
                    {tr(locale, 'home.search')}
                  </Button>
                </div>
                {!(searchFocused || q.trim().length > 0) && (
                  <div className="mt-4 border-t pt-4">
                    <h3 className="mb-3 text-sm font-semibold text-foreground/70">
                      {tr(locale, 'home.featuredCategories')}
                    </h3>
                    <div className="grid grid-cols-2 gap-2 sm:gap-3 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6">
                      {featuredCategories.map((categoryItem) => (
                        <Button
                          key={categoryItem.name}
                          variant="ghost"
                          aria-label={tr(locale, `categories.${categoryItem.name}`)}
                          aria-pressed={category === categoryItem.name}
                          className={`group h-20 md:h-24 w-full overflow-hidden rounded-xl border bg-gradient-to-br from-background to-secondary/50 p-0 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
                            category === categoryItem.name
                              ? 'ring-2 ring-primary/50 border-primary/40'
                              : 'border-border/60 hover:border-primary/30'
                          }`}
                          onClick={() => setCategory(categoryItem.name)}
                        >
                          <div className="flex h-full w-full items-center justify-center gap-3 p-4 md:p-5">
                            <div className={`rounded-full p-2.5 md:p-3 ring-1 ${
                              category === categoryItem.name ? 'bg-primary/10 ring-primary/40' : 'bg-primary/5 ring-primary/20 group-hover:bg-primary/10'
                            }`}>
                              <categoryItem.icon className="h-5 w-5 md:h-6 md:w-6 text-primary" />
                            </div>
                            <span className={`text-sm font-medium ${category === categoryItem.name ? 'text-foreground' : 'text-foreground/90'}`}>
                              {tr(locale, `categories.${categoryItem.name}`)}
                            </span>
                          </div>
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          </div>
        </section>

        

        <section className="bg-secondary py-12">
          <div className="container">
            <h2 className="mb-8 text-2xl md:text-3xl font-bold font-headline">
              {tr(locale, 'home.popularServices')}
            </h2>
            {loading && (
              <p className="mb-6 text-muted-foreground">{tr(locale, 'home.loading')}</p>
            )}
            {services.length === 0 && (
              <div className="mb-6 rounded-lg border bg-background p-4 text-sm text-muted-foreground">
                <p className="mb-2">{tr(locale, 'home.empty1')}</p>
                <p>{tr(locale, 'home.empty2')}</p>
              </div>
            )}
            <div className="grid grid-cols-1 gap-2 sm:gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {services.map((s) => (
                <ServiceCard
                  key={s.id}
                  id={s.id}
                  title={s.title}
                  category={s.category}
                  city={s.city}
                  price={s.price}
                  imageUrl={s.images?.[0]?.url || 'https://placehold.co/400x300.png'}
                  aiHint={s.category}
                  href={`/services/${s.id}`}
                />
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
>>>>>>> origin/main
    </div>
  );
}
