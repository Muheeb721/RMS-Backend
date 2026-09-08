import fs from 'fs/promises';
import path from 'path';
import Property from '../models/Property.js';

function svgContent(id, title, color) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800">\n  <rect width="100%" height="100%" fill="${color}" />\n  <text x="50%" y="48%" font-size="48" fill="#ffffff" text-anchor="middle" font-family="Arial">${title}</text>\n  <text x="50%" y="60%" font-size="24" fill="#ffffff" text-anchor="middle" font-family="Arial">${id}</text>\n</svg>`;
}

const categories = [
  { key: 'house', title: 'House' },
  { key: 'flat', title: 'Flat' },
  { key: 'apartment', title: 'Apartment' },
];

const colors = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'];

export async function seedDemoIfMissing() {
  try {
    // Remove any previous demo-seed entries so seeding is idempotent and uses photographic images
    await Property.deleteMany({ ownerId: 'demo-seed' });

    // Use real photographic images from Unsplash (category-specific queries).
    // Each property will have 3 distinct images (cover + 2 additional) and the backend stores them.
    const imageBase = process.env.BACKEND_URL || 'http://localhost:5000';
    let created = 0;
    for (const cat of categories) {
      for (let i = 1; i <= 10; i++) {
        const idx = String(i).padStart(3, '0');
        // build category-specific Unsplash query seeds to return photographic images
        let query;
        if (cat.key === 'house') query = 'house,villa,home,exterior';
        else if (cat.key === 'apartment') query = 'apartment,condo,building,interior';
        else query = 'flat,studio,interior,apartment';

        const coverUrl = `https://source.unsplash.com/1200x800/?${encodeURIComponent(query)}&sig=${i}`;
        const img2Url = `https://source.unsplash.com/1200x800/?${encodeURIComponent(query)}&sig=${i + 100}`;
        const img3Url = `https://source.unsplash.com/1200x800/?${encodeURIComponent(query)}&sig=${i + 200}`;

        const prop = {
          title: `${cat.title} Demo ${i}`,
          description: `Demo ${cat.title} property number ${i}.`,
          type: cat.title,
          propertyType: cat.title,
          category: cat.title,
          location: 'Demo City',
          city: 'Demo City',
          address: `${i} Demo Street`,
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

    console.log(`Demo seeder created ${created} properties with Unsplash photographic images`);
    return true;
  } catch (error) {
    console.error('Demo seeder error', error);
    return false;
  }
}
