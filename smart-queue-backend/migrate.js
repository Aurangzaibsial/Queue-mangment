const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const Business = require('./models/Business');
const User = require('./models/User');
const Queue = require('./models/Queue');
const Token = require('./models/Token');
const ServiceCounter = require('./models/ServiceCounter');

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/smart-queue')
  .then(async () => {
    let owner = await User.findOne({ role: 'superadmin' }) || await User.findOne();
    if (!owner) {
      owner = await User.create({ name: 'System', email: 'sys@a.com', password: 'password123', role: 'superadmin' });
    }

    let b = await Business.findOne({ slug: 'default' });
    if (!b) {
      b = await Business.create({ name: 'Default', slug: 'default', email: 'a@a.com', ownerId: owner._id });
    }

    await User.updateMany({ businessId: null }, { businessId: b._id });
    await Queue.updateMany({ businessId: { $exists: false } }, { businessId: b._id });
    await Token.updateMany({ businessId: { $exists: false } }, { businessId: b._id });
    await ServiceCounter.updateMany({ businessId: { $exists: false } }, { businessId: b._id });

    console.log('Migration complete');
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
