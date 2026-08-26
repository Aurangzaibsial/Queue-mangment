/**
 * create-superadmin.js
 * ─────────────────────────────────────────────
 * One-time script to create (or update) the superadmin account.
 * Run: node create-superadmin.js
 * ─────────────────────────────────────────────
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const User = require('./models/User');

const SUPERADMIN_EMAIL    = 'superadmin@naubex.io';
const SUPERADMIN_PASSWORD = 'Admin@1234!';
const SUPERADMIN_NAME     = 'Platform Admin';

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/smart_queue_db');
    console.log('✅ Connected to MongoDB');

    const existing = await User.findOne({ email: SUPERADMIN_EMAIL });

    if (existing) {
      // Update role to superadmin in case it was changed
      existing.role = 'superadmin';
      existing.isActive = true;
      await existing.save({ validateBeforeSave: false });
      console.log(`✅ Superadmin already exists — role confirmed as superadmin`);
      console.log(`   Email   : ${SUPERADMIN_EMAIL}`);
    } else {
      await User.create({
        name: SUPERADMIN_NAME,
        email: SUPERADMIN_EMAIL,
        password: SUPERADMIN_PASSWORD,
        role: 'superadmin',
        isActive: true,
      });
      console.log('✅ Superadmin account created!');
      console.log(`   Email   : ${SUPERADMIN_EMAIL}`);
      console.log(`   Password: ${SUPERADMIN_PASSWORD}`);
      console.log('   ⚠️  Change this password after first login!');
    }

    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
})();
