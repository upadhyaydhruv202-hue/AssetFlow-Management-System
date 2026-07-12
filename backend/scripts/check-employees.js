import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const users = await prisma.user.findMany({
  where: { role: 'EMPLOYEE' },
  select: { email: true, status: true },
});
console.log('Employees in DB:', users);
const testEmail = 'employee@assetflow.com';
const u = await prisma.user.findUnique({ where: { email: testEmail } });
console.log('employee@assetflow.com exists:', !!u);
if (u) {
  console.log('password ok:', await bcrypt.compare('Employee@123', u.password));
}
const kavya = await prisma.user.findUnique({ where: { email: 'kavya.iyer@assetflow.in' } });
if (kavya) {
  console.log('kavya password ok:', await bcrypt.compare('Employee@123', kavya.password));
}
await prisma.$disconnect();
