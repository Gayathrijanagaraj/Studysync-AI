require('dotenv').config();
const dns = require('dns');
try { dns.setServers(['8.8.8.8', '8.8.4.4']); } catch (e) {}
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const seedData = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/studysync_ai';
    console.log(`[Seed] Connecting to MongoDB: ${mongoUri}`);
    await mongoose.connect(mongoUri);

    console.log('[Seed] Clearing existing demo users...');
    await User.deleteMany({
      email: {
        $in: [
          'admin@studysync.ai',
          'gayathri@studysync.ai',
          'swetha@studysync.ai',
          'srithanvarsha@studysync.ai'
        ]
      }
    });

    const defaultPasswordHash = await bcrypt.hash('Student@123', 10);
    const adminPasswordHash = await bcrypt.hash('Admin@123', 10);

    const usersToCreate = [
      {
        name: 'Platform Administrator',
        email: 'admin@studysync.ai',
        passwordHash: adminPasswordHash,
        role: 'admin',
        institution: 'StudySync AI System',
        department: 'Operations',
        isActive: true
      },
      {
        name: 'Gayathri',
        email: 'gayathri@studysync.ai',
        passwordHash: defaultPasswordHash,
        role: 'student',
        institution: 'MCA Department',
        department: 'Computer Science',
        isActive: true
      },
      {
        name: 'Srithanvarsha',
        email: 'srithanvarsha@studysync.ai',
        passwordHash: defaultPasswordHash,
        role: 'student',
        institution: 'MCA Department',
        department: 'Computer Science',
        isActive: true
      },
      {
        name: 'Swetha',
        email: 'swetha@studysync.ai',
        passwordHash: defaultPasswordHash,
        role: 'student',
        institution: 'MCA Department',
        department: 'Computer Science',
        isActive: true
      }
    ];

    const createdUsers = await User.insertMany(usersToCreate);
    console.log(`[Seed] Successfully seeded ${createdUsers.length} users!`);
    console.log('----------------------------------------------------');
    console.log('Seed Credentials:');
    console.log('Admin:   admin@studysync.ai      / Admin@123');
    console.log('Student: gayathri@studysync.ai   / Student@123');
    console.log('Student: srithanvarsha@studysync.ai / Student@123');
    console.log('Student: swetha@studysync.ai     / Student@123');
    console.log('----------------------------------------------------');

    await mongoose.disconnect();
    console.log('[Seed] MongoDB disconnected.');
    process.exit(0);
  } catch (error) {
    console.error('[Seed Error]:', error);
    process.exit(1);
  }
};

seedData();
