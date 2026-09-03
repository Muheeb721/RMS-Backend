import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let memoryServer = null;

export async function connectDatabase() {
  const mongoUri = process.env.MONGODB_URI?.trim();

  mongoose.set('strictQuery', true);

  if (mongoUri) {
    try {
      await mongoose.connect(mongoUri);
      console.log('MongoDB connected');
      return;
    } catch (error) {
      console.warn('Primary MongoDB connection failed; falling back to in-memory MongoDB.', error.message);
    }
  }

  if (!memoryServer) {
    memoryServer = await MongoMemoryServer.create({
      instance: {
        dbName: 'rms_local',
      },
    });
  }

  const fallbackUri = memoryServer.getUri();
  await mongoose.connect(fallbackUri);
  console.log('MongoDB connected to in-memory fallback database');
}

export async function closeDatabase() {
  await mongoose.disconnect();

  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
}
