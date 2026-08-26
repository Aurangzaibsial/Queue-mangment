const mongoose = require('mongoose');
require('dotenv').config();
const Business = require('./models/Business');
const Queue = require('./models/Queue');

const getDefaultQueuesForCategory = (category, baseRate = 0) => {
  switch (category) {
    case 'clinic':
      return [
        { serviceName: 'General Consultation', category: 'General', estimatedServiceTime: 12, serviceFee: baseRate || 30, description: 'Routine checkups, vitals and primary doctor consult' },
        { serviceName: 'Express Triage & Diagnostics', category: 'Emergency', estimatedServiceTime: 6, serviceFee: (baseRate || 30) + 15, description: 'Urgent care triage, blood work and rapid tests' },
      ];
    case 'salon':
      return [
        { serviceName: 'Haircut & Styling Desk', category: 'General', estimatedServiceTime: 20, serviceFee: baseRate || 25, description: 'Custom hair styling, trimming, wash and blowdry' },
        { serviceName: 'VIP Treatment & Color Lounge', category: 'VIP', estimatedServiceTime: 35, serviceFee: (baseRate || 25) + 30, description: 'Keratin hair therapy, facial and premium styling' },
      ];
    case 'retail':
      return [
        { serviceName: 'Express Checkout Counter', category: 'General', estimatedServiceTime: 5, serviceFee: 0, description: 'Fast 1-10 items billing queue' },
        { serviceName: 'Customer Support & Returns', category: 'Support', estimatedServiceTime: 8, serviceFee: 0, description: 'Order pickups, refunds and product support' },
      ];
    case 'restaurant':
      return [
        { serviceName: 'Dine-In Table Reservation Queue', category: 'General', estimatedServiceTime: 15, serviceFee: baseRate || 0, description: 'Host desk queue for table seating' },
        { serviceName: 'Express Takeout & Delivery Desk', category: 'General', estimatedServiceTime: 5, serviceFee: 0, description: 'Quick pickup for takeaway orders' },
      ];
    case 'bank':
      return [
        { serviceName: 'Cashier & Deposit Counter', category: 'Billing', estimatedServiceTime: 8, serviceFee: 0, description: 'Cash deposits, withdrawals, utility payments' },
        { serviceName: 'Personal Banker & Accounts', category: 'Technical', estimatedServiceTime: 18, serviceFee: 0, description: 'Account opening, loans, cards and wealth management' },
      ];
    case 'fitness':
      return [
        { serviceName: 'Gym Floor & Workout Check-In', category: 'General', estimatedServiceTime: 5, serviceFee: baseRate || 15, description: 'Access verification and locker assignment' },
        { serviceName: 'Personal Trainer Consultation', category: 'VIP', estimatedServiceTime: 25, serviceFee: (baseRate || 15) + 35, description: 'Body composition analysis & private coaching' },
      ];
    default:
      return [
        { serviceName: 'General Service Desk', category: 'General', estimatedServiceTime: 10, serviceFee: baseRate || 0, description: 'Primary customer service and inquiry queue' },
        { serviceName: 'Express Counter', category: 'Support', estimatedServiceTime: 5, serviceFee: baseRate || 0, description: 'Quick consultations and document processing' },
      ];
  }
};

async function seedMissingQueues() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/smart-queue');
    const businesses = await Business.find({});
    console.log(`Checking ${businesses.length} businesses...`);

    for (const b of businesses) {
      const existingQueues = await Queue.find({ businessId: b._id, isActive: true });
      if (existingQueues.length === 0) {
        console.log(`Creating default queues for ${b.name} (${b.category})...`);
        const templates = getDefaultQueuesForCategory(b.category, b.pricing?.baseRate || 0);
        for (const t of templates) {
          await Queue.create({
            businessId: b._id,
            serviceName: t.serviceName,
            category: t.category,
            estimatedServiceTime: t.estimatedServiceTime,
            serviceFee: t.serviceFee,
            description: t.description,
            managedBy: b.ownerId,
            status: 'active',
            isActive: true,
          });
          console.log(`   + Created queue: ${t.serviceName}`);
        }
      } else {
        console.log(`✓ ${b.name} already has ${existingQueues.length} active service queues.`);
      }
    }

    console.log('\nAll registered businesses now have active services/queues!');
  } catch (err) {
    console.error('Error seeding queues:', err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

seedMissingQueues();
