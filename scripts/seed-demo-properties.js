#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';
import { connectDatabase } from '../src/config/database.js';
import Property from '../src/models/Property.js';

const publicImagesDir = path.join(process.cwd(), 'public', 'images', 'demos');

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

function svgContent(id, title, color) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800">\n  <rect width="100%" height="100%" fill="${color}" />\n  <text x="50%" y="48%" font-size="48" fill="#ffffff" text-anchor="middle" font-family="Arial">${title}</text>\n  <text x="50%" y="60%" font-size="24" fill="#ffffff" text-anchor="middle" font-family="Arial">${id}</text>\n</svg>`;
}

const categories = [
  { key: 'house', title: 'House' },
  { key: 'flat', title: 'Flat' },
  { key: 'apartment', title: 'Apartment' },
];

const colors = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'];
const dhaLocations = [
  { phase: 'DHA Phase 1', block: 'H Block', latitude: 31.4686, longitude: 74.4081, street: 'Street 12' },
  { phase: 'DHA Phase 2', block: 'C Block', latitude: 31.4608, longitude: 74.4126, street: 'Street 8' },
  { phase: 'DHA Phase 3', block: 'Y Block', latitude: 31.4518, longitude: 74.4045, street: 'Street 19' },
  { phase: 'DHA Phase 4', block: 'M Block', latitude: 31.4475, longitude: 74.4149, street: 'Street 6' },
  { phase: 'DHA Phase 5', block: 'K Block', latitude: 31.4578, longitude: 74.3969, street: 'Street 15' },
  { phase: 'DHA Phase 6', block: 'R Block', latitude: 31.4692, longitude: 74.3927, street: 'Street 10' },
  { phase: 'DHA Phase 6', block: 'S Block', latitude: 31.4649, longitude: 74.3878, street: 'Street 22' },
  { phase: 'DHA Phase 7', block: 'B Block', latitude: 31.4877, longitude: 74.3903, street: 'Street 4' },
  { phase: 'DHA Phase 8', block: 'E Block', latitude: 31.4978, longitude: 74.4191, street: 'Street 17' },
  { phase: 'DHA Phase 8', block: 'H Block', latitude: 31.4906, longitude: 74.4282, street: 'Street 9' },
];

async function run() {
  await connectDatabase();
  console.log('Connected to DB for demo seeding');

  // clear previous demo-seed properties
  await Property.deleteMany({ ownerId: 'demo-seed' });

  // Instead of generating SVG placeholders, seed each demo property with photographic images
  // sourced from Unsplash using category-specific queries. Each property gets 3 distinct images.
  let created = 0;
  for (const cat of categories) {
    for (let i = 1; i <= 10; i++) {
      const idx = String(i).padStart(3, '0');
      const location = dhaLocations[i - 1];

      let query;
      if (cat.key === 'house') query = 'house,villa,home,exterior';
      else if (cat.key === 'apartment') query = 'apartment,condo,building,interior';
      else query = 'flat,studio,interior,apartment';

      const coverUrl = `https://source.unsplash.com/1200x800/?${encodeURIComponent(query)}&sig=${i}`;
      const img2Url = `https://source.unsplash.com/1200x800/?${encodeURIComponent(query)}&sig=${i + 100}`;
      const img3Url = `https://source.unsplash.com/1200x800/?${encodeURIComponent(query)}&sig=${i + 200}`;

      const prop = {
        title: `${cat.title} for Sale in ${location.phase}, DHA Lahore`,
        description: `A well-maintained ${cat.title.toLowerCase()} in ${location.block}, ${location.phase}, DHA Lahore, with convenient access to parks, schools, and commercial areas.`,
        type: cat.title,
        propertyType: cat.title,
        category: cat.title,
        location: location.phase,
        city: 'Lahore',
        phase: location.phase,
        block: location.block,
        address: `${i * 3} ${location.street}, ${location.block}, ${location.phase}, DHA Lahore`,
        latitude: location.latitude,
        longitude: location.longitude,
        bedrooms: Math.floor(Math.random() * 5) + 1,
        bathrooms: Math.floor(Math.random() * 3) + 1,
        area: Math.floor(Math.random() * 200) + 50,
        images: [coverUrl, img2Url, img3Url],
        image: coverUrl,
        ownerId: 'demo-seed',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await Property.create(prop);
      created++;
    }
  }

  console.log(`Seeded ${created} demo properties using Unsplash photographic images`);
  process.exit(0);
}

run().catch((err) => {
  console.error('Demo seed failed', err);
  process.exit(1);
});
