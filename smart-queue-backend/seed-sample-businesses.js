/**
 * seed-sample-businesses.js
 * ─────────────────────────────────────────────
 * Seed 3 Clinics, 3 Salons, 3 Grocery Stores, and 3 Beauty Parlors
 * with distinct ratings (3.8 to 4.9), prices ($0 to $60), tiers, and queue services.
 * ─────────────────────────────────────────────
 */
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const Business = require('./models/Business');
const User = require('./models/User');
const Queue = require('./models/Queue');

const sampleData = [
  // ── 🏥 3 CLINICS ──────────────────────────────────────────
  {
    name: 'Apex Health Clinic',
    slug: 'apex-health',
    tagline: 'Comprehensive family healthcare & urgent consultations',
    about: 'Top-rated multidisciplinary clinic with fast-track digital queues.',
    email: 'contact@apexhealth.com',
    city: 'New York',
    category: 'clinic',
    status: 'active',
    isActive: true,
    rating: { average: 4.9, count: 142 },
    pricing: { baseRate: 35, hourlyRate: 50, priceTier: 'standard', currency: 'USD' },
    primaryColor: '#0284C7',
    accentColor: '#0EA5E9',
    queues: [
      { serviceName: 'General Consultation', category: 'General', estimatedServiceTime: 10, serviceFee: 35, rating: { average: 4.9, count: 85 } },
      { serviceName: 'Express Triage Desk', category: 'Emergency', estimatedServiceTime: 5, serviceFee: 45, rating: { average: 4.8, count: 57 } }
    ]
  },
  {
    name: 'City Care Wellness Clinic',
    slug: 'city-care-wellness',
    tagline: 'Affordable outpatient doctor visits & blood diagnostics',
    about: 'Community wellness clinic providing budget consultations and routine checkups.',
    email: 'info@citycarewellness.com',
    city: 'Brooklyn',
    category: 'clinic',
    status: 'active',
    isActive: true,
    rating: { average: 4.3, count: 85 },
    pricing: { baseRate: 25, hourlyRate: 35, priceTier: 'budget', currency: 'USD' },
    primaryColor: '#0D9488',
    accentColor: '#14B8A6',
    queues: [
      { serviceName: 'General Practitioner', category: 'General', estimatedServiceTime: 15, serviceFee: 25, rating: { average: 4.3, count: 50 } },
      { serviceName: 'Lab & Diagnostics', category: 'Support', estimatedServiceTime: 8, serviceFee: 15, rating: { average: 4.4, count: 35 } }
    ]
  },
  {
    name: 'St. Jude Specialty Clinic',
    slug: 'st-jude-specialty',
    tagline: 'Premier specialist care & private medical consultations',
    about: 'High-end medical center specializing in cardiology, orthopedics, and neurology.',
    email: 'appointments@stjudeclinic.com',
    city: 'Manhattan',
    category: 'clinic',
    status: 'active',
    isActive: true,
    rating: { average: 3.8, count: 42 },
    pricing: { baseRate: 60, hourlyRate: 90, priceTier: 'premium', currency: 'USD' },
    primaryColor: '#4F46E5',
    accentColor: '#6366F1',
    queues: [
      { serviceName: 'Specialist Doctor Consultation', category: 'Technical', estimatedServiceTime: 25, serviceFee: 60, rating: { average: 3.8, count: 25 } },
      { serviceName: 'ECG & Imaging Desk', category: 'Support', estimatedServiceTime: 15, serviceFee: 40, rating: { average: 3.9, count: 17 } }
    ]
  },

  // ── 💇 3 SALONS ────────────────────────────────────────────
  {
    name: 'Glow & Style Hair Studio',
    slug: 'glow-style-studio',
    tagline: 'Modern hair styling, treatments & trendy cuts',
    about: 'Award winning hair stylists offering express cuts and luxury treatments.',
    email: 'hello@glowstyle.com',
    city: 'Brooklyn',
    category: 'salon',
    status: 'active',
    isActive: true,
    rating: { average: 4.7, count: 88 },
    pricing: { baseRate: 25, hourlyRate: 40, priceTier: 'budget', currency: 'USD' },
    primaryColor: '#D946EF',
    accentColor: '#EC4899',
    queues: [
      { serviceName: 'Express Haircut & Beard Trim', category: 'General', estimatedServiceTime: 15, serviceFee: 25, rating: { average: 4.7, count: 48 } },
      { serviceName: 'Color & Highlights Desk', category: 'VIP', estimatedServiceTime: 40, serviceFee: 65, rating: { average: 4.8, count: 40 } }
    ]
  },
  {
    name: 'Velvet Cuts & Luxury Salon',
    slug: 'velvet-cuts-salon',
    tagline: 'Premium men & women styling lounge with hair therapy',
    about: 'Top rated styling lounge providing keratin treatments, haircuts, and head massages.',
    email: 'booking@velvetcuts.com',
    city: 'Manhattan',
    category: 'salon',
    status: 'active',
    isActive: true,
    rating: { average: 4.5, count: 115 },
    pricing: { baseRate: 40, hourlyRate: 60, priceTier: 'standard', currency: 'USD' },
    primaryColor: '#8B5CF6',
    accentColor: '#A78BFA',
    queues: [
      { serviceName: 'Hair Styling & Keratin Treatment', category: 'General', estimatedServiceTime: 30, serviceFee: 40, rating: { average: 4.5, count: 70 } },
      { serviceName: 'VIP Grooming Suite', category: 'VIP', estimatedServiceTime: 45, serviceFee: 80, rating: { average: 4.6, count: 45 } }
    ]
  },
  {
    name: 'Urban Edge Barber & Salon',
    slug: 'urban-edge-barber',
    tagline: 'Quick budget haircuts, fade styling & beard shaping',
    about: 'Fast-paced neighborhood barber and salon with minimal queue wait time.',
    email: 'info@urbanedgebarber.com',
    city: 'Queens',
    category: 'salon',
    status: 'active',
    isActive: true,
    rating: { average: 4.1, count: 50 },
    pricing: { baseRate: 18, hourlyRate: 25, priceTier: 'budget', currency: 'USD' },
    primaryColor: '#374151',
    accentColor: '#6B7280',
    queues: [
      { serviceName: 'Standard Haircut & Shave', category: 'General', estimatedServiceTime: 12, serviceFee: 18, rating: { average: 4.1, count: 35 } },
      { serviceName: 'Beard Design & Trim', category: 'Support', estimatedServiceTime: 10, serviceFee: 12, rating: { average: 4.2, count: 15 } }
    ]
  },

  // ── 🛒 3 GROCERY STORES / MARTS ───────────────────────────
  {
    name: 'FreshMart Organic Grocery',
    slug: 'freshmart-organic-grocery',
    tagline: 'Farm fresh produce, organic groceries & express checkout',
    about: 'Neighborhood supermarket with organic food sections and digital self-checkout queues.',
    email: 'support@freshmart.com',
    city: 'New York',
    category: 'retail',
    status: 'active',
    isActive: true,
    rating: { average: 4.8, count: 195 },
    pricing: { baseRate: 0, hourlyRate: 0, priceTier: 'budget', currency: 'USD' },
    primaryColor: '#16A34A',
    accentColor: '#22C55E',
    queues: [
      { serviceName: 'Express Checkout (10 Items or Less)', category: 'General', estimatedServiceTime: 4, serviceFee: 0, rating: { average: 4.9, count: 130 } },
      { serviceName: 'Standard Checkout Counter', category: 'General', estimatedServiceTime: 8, serviceFee: 0, rating: { average: 4.7, count: 65 } }
    ]
  },
  {
    name: 'Metro Hypermarket & Superstore',
    slug: 'metro-hypermarket',
    tagline: 'Massive grocery store, household goods & meat market',
    about: 'One-stop shop for bulk groceries, electronics, and daily essentials with priority checkout counters.',
    email: 'contact@metrohypermarket.com',
    city: 'Brooklyn',
    category: 'retail',
    status: 'active',
    isActive: true,
    rating: { average: 4.4, count: 320 },
    pricing: { baseRate: 5, hourlyRate: 0, priceTier: 'budget', currency: 'USD' },
    primaryColor: '#2563EB',
    accentColor: '#3B82F6',
    queues: [
      { serviceName: 'Grocery Checkout Counter 1-5', category: 'General', estimatedServiceTime: 6, serviceFee: 0, rating: { average: 4.4, count: 200 } },
      { serviceName: 'Home Delivery & Order Pickup Counter', category: 'Support', estimatedServiceTime: 5, serviceFee: 5, rating: { average: 4.5, count: 120 } }
    ]
  },
  {
    name: 'GreenBasket Gourmet Grocery',
    slug: 'greenbasket-gourmet',
    tagline: 'Imported artisanal cheeses, fine wines & exotic foods',
    about: 'Boutique grocery store offering premium gourmet foods, international treats, and deli service.',
    email: 'orders@greenbasketgourmet.com',
    city: 'Manhattan',
    category: 'retail',
    status: 'active',
    isActive: true,
    rating: { average: 4.0, count: 60 },
    pricing: { baseRate: 12, hourlyRate: 0, priceTier: 'standard', currency: 'USD' },
    primaryColor: '#65A30D',
    accentColor: '#84CC16',
    queues: [
      { serviceName: 'Deli & Cheese Service Counter', category: 'General', estimatedServiceTime: 10, serviceFee: 12, rating: { average: 4.0, count: 40 } },
      { serviceName: 'Gourmet Gift Packing Counter', category: 'VIP', estimatedServiceTime: 15, serviceFee: 15, rating: { average: 4.1, count: 20 } }
    ]
  },

  // ── 💄 3 BEAUTY PARLORS & SPAS ────────────────────────────
  {
    name: 'Serenity Beauty Parlor & Spa',
    slug: 'serenity-beauty-parlor-spa',
    tagline: 'Luxury skincare, bridal makeup & relaxing body spa',
    about: 'Five-star rated ladies beauty parlor and spa providing facial treatments, massage, and bridal styling.',
    email: 'relax@serenitybeautyspa.com',
    city: 'Manhattan',
    category: 'salon',
    status: 'active',
    isActive: true,
    rating: { average: 4.9, count: 160 },
    pricing: { baseRate: 50, hourlyRate: 75, priceTier: 'premium', currency: 'USD' },
    primaryColor: '#C026D3',
    accentColor: '#E879F9',
    queues: [
      { serviceName: 'Hydra-Facial & Skin Care Desk', category: 'VIP', estimatedServiceTime: 35, serviceFee: 50, rating: { average: 4.9, count: 100 } },
      { serviceName: 'Bridal & Party Makeup Lounge', category: 'VIP', estimatedServiceTime: 60, serviceFee: 120, rating: { average: 5.0, count: 60 } }
    ]
  },
  {
    name: 'Rose Petals Beauty Parlor',
    slug: 'rose-petals-parlor',
    tagline: 'Expert threading, waxing, manicures & pedicures',
    about: 'Friendly neighborhood beauty parlor specializing in quick skin care, nails, and hair treatments.',
    email: 'info@rosepetalsparlor.com',
    city: 'Brooklyn',
    category: 'salon',
    status: 'active',
    isActive: true,
    rating: { average: 4.4, count: 75 },
    pricing: { baseRate: 30, hourlyRate: 45, priceTier: 'standard', currency: 'USD' },
    primaryColor: '#F43F5E',
    accentColor: '#FB7185',
    queues: [
      { serviceName: 'Threading & Waxing Counter', category: 'General', estimatedServiceTime: 15, serviceFee: 20, rating: { average: 4.4, count: 45 } },
      { serviceName: 'Gel Manicure & Pedicure Station', category: 'Support', estimatedServiceTime: 30, serviceFee: 35, rating: { average: 4.5, count: 30 } }
    ]
  },
  {
    name: 'Glamour Touch Ladies Parlor',
    slug: 'glamour-touch-parlor',
    tagline: 'Budget friendly beauty packages, hair oiling & facial',
    about: 'Affordable ladies salon and parlor offering daily grooming packages and fast service.',
    email: 'contact@glamourtouch.com',
    city: 'Queens',
    category: 'salon',
    status: 'active',
    isActive: true,
    rating: { average: 3.9, count: 35 },
    pricing: { baseRate: 20, hourlyRate: 30, priceTier: 'budget', currency: 'USD' },
    primaryColor: '#DB2777',
    accentColor: '#F472B6',
    queues: [
      { serviceName: 'Standard Facial & Clean-up', category: 'General', estimatedServiceTime: 20, serviceFee: 20, rating: { average: 3.9, count: 20 } },
      { serviceName: 'Hair Conditioning & Wash', category: 'Support', estimatedServiceTime: 15, serviceFee: 15, rating: { average: 4.0, count: 15 } }
    ]
  }
];

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/smart_queue_db');
    console.log('Connected to MongoDB');

    let owner = await User.findOne({ role: 'superadmin' });
    if (!owner) {
      owner = await User.create({
        name: 'Platform Admin',
        email: 'superadmin@naubex.io',
        password: 'Admin@1234!',
        role: 'superadmin',
        isActive: true
      });
    }

    // Clean existing sample businesses to ensure clean re-seed
    const slugs = sampleData.map(d => d.slug);
    const existing = await Business.find({ slug: { $in: slugs } });
    for (const b of existing) {
      await Queue.deleteMany({ businessId: b._id });
    }
    await Business.deleteMany({ slug: { $in: slugs } });
    console.log('Cleared existing sample data...');

    for (const data of sampleData) {
      const { queues, ...bData } = data;
      const b = await Business.create({ ...bData, ownerId: owner._id });
      console.log(`✅ Registered Business: [${b.category.toUpperCase()}] ${b.name} (${b.rating.average}★, $${b.pricing.baseRate})`);

      for (const q of queues) {
        await Queue.create({
          businessId: b._id,
          serviceName: q.serviceName,
          category: q.category,
          estimatedServiceTime: q.estimatedServiceTime,
          serviceFee: q.serviceFee,
          rating: q.rating,
          status: 'active',
          managedBy: owner._id
        });
      }
    }

    console.log('\n🎉 Successfully registered 12 Businesses (3 Clinics, 3 Salons, 3 Grocery Stores, 3 Spas/Parlors)!');
    process.exit(0);
  } catch (err) {
    console.error('Error seeding data:', err);
    process.exit(1);
  }
})();
