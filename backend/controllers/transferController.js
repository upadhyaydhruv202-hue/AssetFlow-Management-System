import prisma from '../config/database.js';
import { ApiError, successResponse, paginatedResponse, parsePagination, buildPagination } from '../utils/apiResponse.js';
import { logActivity } from '../utils/activityLogger.js';
import { createNotification } from '../services/notificationService.js';

export const getTransfers = async (req, res, next) => {
  try {
    const { page, limit, skip, sortBy, sortOrder } = parsePagination(req.query);
    const { status } = req.query;

    const where = { ...(status && { status }) };

    if (req.user.role === 'EMPLOYEE' && req.employee) {
      where.OR = [
        { requestedById: req.employee.id },
        { fromEmployeeId: req.employee.id },
        { toEmployeeId: req.employee.id },
      ];
    }

    const [transfers, total] = await Promise.all([
      prisma.transfer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          asset: { include: { category: true } },
          fromEmployee: true,
          toEmployee: true,
          requestedBy: true,
          approvedBy: true,
        },
      }),
      prisma.transfer.count({ where }),
    ]);

    return paginatedResponse(res, transfers, buildPagination(total, page, limit));
  } catch (error) {
    next(error);
  }
};

export const createTransfer = async (req, res, next) => {
  try {
    let { assetId, toEmployeeId, toDepartmentId, reason } = req.body;
    toEmployeeId = toEmployeeId || null;
    toDepartmentId = toDepartmentId || null;

    if (!req.employee) throw new ApiError(400, 'Employee profile required');

    const activeAllocation = await prisma.allocation.findFirst({
      where: { assetId, status: { in: ['ACTIVE', 'OVERDUE'] } },
      include: { employee: true },
    });

    if (!activeAllocation) {
      throw new ApiError(400, 'Asset is not currently allocated');
    }

    const transfer = await prisma.transfer.create({
      data: {
        assetId,
        fromEmployeeId: activeAllocation.employeeId,
        toEmployeeId,
        toDepartmentId,
        requestedById: req.employee.id,
        reason,
        status: 'REQUESTED',
      },
      include: {
        asset: true,
        fromEmployee: true,
        toEmployee: true,
        requestedBy: true,
      },
    });

    const managers = await prisma.user.findMany({
      where: { role: 'ADMIN', status: 'ACTIVE' },
      select: { id: true },
    });

    for (const m of managers) {
      await createNotification(
        m.id,
        'GENERAL',
        'Transfer Request',
        `Transfer request for ${transfer.asset.assetTag} from ${transfer.requestedBy.firstName}`,
        `/allocation/transfers`
      );
    }

    await logActivity(req.user.id, 'CREATE', 'Transfer', transfer.id, req.body, req.ip);
    return successResponse(res, transfer, 'Transfer request created', 201);
  } catch (error) {
    next(error);
  }
};

export const approveTransfer = async (req, res, next) => {
  try {
    const transfer = await prisma.transfer.findUnique({
      where: { id: req.params.id },
      include: { asset: true },
    });

    if (!transfer) throw new ApiError(404, 'Transfer not found');
    if (transfer.status !== 'REQUESTED') throw new ApiError(400, 'Transfer is not pending');

    const result = await prisma.$transaction(async (tx) => {
      await tx.allocation.updateMany({
        where: { assetId: transfer.assetId, status: { in: ['ACTIVE', 'OVERDUE'] } },
        data: { status: 'RETURNED', actualReturnDate: new Date() },
      });

      const newAllocation = await tx.allocation.create({
        data: {
          assetId: transfer.assetId,
          employeeId: transfer.toEmployeeId,
          departmentId: transfer.toDepartmentId,
          allocatedById: req.employee.id,
          status: 'ACTIVE',
        },
      });

      const updatedTransfer = await tx.transfer.update({
        where: { id: transfer.id },
        data: {
          status: 'COMPLETED',
          approvedById: req.employee.id,
          approvedAt: new Date(),
          completedAt: new Date(),
        },
        include: {
          asset: true,
          fromEmployee: true,
          toEmployee: true,
          requestedBy: true,
          approvedBy: true,
        },
      });

      await tx.asset.update({
        where: { id: transfer.assetId },
        data: { status: 'ALLOCATED' },
      });

      return { transfer: updatedTransfer, allocation: newAllocation };
    });

    const requester = await prisma.employee.findUnique({
      where: { id: transfer.requestedById },
      select: { userId: true },
    });
    if (requester) {
      await createNotification(
        requester.userId,
        'TRANSFER_APPROVED',
        'Transfer Approved',
        `Transfer for ${transfer.asset.assetTag} has been approved`,
        '/allocation/transfers'
      );
    }

    await logActivity(req.user.id, 'APPROVE', 'Transfer', transfer.id, null, req.ip);
    return successResponse(res, result, 'Transfer approved and completed');
  } catch (error) {
    next(error);
  }
};

export const rejectTransfer = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const transfer = await prisma.transfer.update({
      where: { id: req.params.id },
      data: { status: 'REJECTED', approvedById: req.employee.id, approvedAt: new Date() },
      include: { asset: true, requestedBy: true },
    });

    const requester = await prisma.employee.findUnique({
      where: { id: transfer.requestedById },
      select: { userId: true },
    });

    if (requester) {
      await createNotification(
        requester.userId,
        'TRANSFER_REJECTED',
        'Transfer Rejected',
        `Transfer for ${transfer.asset.assetTag} was rejected${reason ? `: ${reason}` : ''}`,
        '/allocation/transfers'
      );
    }

    await logActivity(req.user.id, 'REJECT', 'Transfer', transfer.id, { reason }, req.ip);
    return successResponse(res, transfer, 'Transfer rejected');
  } catch (error) {
    next(error);
  }
};
