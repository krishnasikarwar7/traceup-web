'use strict';

const path = require('path');
const dotenv = require('dotenv');
dotenv.config();
dotenv.config({ path: path.join(__dirname, '.env'), override: false });
const mongoose = require('mongoose');
const User = require('./models/User');
const Item = require('./models/Item');
const Claim = require('./models/Claim');
const connectDB = require('./config/db');

const readEnv = (name, fallback = '') => {
  const value = process.env[name];
  if (typeof value === 'string') return value.trim();
  return fallback;
};

const requiredEnv = (name, fallback = '') => {
  const value = readEnv(name, fallback);
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

const seedConfig = {
  admin: {
    name: readEnv('SEED_ADMIN_NAME', readEnv('ADMIN_NAME', 'System Admin')),
    email: requiredEnv('SEED_ADMIN_EMAIL', readEnv('ADMIN_EMAIL')),
    password: requiredEnv('SEED_ADMIN_PASSWORD', readEnv('ADMIN_PASSWORD')),
    role: 'admin',
    department: readEnv('SEED_ADMIN_DEPARTMENT', readEnv('ADMIN_DEPARTMENT', 'Security Office')),
    phone: readEnv('SEED_ADMIN_PHONE', '555-0001'),
  },
  student: {
    name: readEnv('SEED_STUDENT_NAME', 'Student User'),
    email: requiredEnv('SEED_STUDENT_EMAIL'),
    password: requiredEnv('SEED_STUDENT_PASSWORD'),
    department: readEnv('SEED_STUDENT_DEPARTMENT', 'Engineering'),
    phone: readEnv('SEED_STUDENT_PHONE', '555-0200'),
  },
};

async function seed() {
  await connectDB();
  
  console.log('Dropping existing database...');
  await mongoose.connection.db.dropDatabase();

  console.log('Creating users...');
  const admin = await User.create(seedConfig.admin);

  const student = await User.create(seedConfig.student);

  console.log('Creating items...');
  const item1 = await Item.create({
    title: 'MacBook Pro 14"',
    category: 'Electronics',
    description: 'Silver M2 Pro with stickers. Left in the main library.',
    location: 'Main Library',
    date_lost: '2023-11-20',
    time_lost: '14:30',
    type: 'lost',
    brand: 'Apple',
    color: 'Silver',
    reward: '$50',
    user_id: student.id
  });

  const item2 = await Item.create({
    title: 'Brown Leather Wallet',
    category: 'Wallets',
    description: 'Found near the cafeteria entrance. Has a university ID inside.',
    location: 'Cafeteria',
    date_lost: '2023-11-21',
    time_lost: '09:15',
    type: 'found',
    color: 'Brown',
    user_id: admin.id
  });

  console.log('Seed data successfully inserted into MongoDB.');
  process.exit();
}

seed();
