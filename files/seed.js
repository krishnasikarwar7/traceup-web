'use strict';

const path = require('path');
const dotenv = require('dotenv');
dotenv.config();
dotenv.config({ path: path.join(__dirname, '.env'), override: false });
const supabase = require('./config/db');
const User     = require('./models/User');
const Item     = require('./models/Item');

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
    security_question: readEnv('SEED_ADMIN_SECURITY_QUESTION', readEnv('ADMIN_SECURITY_QUESTION', 'What city were you born in?')),
    security_answer: requiredEnv('SEED_ADMIN_SECURITY_ANSWER', readEnv('ADMIN_SECURITY_ANSWER')),
  },
  student: {
    name: readEnv('SEED_STUDENT_NAME', 'Student User'),
    email: requiredEnv('SEED_STUDENT_EMAIL'),
    password: requiredEnv('SEED_STUDENT_PASSWORD'),
    department: readEnv('SEED_STUDENT_DEPARTMENT', 'Engineering'),
    security_question: readEnv('SEED_STUDENT_SECURITY_QUESTION', 'What was the name of your first pet?'),
    security_answer: requiredEnv('SEED_STUDENT_SECURITY_ANSWER'),
  },
};

async function seed() {
  console.log('🗑️  Clearing existing data...');

  // Delete in order: claims → items → users (respecting foreign keys)
  await supabase.from('claims').delete().not('id', 'is', null);
  await supabase.from('items').delete().not('id', 'is', null);
  await supabase.from('users').delete().not('id', 'is', null);

  console.log('👤 Creating users...');
  const admin = await User.create(seedConfig.admin);

  const student = await User.create({
    name: seedConfig.student.name,
    email: seedConfig.student.email,
    password: seedConfig.student.password,
    department: seedConfig.student.department,
    security_question: seedConfig.student.security_question,
    security_answer: seedConfig.student.security_answer,
  });

  console.log('📦 Creating items...');
  await Item.create({
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

  await Item.create({
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

  console.log('✅ Seed data successfully inserted into Supabase.');
  process.exit();
}

seed().catch(err => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
