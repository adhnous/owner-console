import { z } from 'zod';

export const subServiceSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1, 'Enter a title').max(100),
  price: z.coerce.number().min(0, 'Price must be 0 or more'),
  unit: z.string().max(20).optional(),
  description: z.string().max(300).optional(),
});

export const serviceSchema = z.object({
  title: z.string().min(10, 'Title must be at least 10 characters long.').max(100, 'Title cannot exceed 100 characters.'),
  description: z.string().min(50, 'Description must be at least 50 characters.').max(800, 'Description cannot exceed 800 characters.'),
  price: z.coerce.number().min(0, 'Price must be 0 or more.'),
  category: z.string({required_error: "Please select a category."}).min(1, 'Please select a category.'),
  city: z.string({required_error: "Please select a city."}).min(1, 'Please select a city.'),
  area: z.string().min(2, 'Please provide a specific area or neighborhood.').max(50),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  // Optional map URL (Google Maps or OpenStreetMap). Empty string becomes undefined.
  mapUrl: z
    .preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), z.string().url('Enter a valid URL').optional()),
  availabilityNote: z.string().optional(),
  contactPhone: z.string().min(6, 'Enter a valid phone number.').max(20).optional(),
  contactWhatsapp: z.string().min(6, 'Enter a valid WhatsApp number.').max(20).optional(),
  // Optional YouTube video URL. Empty string becomes undefined.
  videoUrl: z
    .preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), z.string().url('Enter a valid URL').optional()),
  // New: multiple video URLs (YouTube). Empty items are filtered out on submit.
  videoUrls: z
    .array(z.string().url('Enter a valid URL'))
    .optional()
    .default([]),
  // New: social links (optional). Empty string becomes undefined.
  facebookUrl: z
    .preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), z.string().url('Enter a valid URL').optional()),
  telegramUrl: z
    .preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), z.string().url('Enter a valid URL').optional()),
  // images: z.any() // Image handling is complex, placeholder for now
  subservices: z.array(subServiceSchema).default([]),
});

export type ServiceFormData = z.infer<typeof serviceSchema>;
export type SubServiceFormData = z.infer<typeof subServiceSchema>;
