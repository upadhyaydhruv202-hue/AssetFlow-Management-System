import prisma from '../config/database.js';
import { ApiError, successResponse, paginatedResponse, parsePagination, buildPagination } from '../utils/apiResponse.js';
import { logActivity } from '../utils/activityLogger.js';
import { createNotification, notifyUsers, getManagersAndAdmins } from '../services/notificationService.js';
import { getFileUrl } from '../middleware/upload.js';
import { setMaintenanceSla } from '../services/maintenanceExtensionService.js';

export const getMaintenanceRequests = async (req, res, next) => {
  try {
    const { page, limit, skip, sortBy, sortOrder } = parsePagination(req.query);
    const { status, priority, assetId } = req.query;

    const where = {
      ...(status && { status }),
      ...(priority && { priority }),
      ...(assetId && { assetId }),
    };

    if (req.user.role === 'EMPLOYEE' && req.employee) {
      where.requestedById = req.employee.id;
    }

    const [requests, total] = await Promise.all([
      prisma.maintenanceRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          asset: { include: { category: true } },
          requestedBy: true,
          approvedBy: true,
          technician: true,
        },
      }),
      prisma.maintenanceRequest.count({ where }),
    ]);

    return paginatedResponse(res, requests, buildPagination(total, page, limit));
  } catch (error) {
    next(error);
  }
};

export const getMaintenanceRequest = async (req, res, next) => {
  try {
    const request = await prisma.maintenanceRequest.findUnique({
      where: { id: req.params.id },
      include: {
        asset: { include: { category: true } },
        requestedBy: true,
        approvedBy: true,
        technician: true,
      },
    });
    if (!request) throw new ApiError(404, 'Maintenance request not found');
    return successResponse(res, request);
  } catch (error) {
    next(error);
  }
};

export const createMaintenanceRequest = async (req, res, next) => {
  try {
    const { assetId, title, description, priority, damageAnnotations } = req.body;
    const photoUrl = req.file ? getFileUrl(req.file.filename) : null;
    const prio = priority || 'MEDIUM';

    const request = await prisma.maintenanceRequest.create({
      data: {
        assetId,
        requestedById: req.employee.id,
        title,
        description,
        priority: prio,
        photoUrl,
        damageAnnotations: damageAnnotations ? (typeof damageAnnotations === 'string' ? JSON.parse(damageAnnotations) : damageAnnotations) : null,
        slaDeadline: setMaintenanceSla(prio),
        status: 'PENDING',
      },
      include: {
        asset: true,
        requestedBy: true,
      },
    });

    const managerIds = await getManagersAndAdmins();
    await notifyUsers(
      managerIds,
      'GENERAL',
      'New Maintenance Request',
      `${req.employee.firstName} raised maintenance for ${request.asset.assetTag}`,
      `/maintenance/${request.id}`
    );

    await logActivity(req.user.id, 'CREATE', 'MaintenanceRequest', request.id, req.body, req.ip);
    return successResponse(res, request, 'Maintenance request created', 201);
  } catch (error) {
    next(error);
  }
};

export const approveMaintenance = async (req, res, next) => {
  try {
    const request = await prisma.maintenanceRequest.findUnique({
      where: { id: req.params.id },
      include: { asset: true, requestedBy: true },
    });

    if (!request) throw new ApiError(404, 'Request not found');
    if (request.status !== 'PENDING') throw new ApiError(400, 'Request is not pending');

    const updated = await prisma.$transaction(async (tx) => {
      const reqUpdated = await tx.maintenanceRequest.update({
        where: { id: request.id },
        data: {
          status: 'APPROVED',
          approvedById: req.employee.id,
          approvedAt: new Date(),
        },
        include: { asset: true, requestedBy: true, approvedBy: true },
      });

      await tx.asset.update({
        where: { id: request.assetId },
        data: { status: 'UNDER_MAINTENANCE' },
      });

      return reqUpdated;
    });

    await createNotification(
      request.requestedBy.userId,
      'MAINTENANCE_APPROVED',
      'Maintenance Approved',
      `Your maintenance request for ${request.asset.assetTag} has been approved`,
      `/maintenance/${request.id}`
    );

    await logActivity(req.user.id, 'APPROVE', 'MaintenanceRequest', request.id, null, req.ip);
    return successResponse(res, updated, 'Maintenance request approved');
  } catch (error) {
    next(error);
  }
};

export const rejectMaintenance = async (req, res, next) => {
  try {
    const { resolutionNotes } = req.body;
    const request = await prisma.maintenanceRequest.update({
      where: { id: req.params.id },
      data: {
        status: 'REJECTED',
        approvedById: req.employee.id,
        approvedAt: new Date(),
        resolutionNotes,
      },
      include: { asset: true, requestedBy: true },
    });

    await createNotification(
      request.requestedBy.userId,
      'MAINTENANCE_REJECTED',
      'Maintenance Rejected',
      `Your maintenance request for ${request.asset.assetTag} was rejected`,
      `/maintenance/${request.id}`
    );

    await logActivity(req.user.id, 'REJECT', 'MaintenanceRequest', request.id, req.body, req.ip);
    return successResponse(res, request, 'Maintenance request rejected');
  } catch (error) {
    next(error);
  }
};

export const assignTechnician = async (req, res, next) => {
  try {
    const { technicianId } = req.body;
    const request = await prisma.maintenanceRequest.update({
      where: { id: req.params.id },
      data: { technicianId, status: 'TECHNICIAN_ASSIGNED' },
      include: { asset: true, technician: true, requestedBy: true },
    });

    const tech = await prisma.employee.findUnique({ where: { id: technicianId } });
    if (tech) {
      await createNotification(
        tech.userId,
        'GENERAL',
        'Maintenance Assigned',
        `You have been assigned to maintain ${request.asset.assetTag}`,
        `/maintenance/${request.id}`
      );
    }

    await logActivity(req.user.id, 'ASSIGN', 'MaintenanceRequest', request.id, { technicianId }, req.ip);
    return successResponse(res, request, 'Technician assigned');
  } catch (error) {
    next(error);
  }
};

export const startMaintenance = async (req, res, next) => {
  try {
    const request = await prisma.maintenanceRequest.update({
      where: { id: req.params.id },
      data: { status: 'IN_PROGRESS', startedAt: new Date() },
      include: { asset: true },
    });
    await logActivity(req.user.id, 'START', 'MaintenanceRequest', request.id, null, req.ip);
    return successResponse(res, request, 'Maintenance started');
  } catch (error) {
    next(error);
  }
};

export const resolveMaintenance = async (req, res, next) => {
  try {
    const { resolutionNotes } = req.body;
    const request = await prisma.maintenanceRequest.findUnique({
      where: { id: req.params.id },
    });
    if (!request) throw new ApiError(404, 'Request not found');

    const updated = await prisma.$transaction(async (tx) => {
      const mttrMinutes = request.startedAt
        ? Math.round((Date.now() - new Date(request.startedAt).getTime()) / 60000)
        : null;
      const reqUpdated = await tx.maintenanceRequest.update({
        where: { id: request.id },
        data: {
          status: 'RESOLVED',
          resolutionNotes,
          resolvedAt: new Date(),
          mttrMinutes,
        },
        include: { asset: true, requestedBy: true, technician: true },
      });

      await tx.asset.update({
        where: { id: request.assetId },
        data: { status: 'AVAILABLE' },
      });

      return reqUpdated;
    });

    await logActivity(req.user.id, 'RESOLVE', 'MaintenanceRequest', request.id, req.body, req.ip);
    return successResponse(res, updated, 'Maintenance resolved');
  } catch (error) {
    next(error);
  }
};
