import Property, { normalizePropertyImages } from '../models/Property.js';

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

import Tenant from '../models/Tenant.js';
import RentPayment from '../models/RentPayment.js';

export async function seedDemoIfMissing() {
  try {
    const existingDemoProperties = await Property.countDocuments({ ownerId: 'demo-seed' });
    if (existingDemoProperties > 0) {
      console.log(`Demo seeder kept ${existingDemoProperties} existing rental properties`);
      return;
    }

    let created = 0;
    for (const cat of categories) {
      for (let i = 1; i <= 10; i++) {
        const idx = String(i).padStart(3, '0');
        const location = dhaLocations[i - 1];
        const baseRent = cat.key === 'house' ? 45000 : cat.key === 'apartment' ? 32000 : 22000;
        const coverUrl = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svgContent(`${cat.key}-${idx}-cover`, cat.title, colors[i % colors.length]))}`;
        const img2Url = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svgContent(`${cat.key}-${idx}-interior`, `${cat.title} interior`, colors[(i + 1) % colors.length]))}`;
        const img3Url = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svgContent(`${cat.key}-${idx}-detail`, `${cat.title} details`, colors[(i + 2) % colors.length]))}`;

        const normalizedImages = normalizePropertyImages([coverUrl, img2Url, img3Url], coverUrl);
        const prop = {
          title: `${cat.title} for Rent in ${location.phase}, DHA Lahore`,
          description: `A well-maintained ${cat.title.toLowerCase()} for rent in ${location.block}, ${location.phase}, DHA Lahore, with convenient access to parks, schools, and commercial areas.`,
          type: cat.title,
          propertyType: cat.title,
          category: cat.title,
          purpose: 'Rent',
          transactionType: 'Rent',
          listingType: 'rent',
          status: 'For Rent',
          price: baseRent + i * 2500,
          rent: baseRent + i * 2500,
          rentPrice: baseRent + i * 2500,
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
          images: normalizedImages.images,
          image: normalizedImages.image,
          featuredImage: normalizedImages.featuredImage,
          ownerId: 'demo-seed',
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        await Property.create(prop);
        created++;
      }
    }

    console.log(`Demo seeder created ${created} rental properties with local generated images`);

    // --- Rent demo seeding: create sample tenants and 6 months of mixed payments ---
    try {
      // create a few tenants tied to demo properties
      const sampleTenants = [
        { name: 'Ali Khan', email: 'ali.khan@example.com', phone: '+923001111111', monthlyRent: 12000 },
        { name: 'Sara Ahmed', email: 'sara.ahmed@example.com', phone: '+923002222222', monthlyRent: 10000 },
        { name: 'Bilal Hussain', email: 'bilal.h@example.com', phone: '+923003333333', monthlyRent: 15000 },
      ];

      // pick a few demo properties to attach tenants to
      const demoProperties = await Property.find({ ownerId: 'demo-seed' }).limit(6).lean();

      for (let i = 0; i < sampleTenants.length; i++) {
        const t = sampleTenants[i];
        const assignedProp = demoProperties[i % demoProperties.length] || null;
        const tenantPayload = {
          userId: null,
          name: t.name,
          phone: t.phone,
          email: t.email,
          cnic: '',
          cnicImage: '',
          profileImage: '',
          propertyId: assignedProp ? String(assignedProp._id) : '',
          hostelId: assignedProp ? String(assignedProp._id) : '',
          roomNo: `R-${i + 1}`,
          monthlyRent: t.monthlyRent,
          securityDeposit: t.monthlyRent,
          dueDay: 5,
          moveInDate: new Date(Date.now() - (1000 * 60 * 60 * 24 * 30 * 6)),
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const createdTenant = await Tenant.create(tenantPayload);

        // create 6 months of rent records with mixed statuses
        const now = new Date();
        for (let m = 5; m >= 0; m--) {
          const dt = new Date(now.getFullYear(), now.getMonth() - m, 1);
          const monthKey = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
          const dueDate = new Date(dt.getFullYear(), dt.getMonth(), tenantPayload.dueDay || 5);
          const rand = Math.random();
          let status = 'pending';
          let amountPaid = 0;
          let paidDate = null;
          let lateDays = 0;

          if (rand > 0.7) {
            // on-time
            status = 'on_time';
            amountPaid = tenantPayload.monthlyRent;
            paidDate = new Date(dueDate.getTime() - (1000 * 60 * 60 * 24 * Math.floor(Math.random() * 3))); // before due
          } else if (rand > 0.4) {
            // late
            status = 'late';
            lateDays = Math.floor(Math.random() * 10) + 1;
            amountPaid = tenantPayload.monthlyRent;
            paidDate = new Date(dueDate.getTime() + (1000 * 60 * 60 * 24 * lateDays));
          } else if (rand > 0.2) {
            // partial
            status = 'partial';
            amountPaid = Math.round(tenantPayload.monthlyRent * 0.5);
            paidDate = new Date(dueDate.getTime() + (1000 * 60 * 60 * 24 * 2));
            lateDays = 2;
          } else {
            // unpaid / overdue
            status = 'overdue';
            amountPaid = 0;
            paidDate = null;
            lateDays = Math.max(0, Math.ceil((new Date() - dueDate) / (1000 * 60 * 60 * 24)));
          }

          // avoid duplicates
          const exists = await RentPayment.findOne({ tenantId: createdTenant._id, month: monthKey }).lean();
          if (exists) continue;

          await RentPayment.create({
            tenantId: createdTenant._id,
            month: monthKey,
            amountDue: Number(tenantPayload.monthlyRent || 0),
            amountPaid,
            dueDate,
            paidDate,
            status,
            lateDays,
            lateFee: Math.max(0, lateDays * 100),
            method: amountPaid > 0 ? 'bank' : 'cash',
            proofImage: '',
            verifiedByAdmin: false,
            notes: '',
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
      }

      console.log('Seeded demo tenants and 6 months of mixed rent payments');
    } catch (e) {
      console.warn('Rent demo seeding failed', e && e.message ? e.message : e);
    }

    return true;
  } catch (error) {
    console.error('Demo seeder error', error);
    return false;
  }
}
