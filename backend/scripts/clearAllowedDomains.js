import prisma from '../config/database.js';

const result = await prisma.allowedDomain.deleteMany({});
console.log(`Removed ${result.count} allowed domain(s). Registration is now open to all domains.`);
await prisma.$disconnect();
