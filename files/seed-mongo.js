'use strict';

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Item = require('./models/Item');
const Claim = require('./models/Claim');
const connectDB = require('./config/db');

async function seed() {
  await connectDB();
  
  console.log('Dropping existing database...');
  await mongoose.connection.db.dropDatabase();

  console.log('Creating users...');
  const admin = await User.create({
    name: 'System Admin',
    email: 'admin@university.edu',
    password: 'admin123',
    role: 'admin',
    department: 'Security Office',
    phone: '555-0001'
  });

  const student = await User.create({
    name: 'Alex Johnson',
    email: 'alex@university.edu',
    password: 'pass1234',
    department: 'Engineering',
    phone: '555-0200'
  });

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
