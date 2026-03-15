'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const supabase = require('./config/db');
const User     = require('./models/User');
const Item     = require('./models/Item');

async function seed() {
  console.log('🗑️  Clearing existing data...');

  // Delete in order: claims → items → users (respecting foreign keys)
  await supabase.from('claims').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('users').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  console.log('👤 Creating users...');
  const admin = await User.create({
    name: 'System Admin',
    email: 'admin@university.edu',
    password: 'admin123',
    role: 'admin',
    department: 'Security Office',
    security_question: 'What city were you born in?',
    security_answer: 'Delhi'
  });

  const student = await User.create({
    name: 'Alex Johnson',
    email: 'alex@university.edu',
    password: 'pass1234',
    department: 'Engineering',
    security_question: 'What was the name of your first pet?',
    security_answer: 'Buddy'
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
