import prisma from '../config/database.js';
import { ApiError, successResponse, paginatedResponse, parsePagination, buildPagination } from '../utils/apiResponse.js';
import { logActivity } from '../utils/activityLogger.js';
import { createNotification } from '../services/notificationService.js';
import { storeSignature, recordCustodyEvent } from '../services/custodyService.js';
import { predictReturnDate } from '../services/aiService.js';
import { updateAssetHealth } from '../services/assetHealthService.js';

export const getAllocations = async (req, res, next) => {
  try {
    const { page, limit, skip, sortBy, sortOrder } = parsePagination(req.query);
    const { status, employeeId, departmentId, isOverdue } = req.query;

    const where = {
      ...(status && { status }),
      ...(employeeId && { employeeId }),
      ...(departmentId && { departmentId }),
      ...(isOverdue === 'true' && { isOverdue: true }),
    };

    if (req.user.role === 'EMPLOYEE' && req.employee) {
      where.employeeId = req.employee.id;
    }

    const [allocations, total] = await Promise.all([
      prisma.allocation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          asset: { include: { category: true } },
          employee: true,
          department: true,
          allocatedBy: { select: { firstName: true, lastName: true } },
        },
      }),
      prisma.allocation.count({ where }),
    ]);

    return paginatedResponse(res, allocations, buildPagination(total, page, limit));
  } catch (error) {
    next(error);
  }
};

export const allocateAsset = async (req, res, next) => {
  try {
    const { assetId, expectedReturnDate, signatureData } = req.body;
    let { employeeId, departmentId } = req.body;
    employeeId = employeeId || null;
    departmentId = departmentId || null;

    if (!employeeId && !departmentId) {
      throw new ApiError(400, 'Either employee or department must be specified');
    }

    const asset = await prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset) throw new ApiError(404, 'Asset not found');

    const activeAllocation = await prisma.allocation.findFirst({
      where: { assetId, status: { in: ['ACTIVE', 'OVERDUE'] } },
      include: { employee: true },
    });

    if (activeAllocation) {
      const holder = activeAllocation.employee
        ? `${activeAllocation.employee.firstName} ${activeAllocation.employee.lastName}`
        : 'another department';
      throw new ApiError(409, `Asset is currently held by ${holder}`, {
        currentHolder: activeAllocation.employee,
        allocationId: activeAllocation.id,
        suggestTransfer: true,
      });
    }

    if (!['AVAILABLE', 'RESERVED'].includes(asset.status)) {
      throw new ApiError(400, `Asset cannot be allocated. Current status: ${asset.status}`);
    }

    if (!req.employee) throw new ApiError(400, 'Employee profile required');

    const predictedReturnDate = employeeId
      ? await predictReturnDate(assetId, employeeId)
      : null;

    let signatureId = null;
    if (signatureData) {
      const sig = await storeSignature({
        userId: req.user.id,
        signatureType: 'ALLOCATION',
        signatureData,
        entityType: 'Allocation',
        entityId: assetId,
      });
      signatureId = sig.id;
    }

    const allocation = await prisma.$transaction(async (tx) => {
      const alloc = await tx.allocation.create({
        data: {
          assetId,
          employeeId,
          departmentId,
          allocatedById: req.employee.id,
          expectedReturnDate: expectedReturnDate ? new Date(expectedReturnDate) : null,
          predictedReturnDate,
          signatureId,
          status: 'ACTIVE',
        },
        include: {
          asset: true,
          employee: true,
          department: true,
        },
      });

      await tx.asset.update({
        where: { id: assetId },
        data: { status: 'ALLOCATED' },
      });

      return alloc;
    });

    const toName = allocation.employee
      ? `${allocation.employee.firstName} ${allocation.employee.lastName}`
      : allocation.department?.name || 'Department';
    await recordCustodyEvent({
      assetId,
      eventType: 'ALLOCATED',
      toName,
      performedBy: req.employee.id,
      entityId: allocation.id,
    });
    await updateAssetHealth(assetId);

    if (employeeId) {
      const emp = await prisma.employee.findUnique({
        where: { id: employeeId },
        select: { userId: true },
      });
      if (emp) {
        await createNotification(
          emp.userId,
          'ASSET_ASSIGNED',
          'Asset Assigned',
          `Asset ${asset.assetTag} (${asset.name}) has been assigned to you`,
          `/assets/${assetId}`
        );
      }
    }

    await logActivity(req.user.id, 'ALLOCATE', 'Allocation', allocation.id, req.body, req.ip);
    return successResponse(res, allocation, 'Asset allocated', 201);
  } catch (error) {
    next(error);
  }
};

export const returnAsset = async (req, res, next) => {
  try {
    const { returnNotes, returnCondition } = req.body;
    const allocation = await prisma.allocation.findUnique({
      where: { id: req.params.id },
      include: { asset: true },
    });

    if (!allocation) throw new ApiError(404, 'Allocation not found');
    if (!['ACTIVE', 'OVERDUE'].includes(allocation.status)) {
      throw new ApiError(400, 'Allocation is not active');
    }

    const isAdminUser = req.user.role === 'ADMIN';
    const isOwner = req.employee && allocation.employeeId === req.employee.id;
    if (!isAdminUser && !isOwner) {
      throw new ApiError(403, 'You can only return assets assigned to you');
    }

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.allocation.update({
        where: { id: allocation.id },
        data: {
          status: 'RETURNED',
          actualReturnDate: new Date(),
          returnNotes,
          returnCondition,
          isOverdue: false,
        },
        include: { asset: true, employee: true },
      });

      await tx.asset.update({
        where: { id: allocation.assetId },
        data: {
          status: 'AVAILABLE',
          ...(returnCondition && { condition: returnCondition }),
        },
      });

      return updated;
    });

    await logActivity(req.user.id, 'RETURN', 'Allocation', allocation.id, req.body, req.ip);
    return successResponse(res, result, 'Asset returned');
  } catch (error) {
    next(error);
  }
};

export const getMyAllocations = async (req, res, next) => {
  try {
    if (!req.employee) throw new ApiError(400, 'Employee profile required');

    const allocations = await prisma.allocation.findMany({
      where: {
        employeeId: req.employee.id,
        status: { in: ['ACTIVE', 'OVERDUE'] },
      },
      include: {
        asset: { include: { category: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return successResponse(res, allocations);
  } catch (error) {
    next(error);
  }
};

export const checkAssetAvailability = async (req, res, next) => {
  try {
    const { assetId } = req.params;
    const activeAllocation = await prisma.allocation.findFirst({
      where: { assetId, status: { in: ['ACTIVE', 'OVERDUE'] } },
      include: { employee: true, department: true },
    });

    return successResponse(res, {
      available: !activeAllocation,
      currentAllocation: activeAllocation,
    });
  } catch (error) {
    next(error);
  }
};
