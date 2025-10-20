export type Plan = {
  id: 'basic' | 'pro' | 'enterprise';
  nameKey: string; // i18n key, e.g., pages.pricing.plans.basic.name
  price: number; // monthly price (USD by default)
  currency?: string; // display currency code
  perKey?: string; // i18n key for period label, e.g., pages.pricing.perMonth
  featuresKeys: string[]; // i18n keys for bullet features
  recommended?: boolean;
};

export const plans: Plan[] = [
  {
    id: 'basic',
    nameKey: 'pages.pricing.plans.basic.name',
    price: 29,
    currency: 'USD',
    perKey: 'pages.pricing.perMonth',
    featuresKeys: [
      'pages.pricing.features.basic.l1',
      'pages.pricing.features.basic.l2',
    ],
  },
  {
    id: 'pro',
    nameKey: 'pages.pricing.plans.pro.name',
    price: 79,
    currency: 'USD',
    perKey: 'pages.pricing.perMonth',
    featuresKeys: [
      'pages.pricing.features.pro.l1',
      'pages.pricing.features.pro.l2',
      'pages.pricing.features.pro.l3',
      'pages.pricing.features.pro.l4',
    ],
    recommended: true,
  },
  {
    id: 'enterprise',
    nameKey: 'pages.pricing.plans.enterprise.name',
    price: 149,
    currency: 'USD',
    perKey: 'pages.pricing.perMonth',
    featuresKeys: [
      'pages.pricing.features.enterprise.l1',
      'pages.pricing.features.enterprise.l2',
      'pages.pricing.features.enterprise.l3',
      'pages.pricing.features.enterprise.l4',
    ],
  },
];
