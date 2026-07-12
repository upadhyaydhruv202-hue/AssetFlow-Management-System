import prisma from '../config/database.js';
import { ApiError, successResponse, paginatedResponse, parsePagination, buildPagination } from '../utils/apiResponse.js';
import { logActivity } from '../utils/activityLogger.js';
import { closeAuditCycle, generateDiscrepancyReport } from '../services/auditService.js';

export const getAuditCycles = async (req, res, next) => {
  try {
    const { page, limit, skip, sortBy, sortOrder } = parsePagination(req.query);
    const { status } = req.query;

    const where = { ...(status && { status }) };

    const [cycles, total] = await Promise.all([
      prisma.auditCycle.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          department: true,
          assignments: { include: { auditor: true } },
          _count: { select: { items: true } },
        },
      }),
      prisma.auditCycle.count({ where }),
    ]);

    return paginatedResponse(res, cycles, buildPagination(total, page, limit));
  } catch (error) {
    next(error);
  }
};

export const getAuditCycle = async (req, res, next) => {
  try {
    const cycle = await prisma.auditCycle.findUnique({
      where: { id: req.params.id },
      include: {
        department: true,
        assignments: { include: { auditor: true } },
        items: {
          include: {
            asset: { include: { category: true } },
            auditor: true,
          },
        },
      },
    });
    if (!cycle) throw new ApiError(404, 'Audit cycle not found');
    return successResponse(res, cycle);
  } catch (error) {
    next(error);
  }
};

export const createAuditCycle = async (req, res, next) => {
  try {
    const { name, description, scope, location, departmentId, startDate, endDate, auditorIds } = req.body;

    const cycle = await prisma.auditCycle.create({
      data: {
        name,
        description,
        scope,
        location,
        departmentId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        status: 'DRAFT',
        assignments: auditorIds?.length
          ? { create: auditorIds.map((auditorId) => ({ auditorId })) }
          : undefined,
      },
      include: {
        assignments: { include: { auditor: true } },
        department: true,
      },
    });

    await logActivity(req.user.id, 'CREATE', 'AuditCycle', cycle.id, req.body, req.ip);
    return successResponse(res, cycle, 'Audit cycle created', 201);
  } catch (error) {
    next(error);
  }
};

export const startAuditCycle = async (req, res, next) => {
  try {
    const cycle = await prisma.auditCycle.findUnique({
      where: { id: req.params.id },
    });
    if (!cycle) throw new ApiError(404, 'Audit cycle not found');

    const assetWhere = {
      deletedAt: null,
      ...(cycle.departmentId && {
        allocations: { some: { departmentId: cycle.departmentId, status: { in: ['ACTIVE', 'OVERDUE'] } } },
      }),
      ...(cycle.location && { location: { contains: cycle.location, mode: 'insensitive' } }),
    };

    const assets = await prisma.asset.findMany({ where: assetWhere, select: { id: true } });

    await prisma.auditItem.createMany({
      data: assets.map((a) => ({
        auditCycleId: cycle.id,
        assetId: a.id,
        status: 'PENDING',
      })),
      skipDuplicates: true,
    });

    const updated = await prisma.auditCycle.update({
      where: { id: cycle.id },
      data: { status: 'IN_PROGRESS' },
      include: {
        items: { include: { asset: true } },
        assignments: { include: { auditor: true } },
      },
    });

    await logActivity(req.user.id, 'START', 'AuditCycle', cycle.id, null, req.ip);
    return successResponse(res, updated, 'Audit cycle started');
  } catch (error) {
    next(error);
  }
};

export const updateAuditItem = async (req, res, next) => {
  try {
    const { status, notes } = req.body;

    const item = await prisma.auditItem.update({
      where: { id: req.params.itemId },
      data: {
        status,
        notes,
        auditorId: req.employee.id,
        verifiedAt: new Date(),
      },
      include: { asset: true, auditor: true },
    });

    await logActivity(req.user.id, 'VERIFY', 'AuditItem', item.id, { status }, req.ip);
    return successResponse(res, item, 'Audit item updated');
  } catch (error) {
    next(error);
  }
};

export const closeCycle = async (req, res, next) => {
  try {
    const result = await closeAuditCycle(req.params.id, req.user.id);
    await logActivity(req.user.id, 'CLOSE', 'AuditCycle', req.params.id, null, req.ip);
    return successResponse(res, result, 'Audit cycle closed');
  } catch (error) {
    next(error);
  }
};

export const getDiscrepancyReport = async (req, res, next) => {
  try {
    const report = await generateDiscrepancyReport(req.params.id);
    return successResponse(res, report);
  } catch (error) {
    next(error);
  }
};

export const assignAuditors = async (req, res, next) => {
  try {
    const { auditorIds } = req.body;

    await prisma.auditAssignment.deleteMany({ where: { auditCycleId: req.params.id } });
    await prisma.auditAssignment.createMany({
      data: auditorIds.map((auditorId) => ({
        auditCycleId: req.params.id,
        auditorId,
      })),
    });

    const cycle = await prisma.auditCycle.findUnique({
      where: { id: req.params.id },
      include: { assignments: { include: { auditor: true } } },
    });

    return successResponse(res, cycle, 'Auditors assigned');
  } catch (error) {
    next(error);
  }
};
