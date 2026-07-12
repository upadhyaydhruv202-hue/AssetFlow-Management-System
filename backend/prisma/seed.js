import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const MS_DAY = 86400000;
const daysAgo = (n) => new Date(Date.now() - n * MS_DAY);
const daysFromNow = (n) => new Date(Date.now() + n * MS_DAY);
const hoursFromNow = (n) => new Date(Date.now() + n * 3600000);

async function wipeDemoData() {
  await prisma.sparePartUsage.deleteMany();
  await prisma.bookingWaitlist.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.maintenanceRequest.deleteMany();
  await prisma.allocation.updateMany({ data: { signatureId: null } });
  await prisma.transfer.updateMany({ data: { signatureId: null } });
  await prisma.transfer.deleteMany();
  await prisma.allocation.deleteMany();
  await prisma.digitalSignature.deleteMany();
  await prisma.auditItem.deleteMany();
  await prisma.auditAssignment.deleteMany();
  await prisma.auditOfflineSync.deleteMany();
  await prisma.auditCycle.deleteMany();
  await prisma.assetHistory.deleteMany();
  await prisma.custodyEvent.deleteMany();
  await prisma.sensorReading.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.activityLog.deleteMany();
  await prisma.securityEvent.deleteMany();
  await prisma.trustedDevice.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.magicLink.deleteMany();
  await prisma.mfaOtp.deleteMany();
  await prisma.webAuthnCredential.deleteMany();
  await prisma.dailyAiSummary.deleteMany();
  await prisma.importJob.deleteMany();
  await prisma.asset.deleteMany();
  await prisma.approvalMatrix.deleteMany();
  await prisma.sparePart.deleteMany();
  await prisma.assetCategory.deleteMany();
  await prisma.department.updateMany({ data: { departmentHeadId: null, parentId: null } });
  await prisma.department.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.user.deleteMany();
}

async function createUser({ email, password, role, firstName, lastName, phone, departmentId, joinedDaysAgo = 365 }) {
  const hash = await bcrypt.hash(password, 12);
  return prisma.user.create({
    data: {
      email,
      password: hash,
      role,
      status: 'ACTIVE',
      emailVerified: true,
      lastLoginAt: daysAgo(Math.floor(Math.random() * 7)),
      lastLoginIp: '103.21.45.' + Math.floor(Math.random() * 200),
      lastLoginCountry: 'IN',
      lastLoginBrowser: 'Chrome/122 Windows',
      employee: {
        create: {
          firstName,
          lastName,
          phone,
          departmentId,
          status: 'ACTIVE',
          createdAt: daysAgo(joinedDaysAgo),
        },
      },
    },
    include: { employee: true },
  });
}

