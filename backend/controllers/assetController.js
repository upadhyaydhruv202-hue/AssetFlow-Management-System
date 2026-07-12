import prisma from '../config/database.js';
import { ApiError, successResponse, paginatedResponse, parsePagination, buildPagination } from '../utils/apiResponse.js';
import { logActivity } from '../utils/activityLogger.js';
import { generateAssetTag, generateQRCode } from '../services/qrService.js';
import { getFileUrl } from '../middleware/upload.js';
import { recordAssetHistory, updateAssetHealth, calculateHealthScore } from '../services/assetHealthService.js';
import { suggestAssetFromImage } from '../services/aiService.js';

export const getAssets = async (req, res, next) => {
  try {
    const { page, limit, skip, sortBy, sortOrder } = parsePagination(req.query);
    const { search, categoryId, status, location, isBookable, departmentId } = req.query;

    const where = {
      deletedAt: null,
      ...(categoryId && { categoryId }),
      ...(status && { status }),
      ...(location && { location: { contains: location, mode: 'insensitive' } }),
      ...(isBookable !== undefined && { isBookable: isBookable === 'true' }),
      ...(search && {
        OR: [
          { assetTag: { contains: search, mode: 'insensitive' } },
          { name: { contains: search, mode: 'insensitive' } },
          { serialNumber: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(departmentId && {
        allocations: {
          some: { departmentId, status: { in: ['ACTIVE', 'OVERDUE'] } },
        },
      }),
    };

    const [assets, total] = await Promise.all([
      prisma.asset.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          category: true,
          allocations: {
            where: { status: { in: ['ACTIVE', 'OVERDUE'] } },
            include: {
              employee: { select: { id: true, firstName: true, lastName: true } },
              department: { select: { id: true, name: true } },
            },
            take: 1,
          },
        },
      }),
      prisma.asset.count({ where }),
    ]);

    return paginatedResponse(res, assets, buildPagination(total, page, limit));
  } catch (error) {
    next(error);
  }
};

export const getAsset = async (req, res, next) => {
  try {
    const asset = await prisma.asset.findFirst({
      where: {
        deletedAt: null,
        OR: [{ id: req.params.id }, { assetTag: req.params.id }],
      },
      include: {
        category: true,
        allocations: {
          orderBy: { createdAt: 'desc' },
          include: {
            employee: true,
            department: true,
            allocatedBy: { select: { firstName: true, lastName: true } },
          },
        },
        maintenanceRequests: {
          orderBy: { createdAt: 'desc' },
          include: {
            requestedBy: { select: { firstName: true, lastName: true } },
            technician: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });

    if (!asset) throw new ApiError(404, 'Asset not found');
    return successResponse(res, asset);
  } catch (error) {
    next(error);
  }
};

export const createAsset = async (req, res, next) => {
  try {
    const {
      name, serialNumber, categoryId, acquisitionDate, acquisitionCost,
      condition, location, isBookable, description, rfidIdentifier, warrantyExpiryDate, specifications,
    } = req.body;

    const assetTag = await generateAssetTag(prisma);
    const qrCode = await generateQRCode(assetTag);

    const photoUrl = req.files?.photo?.[0] ? getFileUrl(req.files.photo[0].filename) : null;
    const documentUrl = req.files?.document?.[0] ? getFileUrl(req.files.document[0].filename) : null;

    const healthScore = 100;
    const asset = await prisma.asset.create({
      data: {
        assetTag,
        name,
        serialNumber,
        categoryId,
        acquisitionDate: acquisitionDate ? new Date(acquisitionDate) : null,
        acquisitionCost: acquisitionCost ? parseFloat(acquisitionCost) : null,
        condition: condition || 'GOOD',
        location,
        isBookable: isBookable === true || isBookable === 'true',
        description,
        photoUrl,
        documentUrl,
        qrCode,
        rfidIdentifier: rfidIdentifier || null,
        warrantyExpiryDate: warrantyExpiryDate ? new Date(warrantyExpiryDate) : null,
        specifications: specifications ? (typeof specifications === 'string' ? JSON.parse(specifications) : specifications) : null,
        healthScore,
        status: 'AVAILABLE',
      },
      include: { category: true },
    });

    await recordAssetHistory(asset.id, 'CREATE', req.user.id, { details: { assetTag } });
    await updateAssetHealth(asset.id);

    const aiSuggestion = photoUrl ? suggestAssetFromImage(req.files?.photo?.[0]?.originalname) : null;

    await logActivity(req.user.id, 'CREATE', 'Asset', asset.id, { assetTag }, req.ip);
    return successResponse(res, { asset, aiSuggestion }, 'Asset registered', 201);
  } catch (error) {
    next(error);
  }
};

export const updateAsset = async (req, res, next) => {
  try {
    const data = { ...req.body };
    if (data.acquisitionDate) data.acquisitionDate = new Date(data.acquisitionDate);
    if (data.acquisitionCost) data.acquisitionCost = parseFloat(data.acquisitionCost);
    if (data.isBookable !== undefined) data.isBookable = data.isBookable === true || data.isBookable === 'true';

    if (req.files?.photo?.[0]) data.photoUrl = getFileUrl(req.files.photo[0].filename);
    if (req.files?.document?.[0]) data.documentUrl = getFileUrl(req.files.document[0].filename);

    const asset = await prisma.asset.update({
      where: { id: req.params.id },
      data,
      include: { category: true },
    });

    await recordAssetHistory(asset.id, 'UPDATE', req.user.id, { details: req.body });
    await updateAssetHealth(asset.id);

    await logActivity(req.user.id, 'UPDATE', 'Asset', asset.id, req.body, req.ip);
    return successResponse(res, asset, 'Asset updated');
  } catch (error) {
    next(error);
  }
};

export const deleteAsset = async (req, res, next) => {
  try {
    await prisma.asset.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date(), status: 'DISPOSED' },
    });
    await logActivity(req.user.id, 'DELETE', 'Asset', req.params.id, null, req.ip);
    return successResponse(res, null, 'Asset disposed');
  } catch (error) {
    next(error);
  }
};

export const getBookableAssets = async (req, res, next) => {
  try {
    const assets = await prisma.asset.findMany({
      where: { deletedAt: null, isBookable: true, status: { in: ['AVAILABLE', 'RESERVED'] } },
      include: { category: true },
      orderBy: { name: 'asc' },
    });
    return successResponse(res, assets);
  } catch (error) {
    next(error);
  }
};

export const updateAssetStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const asset = await prisma.asset.update({
      where: { id: req.params.id },
      data: { status },
      include: { category: true },
    });
    await logActivity(req.user.id, 'STATUS_CHANGE', 'Asset', asset.id, { status }, req.ip);
    return successResponse(res, asset, 'Asset status updated');
  } catch (error) {
    next(error);
  }
};
