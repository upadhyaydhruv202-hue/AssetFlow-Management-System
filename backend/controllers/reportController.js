import {
  getUtilizationReport,
  getMaintenanceFrequency,
  getDepartmentAllocationSummary,
  getBookingHeatmap,
  getAssetsDueForMaintenance,
  getCategoryMaintenanceStats,
} from '../services/reportService.js';
import {
  getMaintenanceRetirementReport,
  getMaintenanceRetirementSummary,
  getResourceBookingHeatmap,
  getMaintenanceRetirementExportRows,
  getHeatmapExportRows,
  logMaintenanceStatusChange,
} from '../services/reportExtensionService.js';
import { successResponse } from '../utils/apiResponse.js';
import { dispatchExport } from '../utils/exportUtil.js';

export const getReports = async (req, res, next) => {
  try {
    const [
      utilization,
      maintenanceFrequency,
      departmentSummary,
      bookingHeatmap,
      assetsDueMaintenance,
      categoryMaintenance,
    ] = await Promise.all([
      getUtilizationReport(),
      getMaintenanceFrequency(),
      getDepartmentAllocationSummary(),
      getBookingHeatmap(),
      getAssetsDueForMaintenance(),
      getCategoryMaintenanceStats(),
    ]);

    return successResponse(res, {
      utilization,
      maintenanceFrequency,
      departmentSummary,
      bookingHeatmap,
      assetsDueMaintenance,
      categoryMaintenance,
    });
  } catch (error) {
    next(error);
  }
};

export const getMaintenanceRetirement = async (req, res, next) => {
  try {
    const data = await getMaintenanceRetirementReport(req.query, req.user);
    return successResponse(res, data);
  } catch (error) {
    next(error);
  }
};

export const getMaintenanceRetirementSummaryHandler = async (req, res, next) => {
  try {
    const summary = await getMaintenanceRetirementSummary(req.user);
    return successResponse(res, summary);
  } catch (error) {
    next(error);
  }
};

export const getBookingHeatmapAnalytics = async (req, res, next) => {
  try {
    const data = await getResourceBookingHeatmap(req.query, req.user);
    return successResponse(res, data);
  } catch (error) {
    next(error);
  }
};

const MAINTENANCE_EXPORT_COLUMNS = [
  { key: 'assetTag', label: 'Asset Tag' },
  { key: 'assetName', label: 'Asset Name' },
  { key: 'category', label: 'Category' },
  { key: 'department', label: 'Department' },
  { key: 'assignedEmployee', label: 'Assigned Employee' },
  { key: 'status', label: 'Status' },
  { key: 'healthScore', label: 'Health Score' },
  { key: 'lastMaintenanceDate', label: 'Last Maintenance', accessor: (r) => r.lastMaintenanceDate ? new Date(r.lastMaintenanceDate).toLocaleDateString() : '—' },
  { key: 'nextMaintenanceDate', label: 'Next Maintenance', accessor: (r) => r.nextMaintenanceDate ? new Date(r.nextMaintenanceDate).toLocaleDateString() : '—' },
  { key: 'retirementDate', label: 'Retirement Date', accessor: (r) => r.retirementDate ? new Date(r.retirementDate).toLocaleDateString() : '—' },
  { key: 'daysRemaining', label: 'Days Remaining' },
  { key: 'priority', label: 'Priority' },
  { key: 'location', label: 'Location' },
];

const HEATMAP_EXPORT_COLUMNS = [
  { key: 'resource', label: 'Resource' },
  { key: 'category', label: 'Category' },
  { key: 'location', label: 'Location' },
  { key: 'timeSlot', label: 'Time Slot' },
  { key: 'bookings', label: 'Total Bookings' },
  { key: 'utilizationPct', label: 'Utilization %' },
  { key: 'peakDay', label: 'Peak Day' },
];

export const exportReport = async (req, res, next) => {
  try {
    const { type, format = 'csv' } = req.query;

    if (type === 'maintenance-retirement') {
      const rows = await getMaintenanceRetirementExportRows(req.query, req.user);
      await logMaintenanceStatusChange(req.user.id, null, { export: type, format, count: rows.length }, req.ip);
      return dispatchExport(res, {
        format,
        filename: `maintenance-retirement-${Date.now()}`,
        title: 'Assets Due for Maintenance & Near Retirement',
        sheetName: 'Maintenance Retirement',
        rows,
        columns: MAINTENANCE_EXPORT_COLUMNS,
      });
    }

    if (type === 'booking-heatmap') {
      const rows = await getHeatmapExportRows(req.query, req.user);
      return dispatchExport(res, {
        format,
        filename: `booking-heatmap-${Date.now()}`,
        title: 'Resource Booking Heatmap',
        sheetName: 'Booking Heatmap',
        rows,
        columns: HEATMAP_EXPORT_COLUMNS,
      });
    }

    let data;
    switch (type) {
      case 'utilization':
        data = await getUtilizationReport();
        break;
      case 'maintenance':
        data = await getMaintenanceFrequency();
        break;
      case 'departments':
        data = await getDepartmentAllocationSummary();
        break;
      case 'bookings':
        data = await getBookingHeatmap();
        break;
      default:
        data = await getUtilizationReport();
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${type || 'report'}-${Date.now()}.json"`);
    return res.json({ success: true, data, exportedAt: new Date().toISOString() });
  } catch (error) {
    next(error);
  }
};