async function main() {
  console.log('🌱 Seeding AssetFlow with realistic Indian enterprise data...\n');

  await wipeDemoData();

  const adminPwd = 'Admin@123';
  const empPwd = 'Employee@123';

  // ─── Departments ─────────────────────────────────────────
  const itDept = await prisma.department.create({
    data: { name: 'Information Technology', code: 'IT', description: 'Technology infrastructure and software', status: 'ACTIVE' },
  });
  const hrDept = await prisma.department.create({
    data: { name: 'Human Resources', code: 'HR', description: 'People operations and talent management', status: 'ACTIVE' },
  });
  const finDept = await prisma.department.create({
    data: { name: 'Finance', code: 'FIN', description: 'Financial planning and accounts', status: 'ACTIVE' },
  });
  const opsDept = await prisma.department.create({
    data: { name: 'Operations', code: 'OPS', description: 'Business operations and logistics', status: 'ACTIVE', parentId: itDept.id },
  });
  const admDept = await prisma.department.create({
    data: { name: 'Administration', code: 'ADM', description: 'Facilities and general administration', status: 'ACTIVE' },
  });

  // ─── Users & Employees ───────────────────────────────────
  const admin = await createUser({
    email: 'admin@assetflow.com', password: adminPwd, role: 'ADMIN',
    firstName: 'Vikram', lastName: 'Mehta', phone: '+91-98765-43210', joinedDaysAgo: 1200,
  });

  const employees = [];
  const empSpecs = [
    { email: 'employee@assetflow.com', firstName: 'Kavya', lastName: 'Iyer', phone: '+91-99001-22334', dept: itDept.id, joined: 400 },
    { email: 'rahul.menon@assetflow.in', firstName: 'Rahul', lastName: 'Menon', phone: '+91-99112-44556', dept: itDept.id, joined: 320 },
    { email: 'divya.singh@assetflow.in', firstName: 'Divya', lastName: 'Singh', phone: '+91-99223-66778', dept: hrDept.id, joined: 280 },
    { email: 'suresh.pillai@assetflow.in', firstName: 'Suresh', lastName: 'Pillai', phone: '+91-99334-88990', dept: finDept.id, joined: 500 },
    { email: 'meera.kulkarni@assetflow.in', firstName: 'Meera', lastName: 'Kulkarni', phone: '+91-99445-00112', dept: opsDept.id, joined: 180 },
  ];
  for (const e of empSpecs) {
    employees.push(await createUser({
      email: e.email, password: empPwd, role: 'EMPLOYEE',
      firstName: e.firstName, lastName: e.lastName, phone: e.phone, departmentId: e.dept, joinedDaysAgo: e.joined,
    }));
  }

  const allUsers = [admin, ...employees];
  const A = admin.employee;
  const E = employees.map((u) => u.employee);

  // ─── Categories ────────────────────────────────────────────
  const catLaptop = await prisma.assetCategory.create({ data: { name: 'Laptop', description: 'Portable computing devices', warrantyPeriod: 36 } });
  const catDesktop = await prisma.assetCategory.create({ data: { name: 'Desktop', description: 'Workstation computers', warrantyPeriod: 36 } });
  const catPrinter = await prisma.assetCategory.create({ data: { name: 'Printer', description: 'Printing and scanning devices', warrantyPeriod: 24 } });
  const catProjector = await prisma.assetCategory.create({ data: { name: 'Projector', description: 'Presentation projectors', warrantyPeriod: 24 } });
  const catVehicle = await prisma.assetCategory.create({ data: { name: 'Vehicle', description: 'Company fleet vehicles', warrantyPeriod: 60 } });
  const catMeeting = await prisma.assetCategory.create({ data: { name: 'Meeting Room', description: 'Bookable meeting spaces', warrantyPeriod: 0 } });

  // ─── Assets (24) ─────────────────────────────────────────
  const assetDefs = [
    { tag: 'AF-IN-0001', name: 'Dell Latitude 5540', cat: catLaptop.id, serial: 'DL-IN-2023-8841', rfid: 'RFID-IN-0001', mfr: 'Dell', model: 'Latitude 5540', cost: 78500, loc: 'Bengaluru — Embassy Tech Park, Block C, Floor 4', status: 'ALLOCATED', condition: 'GOOD', health: 88, bookable: false, maint: 90, acq: 420 },
    { tag: 'AF-IN-0002', name: 'HP EliteBook 840 G10', cat: catLaptop.id, serial: 'HP-IN-2024-1120', rfid: 'RFID-IN-0002', mfr: 'HP', model: 'EliteBook 840', cost: 92000, loc: 'Bengaluru — Embassy Tech Park, Block C, Floor 4', status: 'ALLOCATED', condition: 'EXCELLENT', health: 94, bookable: false, maint: 90, acq: 280 },
    { tag: 'AF-IN-0003', name: 'Lenovo ThinkPad X1 Carbon', cat: catLaptop.id, serial: 'LN-IN-2024-3301', rfid: 'RFID-IN-0003', mfr: 'Lenovo', model: 'X1 Carbon Gen 11', cost: 118000, loc: 'Mumbai — BKC Annexe, Floor 7', status: 'ALLOCATED', condition: 'GOOD', health: 91, bookable: false, maint: 90, acq: 200 },
    { tag: 'AF-IN-0004', name: 'Apple MacBook Pro 14 M3', cat: catLaptop.id, serial: 'AP-IN-2024-0098', rfid: 'RFID-IN-0004', mfr: 'Apple', model: 'MacBook Pro 14', cost: 189000, loc: 'Bengaluru — Embassy Tech Park, Block C, Floor 4', status: 'ALLOCATED', condition: 'EXCELLENT', health: 96, bookable: false, maint: 90, acq: 150 },
    { tag: 'AF-IN-0005', name: 'Dell OptiPlex 7010', cat: catDesktop.id, serial: 'DO-IN-2022-5512', rfid: 'RFID-IN-0005', mfr: 'Dell', model: 'OptiPlex 7010', cost: 62000, loc: 'Hyderabad — HITEC City, Tower 2, Floor 3', status: 'AVAILABLE', condition: 'GOOD', health: 82, bookable: false, maint: 120, acq: 600, nextMaint: -20 },
    { tag: 'AF-IN-0006', name: 'HP ProDesk 400 G9', cat: catDesktop.id, serial: 'HP-IN-2023-7788', rfid: 'RFID-IN-0006', mfr: 'HP', model: 'ProDesk 400 G9', cost: 54000, loc: 'Bengaluru — Embassy Tech Park, Block A, Floor 2', status: 'ALLOCATED', condition: 'FAIR', health: 71, bookable: false, maint: 120, acq: 450 },
    { tag: 'AF-IN-0007', name: 'Canon imageRUNNER 2630i', cat: catPrinter.id, serial: 'CN-IN-2021-4400', rfid: 'RFID-IN-0007', mfr: 'Canon', model: 'imageRUNNER 2630i', cost: 145000, loc: 'Bengaluru — Embassy Tech Park, Block A, Floor 1', status: 'UNDER_MAINTENANCE', condition: 'POOR', health: 45, bookable: false, maint: 60, acq: 900 },
    { tag: 'AF-IN-0008', name: 'HP LaserJet Pro M428fdw', cat: catPrinter.id, serial: 'HP-IN-2023-9901', rfid: 'RFID-IN-0008', mfr: 'HP', model: 'LaserJet Pro M428fdw', cost: 38000, loc: 'Mumbai — BKC Annexe, Floor 3', status: 'AVAILABLE', condition: 'GOOD', health: 85, bookable: false, maint: 60, acq: 380 },
    { tag: 'AF-IN-0009', name: 'Epson EB-2250U Projector', cat: catProjector.id, serial: 'EP-IN-2023-2211', rfid: 'RFID-IN-0009', mfr: 'Epson', model: 'EB-2250U', cost: 89000, loc: 'Bengaluru — Embassy Tech Park, Conference Wing', status: 'AVAILABLE', condition: 'GOOD', health: 87, bookable: true, maint: 180, acq: 400 },
    { tag: 'AF-IN-0010', name: 'BenQ MH733 Conference Projector', cat: catProjector.id, serial: 'BQ-IN-2024-1188', rfid: 'RFID-IN-0010', mfr: 'BenQ', model: 'MH733', cost: 72000, loc: 'Hyderabad — HITEC City, Auditorium', status: 'RESERVED', condition: 'EXCELLENT', health: 92, bookable: true, maint: 180, acq: 120 },
    { tag: 'AF-IN-0011', name: 'Toyota Innova Crysta', cat: catVehicle.id, serial: 'MH-12-AB-4521', rfid: 'RFID-IN-0011', mfr: 'Toyota', model: 'Innova Crysta ZX', cost: 2450000, loc: 'Mumbai — Andheri East Fleet Bay', status: 'ALLOCATED', condition: 'GOOD', health: 78, bookable: true, maint: 90, acq: 500 },
    { tag: 'AF-IN-0012', name: 'Hyundai Creta Executive', cat: catVehicle.id, serial: 'KA-03-MN-8890', rfid: 'RFID-IN-0012', mfr: 'Hyundai', model: 'Creta SX(O)', cost: 1680000, loc: 'Bengaluru — Embassy Tech Park Parking P2', status: 'AVAILABLE', condition: 'GOOD', health: 83, bookable: true, maint: 90, acq: 300 },
    { tag: 'AF-IN-0013', name: 'Meeting Room A — Orion', cat: catMeeting.id, serial: 'RM-IN-ORION', rfid: 'RFID-IN-0013', mfr: 'Internal', model: '12-Seater', cost: 0, loc: 'Bengaluru — Embassy Tech Park, Block B, Floor 3', status: 'AVAILABLE', condition: 'EXCELLENT', health: 100, bookable: true, maint: 365, acq: 1000 },
    { tag: 'AF-IN-0014', name: 'Meeting Room B — Vega', cat: catMeeting.id, serial: 'RM-IN-VEGA', rfid: 'RFID-IN-0014', mfr: 'Internal', model: '8-Seater', cost: 0, loc: 'Bengaluru — Embassy Tech Park, Block B, Floor 3', status: 'AVAILABLE', condition: 'EXCELLENT', health: 100, bookable: true, maint: 365, acq: 1000 },
    { tag: 'AF-IN-0015', name: 'Conference Hall — Phoenix', cat: catMeeting.id, serial: 'RM-IN-PHNX', rfid: 'RFID-IN-0015', mfr: 'Internal', model: '40-Seater', cost: 0, loc: 'Bengaluru — Embassy Tech Park, Block A, Floor 1', status: 'AVAILABLE', condition: 'EXCELLENT', health: 100, bookable: true, maint: 365, acq: 800 },
    { tag: 'AF-IN-0016', name: 'Asus ZenBook 14', cat: catLaptop.id, serial: 'AS-IN-2024-5566', rfid: 'RFID-IN-0016', mfr: 'Asus', model: 'ZenBook 14 OLED', cost: 95000, loc: 'Hyderabad — HITEC City, Floor 5', status: 'AVAILABLE', condition: 'GOOD', health: 90, bookable: false, maint: 90, acq: 90 },
    { tag: 'AF-IN-0017', name: 'Dell Precision 3680', cat: catDesktop.id, serial: 'DP-IN-2024-0022', rfid: 'RFID-IN-0017', mfr: 'Dell', model: 'Precision 3680', cost: 112000, loc: 'Bengaluru — Embassy Tech Park, Block C, Floor 5', status: 'ALLOCATED', condition: 'GOOD', health: 86, bookable: false, maint: 120, acq: 220 },
    { tag: 'AF-IN-0018', name: 'Ricoh IM C3000', cat: catPrinter.id, serial: 'RC-IN-2022-3310', rfid: 'RFID-IN-0018', mfr: 'Ricoh', model: 'IM C3000', cost: 175000, loc: 'Hyderabad — HITEC City, Floor 2', status: 'RETIRED', condition: 'POOR', health: 25, bookable: false, maint: 60, acq: 1400, retire: -30 },
    { tag: 'AF-IN-0019', name: 'Acer Aspire 5', cat: catLaptop.id, serial: 'AC-IN-2021-7780', rfid: 'RFID-IN-0019', mfr: 'Acer', model: 'Aspire 5', cost: 48000, loc: 'Mumbai — BKC Annexe, Floor 5', status: 'LOST', condition: 'DAMAGED', health: 0, bookable: false, maint: 90, acq: 1100 },
    { tag: 'AF-IN-0020', name: 'HP ZBook Fury 16', cat: catLaptop.id, serial: 'HZ-IN-2024-4412', rfid: 'RFID-IN-0020', mfr: 'HP', model: 'ZBook Fury 16 G10', cost: 215000, loc: 'Bengaluru — Embassy Tech Park, Block C, Floor 4', status: 'ALLOCATED', condition: 'EXCELLENT', health: 95, bookable: false, maint: 90, acq: 60 },
    { tag: 'AF-IN-0021', name: 'Epson EB-L200F Portable', cat: catProjector.id, serial: 'EP-IN-2024-5500', rfid: 'RFID-IN-0021', mfr: 'Epson', model: 'EB-L200F', cost: 65000, loc: 'Mumbai — BKC Annexe, Training Room', status: 'AVAILABLE', condition: 'GOOD', health: 89, bookable: true, maint: 180, acq: 200 },
    { tag: 'AF-IN-0022', name: 'Maruti Ertiga VXI', cat: catVehicle.id, serial: 'DL-08-CA-3344', rfid: 'RFID-IN-0022', mfr: 'Maruti', model: 'Ertiga VXI', cost: 1150000, loc: 'Hyderabad — Gachibowli Fleet Bay', status: 'AVAILABLE', condition: 'FAIR', health: 74, bookable: true, maint: 90, acq: 700, nextMaint: 15, retire: 60 },
    { tag: 'AF-IN-0023', name: 'Lenovo ThinkCentre M90q', cat: catDesktop.id, serial: 'LC-IN-2023-1199', rfid: 'RFID-IN-0023', mfr: 'Lenovo', model: 'ThinkCentre M90q', cost: 58000, loc: 'Bengaluru — Embassy Tech Park, Block A, Floor 2', status: 'AVAILABLE', condition: 'GOOD', health: 80, bookable: false, maint: 120, acq: 350, nextMaint: 25 },
    { tag: 'AF-IN-0024', name: 'Standing Desk — ErgoMax', cat: catDesktop.id, serial: 'SD-IN-2024-0088', rfid: 'RFID-IN-0024', mfr: 'ErgoMax', model: 'Pro Stand 160', cost: 42000, loc: 'Bengaluru — Embassy Tech Park, HR Wing', status: 'ALLOCATED', condition: 'GOOD', health: 88, bookable: false, maint: 365, acq: 100, retire: 45 },
  ];

  const assets = [];
  for (const a of assetDefs) {
    const acqDate = daysAgo(a.acq);
    const warranty = new Date(acqDate);
    warranty.setMonth(warranty.getMonth() + 36);
    const asset = await prisma.asset.create({
      data: {
        assetTag: a.tag,
        name: a.name,
        serialNumber: a.serial,
        rfidIdentifier: a.rfid,
        categoryId: a.cat,
        acquisitionDate: acqDate,
        acquisitionCost: a.cost,
        condition: a.condition,
        location: a.loc,
        status: a.status,
        isBookable: a.bookable,
        healthScore: a.health,
        warrantyExpiryDate: warranty,
        maintenanceInterval: a.maint,
        nextMaintenanceDate: a.nextMaint != null ? daysFromNow(a.nextMaint) : daysFromNow(45),
        retirementDate: a.retire != null ? daysFromNow(a.retire) : daysFromNow(365 * 3),
        qrCode: `QR-${a.tag}`,
        specifications: { manufacturer: a.mfr, model: a.model, office: a.loc.split('—')[0]?.trim() },
        description: `${a.mfr} ${a.model} deployed at ${a.loc}`,
      },
    });
    assets.push(asset);
  }

  const byTag = (tag) => assets.find((a) => a.assetTag === tag);

  // ─── Allocations ─────────────────────────────────────────
  const allocData = [
    { asset: 'AF-IN-0001', emp: E[1], dept: itDept.id, status: 'ACTIVE', returnIn: 45 },
    { asset: 'AF-IN-0002', emp: E[0], dept: itDept.id, status: 'ACTIVE', returnIn: 30 },
    { asset: 'AF-IN-0003', emp: E[1], dept: itDept.id, status: 'ACTIVE', returnIn: 60 },
    { asset: 'AF-IN-0004', emp: E[3], dept: finDept.id, status: 'ACTIVE', returnIn: 90 },
    { asset: 'AF-IN-0006', emp: E[2], dept: hrDept.id, status: 'ACTIVE', returnIn: -12, overdue: true },
    { asset: 'AF-IN-0011', emp: E[4], dept: opsDept.id, status: 'ACTIVE', returnIn: 14 },
    { asset: 'AF-IN-0017', emp: E[3], dept: finDept.id, status: 'ACTIVE', returnIn: 20 },
    { asset: 'AF-IN-0020', emp: E[0], dept: itDept.id, status: 'ACTIVE', returnIn: 40 },
    { asset: 'AF-IN-0024', emp: E[2], dept: hrDept.id, status: 'ACTIVE', returnIn: 25 },
    { asset: 'AF-IN-0001', emp: E[1], dept: itDept.id, status: 'RETURNED', returnIn: -180, returned: true },
    { asset: 'AF-IN-0005', emp: E[3], dept: finDept.id, status: 'RETURNED', returnIn: -90, returned: true },
  ];

  for (const al of allocData) {
    const expected = daysFromNow(al.returnIn);
    await prisma.allocation.create({
      data: {
        assetId: byTag(al.asset).id,
        employeeId: al.emp.id,
        departmentId: al.dept,
        allocatedById: A.id,
        expectedReturnDate: expected,
        status: al.status,
        isOverdue: !!al.overdue,
        actualReturnDate: al.returned ? daysAgo(Math.abs(al.returnIn)) : null,
        returnCondition: al.returned ? 'GOOD' : null,
        createdAt: daysAgo(al.returned ? 200 : 30),
      },
    });
  }

  // ─── Transfers ─────────────────────────────────────────────
  const transfers = [
    { asset: 'AF-IN-0016', from: E[1], to: E[0], status: 'REQUESTED', reason: 'Project reassignment to cloud migration team' },
    { asset: 'AF-IN-0008', from: E[3], to: E[4], status: 'APPROVED', reason: 'Finance to Operations handover for audit prep' },
    { asset: 'AF-IN-0023', from: E[0], to: E[1], status: 'REJECTED', reason: 'Desktop needed by original assignee' },
    { asset: 'AF-IN-0002', from: E[0], to: E[1], status: 'COMPLETED', reason: 'Team lead upgrade cycle' },
    { asset: 'AF-IN-0021', from: E[4], to: E[3], status: 'REQUESTED', reason: 'Mumbai training session requirement' },
  ];
  for (const t of transfers) {
    await prisma.transfer.create({
      data: {
        assetId: byTag(t.asset).id,
        fromEmployeeId: t.from.id,
        toEmployeeId: t.to.id,
        toDepartmentId: t.to.departmentId,
        requestedById: t.from.id,
        approvedById: ['APPROVED', 'COMPLETED', 'REJECTED'].includes(t.status) ? A.id : null,
        reason: t.reason,
        status: t.status,
        approvedAt: ['APPROVED', 'COMPLETED'].includes(t.status) ? daysAgo(5) : null,
        completedAt: t.status === 'COMPLETED' ? daysAgo(2) : null,
        createdAt: daysAgo(10),
      },
    });
  }

  // ─── Bookings ────────────────────────────────────────────
  const bookable = assets.filter((a) => a.isBookable);
  const bookingTemplates = [
    { asset: 'AF-IN-0013', emp: E[0], title: 'Sprint Planning — Orion', days: -5, hour: 10, status: 'COMPLETED' },
    { asset: 'AF-IN-0014', emp: E[1], title: 'Client Review — Vega', days: -3, hour: 14, status: 'COMPLETED' },
    { asset: 'AF-IN-0015', emp: E[1], title: 'All-Hands Townhall', days: -1, hour: 11, status: 'COMPLETED' },
    { asset: 'AF-IN-0013', emp: E[2], title: 'HR Policy Workshop', days: 2, hour: 9, status: 'UPCOMING' },
    { asset: 'AF-IN-0014', emp: E[3], title: 'Budget Review Meeting', days: 3, hour: 15, status: 'UPCOMING' },
    { asset: 'AF-IN-0009', emp: E[0], title: 'Design Review Presentation', days: 5, hour: 16, status: 'UPCOMING' },
    { asset: 'AF-IN-0011', emp: E[4], title: 'Client Site Visit — Pune', days: 4, hour: 8, status: 'UPCOMING' },
    { asset: 'AF-IN-0012', emp: E[3], title: 'Bank Meeting — BKC', days: -7, hour: 10, status: 'COMPLETED' },
    { asset: 'AF-IN-0015', emp: A, title: 'Vendor Negotiation', days: -10, hour: 14, status: 'CANCELLED' },
    { asset: 'AF-IN-0013', emp: E[1], title: 'Architecture Review', days: 0, hour: new Date().getHours(), status: 'ONGOING' },
    { asset: 'AF-IN-0021', emp: E[3], title: 'Finance Training', days: -2, hour: 11, status: 'COMPLETED' },
    { asset: 'AF-IN-0014', emp: E[4], title: 'Ops Standup', days: 1, hour: 9, status: 'UPCOMING' },
  ];

  for (const b of bookingTemplates) {
    const start = new Date();
    if (b.days !== 0) start.setDate(start.getDate() + b.days);
    start.setHours(b.hour, 0, 0, 0);
    const end = new Date(start);
    end.setHours(start.getHours() + 1);
    if (b.status === 'ONGOING') {
      start.setHours(start.getHours() - 1);
    }
    await prisma.booking.create({
      data: {
        assetId: byTag(b.asset).id,
        employeeId: b.emp.id,
        title: b.title,
        startTime: start,
        endTime: end,
        status: b.status,
        checkInAt: ['COMPLETED', 'ONGOING'].includes(b.status) ? start : null,
        notes: b.status === 'CANCELLED' ? 'Cancelled due to vendor reschedule' : null,
      },
    });
  }

  // Extra bookings for heatmap density (last 25 days, business hours)
  const heatHours = [9, 10, 11, 14, 15, 16];
  for (let day = 1; day <= 25; day++) {
    for (const hour of heatHours) {
      const asset = bookable[day % bookable.length];
      const emp = E[day % E.length];
      const start = daysAgo(day);
      start.setHours(hour, 0, 0, 0);
      const end = new Date(start);
      end.setHours(hour + 1);
      await prisma.booking.create({
        data: {
          assetId: asset.id,
          employeeId: emp.id,
          title: `Scheduled session ${day}-${hour}`,
          startTime: start,
          endTime: end,
          status: 'COMPLETED',
          checkInAt: start,
        },
      });
    }
  }

  // ─── Maintenance ───────────────────────────────────────────
  const maintDefs = [
    { asset: 'AF-IN-0007', req: E[1], title: 'Paper jam and fuser unit failure', priority: 'HIGH', status: 'IN_PROGRESS', tech: A, days: 8 },
    { asset: 'AF-IN-0005', req: E[3], title: 'Annual desktop servicing', priority: 'LOW', status: 'PENDING', days: 2 },
    { asset: 'AF-IN-0011', req: E[4], title: 'Brake pad replacement', priority: 'MEDIUM', status: 'APPROVED', days: 5 },
    { asset: 'AF-IN-0019', req: E[1], title: 'Lost asset investigation', priority: 'CRITICAL', status: 'PENDING', days: 1 },
    { asset: 'AF-IN-0001', req: E[1], title: 'Keyboard replacement', priority: 'LOW', status: 'RESOLVED', days: 60, resolved: true },
    { asset: 'AF-IN-0018', req: E[0], title: 'Decommission retired printer', priority: 'MEDIUM', status: 'RESOLVED', days: 90, resolved: true },
    { asset: 'AF-IN-0009', req: E[0], title: 'Lamp hours exceeded — bulb replacement', priority: 'MEDIUM', status: 'REJECTED', days: 15 },
    { asset: 'AF-IN-0022', req: E[4], title: 'Fleet vehicle insurance renewal check', priority: 'LOW', status: 'TECHNICIAN_ASSIGNED', tech: A, days: 4 },
    { asset: 'AF-IN-0006', req: E[2], title: 'Fan noise and thermal paste', priority: 'HIGH', status: 'APPROVED', days: 3 },
    { asset: 'AF-IN-0023', req: E[1], title: 'SSD upgrade request', priority: 'MEDIUM', status: 'PENDING', days: 1 },
  ];

  const maintRecords = [];
  for (const m of maintDefs) {
    const created = daysAgo(m.days);
    const rec = await prisma.maintenanceRequest.create({
      data: {
        assetId: byTag(m.asset).id,
        requestedById: m.req.id,
        approvedById: ['APPROVED', 'IN_PROGRESS', 'RESOLVED', 'TECHNICIAN_ASSIGNED', 'REJECTED'].includes(m.status) ? A.id : null,
        technicianId: m.tech?.id || null,
        title: m.title,
        description: m.title + ' — reported via AssetFlow portal',
        priority: m.priority,
        status: m.status,
        slaDeadline: daysFromNow(m.priority === 'CRITICAL' ? 1 : 5),
        startedAt: m.status === 'IN_PROGRESS' ? daysAgo(2) : null,
        resolvedAt: m.resolved ? daysAgo(m.days - 5) : null,
        approvedAt: ['APPROVED', 'IN_PROGRESS', 'RESOLVED'].includes(m.status) ? daysAgo(m.days - 1) : null,
        resolutionNotes: m.resolved ? 'Issue resolved and verified by admin' : null,
        mttrMinutes: m.resolved ? 240 : null,
        createdAt: created,
      },
    });
    maintRecords.push(rec);
  }

  // ─── Spare Parts ───────────────────────────────────────────
  const parts = [
    { name: 'Laptop Battery — Dell 5540', sku: 'SP-IN-BAT-001', supplier: 'Rashi Peripherals, Bengaluru', stockQty: 18, unitCost: 6500 },
    { name: 'HP Toner 415A Black', sku: 'SP-IN-TON-002', supplier: 'PrintCare India, Mumbai', stockQty: 32, unitCost: 4200 },
    { name: 'Epson Projector Lamp', sku: 'SP-IN-LMP-003', supplier: 'Visual Solutions, Hyderabad', stockQty: 8, unitCost: 12500 },
    { name: 'SSD 512GB NVMe', sku: 'SP-IN-SSD-004', supplier: 'TechSupply India', stockQty: 45, unitCost: 3800 },
    { name: 'HDMI 2.1 Cable 3m', sku: 'SP-IN-CBL-005', supplier: 'CableMart India', stockQty: 60, unitCost: 890 },
  ];
  const spareParts = [];
  for (const p of parts) {
    spareParts.push(await prisma.sparePart.create({ data: p }));
  }
  await prisma.sparePartUsage.create({
    data: { sparePartId: spareParts[0].id, maintenanceRequestId: maintRecords[4].id, quantity: 1 },
  });

  // ─── Audit Cycles ──────────────────────────────────────────
  const auditDefs = [
    { name: 'Q1 2025 IT Asset Verification', dept: itDept.id, status: 'CLOSED', scope: 'All IT assets Bengaluru campus', loc: 'Embassy Tech Park', days: 90 },
    { name: 'Q2 2025 Finance Equipment Audit', dept: finDept.id, status: 'IN_PROGRESS', scope: 'Finance department assets', loc: 'BKC Annexe Mumbai', days: 30 },
    { name: 'Q2 2025 Fleet & Facilities Review', dept: opsDept.id, status: 'IN_PROGRESS', scope: 'Vehicles and meeting rooms', loc: 'Multi-city', days: 20 },
    { name: 'Annual Hyderabad Office Audit', dept: itDept.id, status: 'DRAFT', scope: 'HITEC City office assets', loc: 'HITEC City Hyderabad', days: 5 },
    { name: 'HR Wing Furniture Check 2025', dept: hrDept.id, status: 'CLOSED', scope: 'Desks and ergonomic equipment', loc: 'Embassy Tech Park HR Wing', days: 120 },
  ];

  const auditAssetStatuses = [
    ['AF-IN-0001', 'VERIFIED'], ['AF-IN-0002', 'VERIFIED'], ['AF-IN-0005', 'VERIFIED'],
    ['AF-IN-0007', 'DAMAGED'], ['AF-IN-0019', 'MISSING'], ['AF-IN-0018', 'VERIFIED'],
    ['AF-IN-0011', 'VERIFIED'], ['AF-IN-0013', 'VERIFIED'], ['AF-IN-0006', 'VERIFIED'],
    ['AF-IN-0023', 'PENDING'], ['AF-IN-0024', 'VERIFIED'], ['AF-IN-0008', 'MISSING'],
  ];

  for (const aud of auditDefs) {
    const cycle = await prisma.auditCycle.create({
      data: {
        name: aud.name,
        description: `Physical verification audit — ${aud.scope}`,
        scope: aud.scope,
        location: aud.loc,
        departmentId: aud.dept,
        startDate: daysAgo(aud.days + 14),
        endDate: daysFromNow(aud.status === 'CLOSED' ? -aud.days : 14),
        status: aud.status,
        closedAt: aud.status === 'CLOSED' ? daysAgo(aud.days) : null,
        autoDiscrepancyReport: aud.status === 'CLOSED' ? { missing: 1, damaged: 1, verified: 10 } : null,
      },
    });

    await prisma.auditAssignment.create({
      data: { auditCycleId: cycle.id, auditorId: A.id },
    });

    const itemsForCycle = auditAssetStatuses.slice(0, 5 + Math.floor(Math.random() * 4));
    for (const [tag, st] of itemsForCycle) {
      const asset = byTag(tag);
      if (!asset) continue;
      await prisma.auditItem.create({
        data: {
          auditCycleId: cycle.id,
          assetId: asset.id,
          auditorId: A.id,
          status: st,
          notes: st === 'MISSING' ? 'Asset not found at registered location during walkthrough' : st === 'DAMAGED' ? 'Physical damage observed — maintenance raised' : 'Physically verified and QR scanned',
          verifiedAt: st === 'VERIFIED' ? daysAgo(5) : null,
        },
      });
    }
  }

  // ─── Asset History & Custody ─────────────────────────────
  for (const asset of assets.slice(0, 12)) {
    await prisma.assetHistory.create({
      data: {
        assetId: asset.id,
        action: 'CREATED',
        changedBy: admin.id,
        details: { source: 'seed', location: asset.location },
        createdAt: asset.acquisitionDate || daysAgo(400),
      },
    });
    await prisma.custodyEvent.create({
      data: {
        assetId: asset.id,
        eventType: 'ALLOCATED',
        fromName: 'IT Store',
        toName: 'Employee',
        performedBy: A.id,
        createdAt: daysAgo(30),
      },
    });
  }

  // Sensor readings for digital twin
  for (const asset of assets.filter((a) => a.categoryId === catLaptop.id).slice(0, 5)) {
    await prisma.sensorReading.create({
      data: { assetId: asset.id, sensorType: 'BATTERY_HEALTH', value: asset.healthScore, unit: '%', recordedAt: daysAgo(1) },
    });
    await prisma.sensorReading.create({
      data: { assetId: asset.id, sensorType: 'TEMPERATURE', value: 42.5, unit: '°C', isAlert: asset.healthScore < 50, recordedAt: daysAgo(0) },
    });
  }

  // ─── Approval Matrix ───────────────────────────────────────
  await prisma.approvalMatrix.create({
    data: {
      workflowType: 'MAINTENANCE',
      name: 'Standard Maintenance Approval',
      steps: [{ order: 1, role: 'ADMIN', action: 'approve' }, { order: 2, role: 'ADMIN', action: 'notify' }],
    },
  });
  await prisma.approvalMatrix.create({
    data: {
      workflowType: 'TRANSFER',
      name: 'Inter-Department Transfer',
      steps: [{ order: 1, role: 'ADMIN', action: 'approve' }, { order: 2, role: 'ADMIN', action: 'approve' }],
    },
  });

  // ─── Notifications (28) ────────────────────────────────────
  const notifDefs = [
    { user: admin, type: 'ASSET_ASSIGNED', title: 'Asset Assigned', msg: 'Dell Latitude 5540 (AF-IN-0001) assigned to Rahul Menon', link: '/allocation' },
    { user: employees[0], type: 'BOOKING_CONFIRMED', title: 'Booking Confirmed', msg: 'Meeting Room A — Orion booked for Sprint Planning', link: '/bookings' },
    { user: employees[1], type: 'MAINTENANCE_APPROVED', title: 'Maintenance Approved', msg: 'Your keyboard replacement request has been approved', link: '/maintenance' },
    { user: employees[2], type: 'TRANSFER_APPROVED', title: 'Transfer Approved', msg: 'HP ProDesk transfer to Operations approved', link: '/allocation/transfers' },
    { user: employees[1], type: 'OVERDUE_RETURN', title: 'Overdue Return Alert', msg: 'HP ProDesk 400 G9 return is 12 days overdue', link: '/allocation/returns' },
    { user: admin, type: 'WARRANTY_EXPIRING', title: 'Warranty Expiring', msg: 'Ricoh IM C3000 warranty expires in 15 days', link: '/assets' },
    { user: employees[3], type: 'BOOKING_REMINDER', title: 'Booking Reminder', msg: 'Budget Review Meeting in Meeting Room B starts in 30 minutes', link: '/bookings' },
    { user: employees[4], type: 'BOOKING_CANCELLED', title: 'Booking Cancelled', msg: 'Vendor Negotiation at Conference Hall cancelled', link: '/bookings' },
    { user: admin, type: 'AUDIT_DISCREPANCY', title: 'Audit Discrepancy', msg: '2 discrepancies found in Q1 IT Asset Verification', link: '/audit' },
    { user: admin, type: 'MAINTENANCE_SLA_BREACH', title: 'SLA Breach', msg: 'Canon printer maintenance exceeded SLA deadline', link: '/maintenance' },
    { user: employees[0], type: 'GENERAL', title: 'Asset Returned', msg: 'Lenovo ThinkPad returned successfully — condition: Good', link: '/allocation' },
    { user: employees[3], type: 'TRANSFER_REJECTED', title: 'Transfer Rejected', msg: 'Lenovo ThinkCentre transfer request rejected', link: '/allocation/transfers' },
    { user: employees[1], type: 'AI_INSIGHT', title: 'AI Insight', msg: 'IT department utilization up 12% this quarter — consider additional laptops', link: '/dashboard' },
    { user: admin, type: 'ASSET_ASSIGNED', title: 'Asset Assigned', msg: 'MacBook Pro 14 assigned to Kavya Iyer', link: '/allocation' },
    { user: employees[2], type: 'BOOKING_CONFIRMED', title: 'Booking Confirmed', msg: 'HR Policy Workshop — Meeting Room A confirmed', link: '/bookings' },
    { user: employees[3], type: 'MAINTENANCE_REJECTED', title: 'Maintenance Rejected', msg: 'Projector bulb replacement deferred to next quarter', link: '/maintenance' },
    { user: admin, type: 'SECURITY_ALERT', title: 'Security Alert', msg: 'Unusual login attempt blocked from new device', link: '/profile/security' },
    { user: employees[4], type: 'BOOKING_CONFIRMED', title: 'Booking Confirmed', msg: 'Toyota Innova Crysta booked for Pune client visit', link: '/bookings' },
    { user: admin, type: 'GENERAL', title: 'Audit Completed', msg: 'Q1 2025 IT Asset Verification audit closed successfully', link: '/audit' },
    { user: admin, type: 'WARRANTY_EXPIRING', title: 'Warranty Expiring', msg: 'Maruti Ertiga insurance renewal due in 30 days', link: '/assets' },
    { user: employees[0], type: 'OVERDUE_RETURN', title: 'Return Reminder', msg: 'HP EliteBook expected return in 5 days', link: '/allocation' },
    { user: employees[1], type: 'MAINTENANCE_APPROVED', title: 'Maintenance Approved', msg: 'SSD upgrade request under review', link: '/maintenance' },
    { user: admin, type: 'AI_INSIGHT', title: 'AI Insight', msg: 'Meeting Room B peak usage between 2–4 PM — consider booking policies', link: '/reports' },
    { user: employees[3], type: 'BOOKING_CONFIRMED', title: 'Booking Confirmed', msg: 'Finance Training with portable projector confirmed', link: '/bookings' },
    { user: employees[3], type: 'ASSET_ASSIGNED', title: 'Asset Assigned', msg: 'MacBook Pro 14 allocated to Finance department', link: '/allocation' },
    { user: admin, type: 'GENERAL', title: 'System Update', msg: 'AssetFlow analytics module updated with heatmap reports', link: '/reports' },
    { user: employees[2], type: 'TRANSFER_APPROVED', title: 'Transfer In Progress', msg: 'Asus ZenBook transfer to Kavya Iyer is approved', link: '/allocation/transfers' },
    { user: admin, type: 'MAINTENANCE_SLA_BREACH', title: 'Maintenance Overdue', msg: 'Dell OptiPlex 7010 overdue for scheduled servicing', link: '/reports' },
  ];

  for (let i = 0; i < notifDefs.length; i++) {
    const n = notifDefs[i];
    await prisma.notification.create({
      data: {
        userId: n.user.id,
        type: n.type,
        title: n.title,
        message: n.msg,
        link: n.link,
        isRead: i % 3 === 0,
        createdAt: daysAgo(Math.floor(Math.random() * 14)),
      },
    });
  }

  // ─── Activity Logs (35) ────────────────────────────────────
  const logDefs = [
    { user: admin, action: 'LOGIN', entity: 'User', details: { method: 'password' } },
    { user: admin, action: 'CREATE', entity: 'Asset', details: { assetTag: 'AF-IN-0024' } },
    { user: admin, action: 'ALLOCATE', entity: 'Allocation', details: { assetTag: 'AF-IN-0001', employee: 'Rahul Menon' } },
    { user: employees[1], action: 'LOGIN', entity: 'User', details: { method: 'passkey' } },
    { user: employees[0], action: 'BOOKING_CREATE', entity: 'Booking', details: { room: 'Meeting Room A — Orion' } },
    { user: employees[1], action: 'MAINTENANCE_RAISE', entity: 'MaintenanceRequest', details: { title: 'Keyboard replacement' } },
    { user: admin, action: 'MAINTENANCE_APPROVE', entity: 'MaintenanceRequest', details: { action: 'approved' } },
    { user: employees[2], action: 'TRANSFER_REQUEST', entity: 'Transfer', details: { assetTag: 'AF-IN-0016' } },
    { user: admin, action: 'TRANSFER_APPROVE', entity: 'Transfer', details: { status: 'APPROVED' } },
    { user: employees[3], action: 'BOOKING_CANCEL', entity: 'Booking', details: { room: 'Conference Hall — Phoenix' } },
    { user: admin, action: 'AUDIT_CLOSE', entity: 'AuditCycle', details: { name: 'Q1 2025 IT Asset Verification' } },
    { user: admin, action: 'UPDATE', entity: 'Asset', details: { assetTag: 'AF-IN-0019', field: 'status', newValue: 'LOST' } },
    { user: employees[4], action: 'BOOKING_CREATE', entity: 'Booking', details: { vehicle: 'Toyota Innova Crysta' } },
    { user: employees[3], action: 'LOGOUT', entity: 'User', details: {} },
    { user: admin, action: 'LOGIN', entity: 'User', details: { method: 'google' } },
    { user: employees[0], action: 'RETURN', entity: 'Allocation', details: { assetTag: 'AF-IN-0001', condition: 'GOOD' } },
    { user: admin, action: 'UPDATE', entity: 'Asset', details: { assetTag: 'AF-IN-0007', field: 'status', newValue: 'UNDER_MAINTENANCE' } },
    { user: employees[1], action: 'LOGIN', entity: 'User', details: { method: 'password' } },
    { user: admin, action: 'CREATE', entity: 'Department', details: { code: 'ADM' } },
    { user: admin, action: 'IMPORT', entity: 'ImportJob', details: { entityType: 'ASSETS', rows: 5 } },
    { user: employees[2], action: 'BOOKING_CREATE', entity: 'Booking', details: { room: 'Meeting Room B — Vega' } },
    { user: employees[1], action: 'MAINTENANCE_RAISE', entity: 'MaintenanceRequest', details: { priority: 'CRITICAL' } },
    { user: admin, action: 'PASSKEY_REGISTER', entity: 'User', details: { device: 'Windows Hello' } },
    { user: employees[3], action: 'LOGIN', entity: 'User', details: { method: 'magic_link' } },
    { user: admin, action: 'AUDIT_START', entity: 'AuditCycle', details: { name: 'Q2 2025 Finance Equipment Audit' } },
    { user: employees[4], action: 'ALLOCATE', entity: 'Allocation', details: { assetTag: 'AF-IN-0011' } },
    { user: admin, action: 'LOGOUT', entity: 'User', details: {} },
    { user: admin, action: 'UPDATE', entity: 'SparePart', details: { sku: 'SP-IN-BAT-001', stockQty: 18 } },
    { user: employees[0], action: 'BOOKING_CREATE', entity: 'Booking', details: { projector: 'Epson EB-2250U' } },
    { user: employees[3], action: 'TRANSFER_REQUEST', entity: 'Transfer', details: { assetTag: 'AF-IN-0021' } },
    { user: admin, action: 'LOGIN', entity: 'User', details: { method: 'password', mfa: true } },
    { user: employees[1], action: 'LOGOUT', entity: 'User', details: {} },
    { user: admin, action: 'UPDATE', entity: 'SystemSetting', details: { key: 'magic_link_expiry_minutes' } },
    { user: admin, action: 'CREATE', entity: 'AuditCycle', details: { name: 'Q2 2025 Fleet Review' } },
  ];

  for (let i = 0; i < logDefs.length; i++) {
    const l = logDefs[i];
    await prisma.activityLog.create({
      data: {
        userId: l.user.id,
        action: l.action,
        entityType: l.entity,
        details: l.details,
        ipAddress: '103.21.45.' + (10 + i),
        createdAt: daysAgo(Math.floor(Math.random() * 30)),
      },
    });
  }

  // ─── Security Events ───────────────────────────────────────
  for (const u of [admin, employees[0]]) {
    await prisma.securityEvent.create({
      data: {
        userId: u.id,
        type: 'LOGIN_SUCCESS',
        ipAddress: '103.21.45.88',
        country: 'IN',
        browser: 'Chrome 122 / Windows 11',
        createdAt: daysAgo(Math.floor(Math.random() * 7)),
      },
    });
  }

  // ─── System Settings ───────────────────────────────────────
  await prisma.systemSetting.upsert({
    where: { key: 'magic_link_expiry_minutes' },
    update: { value: '15' },
    create: { key: 'magic_link_expiry_minutes', value: '15' },
  });

  // ─── Summary ─────────────────────────────────────────────
  const counts = {
    users: await prisma.user.count(),
    departments: await prisma.department.count(),
    assets: await prisma.asset.count(),
    allocations: await prisma.allocation.count(),
    transfers: await prisma.transfer.count(),
    bookings: await prisma.booking.count(),
    maintenance: await prisma.maintenanceRequest.count(),
    audits: await prisma.auditCycle.count(),
    notifications: await prisma.notification.count(),
    activityLogs: await prisma.activityLog.count(),
  };

  console.log('✅ Seed completed successfully!\n');
  console.log('📊 Data Summary:');
  Object.entries(counts).forEach(([k, v]) => console.log(`   ${k}: ${v}`));

  console.log('\n🔐 Demo Login Credentials:');
  console.log('   Admin:    admin@assetflow.com / Admin@123');
  console.log('   Employee: employee@assetflow.com / Employee@123');
  console.log('   (Also: rahul.menon@, divya.singh@, suresh.pillai@, meera.kulkarni@assetflow.in / Employee@123)');
  console.log('\n🏢 Offices: Bengaluru (Embassy Tech Park), Mumbai (BKC), Hyderabad (HITEC City)');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
