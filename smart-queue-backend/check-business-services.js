const mongoose = require('mongoose');
require('dotenv').config();
const Business = require('./models/Business');
const Queue = require('./models/Queue');

async function check() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/smart-queue');
    const businesses = await Business.find({});
    console.log('Total businesses found:', businesses.length);
    let missingCount = 0;
    for (const b of businesses) {
      const queues = await Queue.find({ businessId: b._id });
      console.log(`[${b.category}] ${b.name} (slug: "${b.slug}") -> ${queues.length} services/queues`);
      if (queues.length === 0) {
        missingCount++;
      } else {
        queues.forEach(q => console.log(`   - ${q.serviceName} (${q.category}) [status: ${q.status}, isActive: ${q.isActive}, fee: $${q.serviceFee || 0}]`));
      }
    }
    console.log(`\nBusinesses without any queues: ${missingCount}`);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}
check();
