import { LightningElement, api, track } from 'lwc';
import { notify, extractErrorMessage, createFocusTrap } from 'c/posUtils';
import getMenuCategories from '@salesforce/apex/MenuController.getMenuCategories';
import getManagerReport from '@salesforce/apex/ManagerReportController.getManagerReport';
import createExcelExport from '@salesforce/apex/ManagerReportController.createExcelExport';

const PAGE_SIZE = 10;

export default class PosManagerStats extends LightningElement {
    @api restaurantId;
    @api currencyCode;

    @track isLoading = false;
    @track report;
    @track menuCategories = [];
    @track reportFilters = {
        preset: 'today',
        startDate: null,
        endDate: null,
        categoryId: '',
        paymentMethod: ''
    };
    @track orderDetailsPage = 1;
    @track hourlyTrendPage = 1;
    @track dailyTrendPage = 1;
    @track orderTableFilters = {
        paymentMethod: '',
        status: ''
    };
    @track showOrderDetailsModal = false;
    @track selectedOrderDetail = null;

    _modalKeyHandler;
    _modalFocusPending = false;

    connectedCallback() {
        this.initialize();
    }

    disconnectedCallback() {
        if (this._modalKeyHandler) {
            window.removeEventListener('keydown', this._modalKeyHandler);
            this._modalKeyHandler = null;
        }
    }

    async initialize() {
        await Promise.all([this.loadCategories(), this.loadReport()]);
    }

    async loadCategories() {
        this.menuCategories = await getMenuCategories({ restaurantId: this.restaurantId });
    }

    async loadReport() {
        this.report = await getManagerReport({
            restaurantId: this.restaurantId,
            startDate: this.reportFilters.startDate,
            endDate: this.reportFilters.endDate,
            datePreset: this.reportFilters.preset,
            categoryId: this.reportFilters.categoryId,
            paymentMethod: this.reportFilters.paymentMethod,
            includeCancelled: true
        });
        if (!this.report) {
            this.report = this.emptyReport;
        }
        this.orderDetailsPage = 1;
        this.hourlyTrendPage = 1;
        this.dailyTrendPage = 1;
    }

    async runSafely(action, successMessage, onError) {
        try {
            this.isLoading = true;
            await action();
            if (successMessage) {
                this.toast('Success', successMessage, 'success');
            }
        } catch (error) {
            const message = extractErrorMessage(error, 'Action failed');
            this.toast('Error', message, 'error');
            if (typeof onError === 'function') {
                onError(message);
            }
        } finally {
            this.isLoading = false;
        }
    }

    toast(title, message, variant) {
        notify(this, title, message, variant);
    }

    // ── Filters ──────────────────────────────
    handleFilterChange(event) {
        const key = event.target.name;
        const value = event.target.value || '';
        this.reportFilters = { ...this.reportFilters, [key]: value };
    }

    handleReportPresetChange(event) {
        const preset = event.target.value;
        const today = new Date();
        const toIso = (d) => d.toISOString().slice(0, 10);
        let startDate = null;
        let endDate = null;
        if (preset === 'yesterday') {
            const d = new Date(today);
            d.setDate(d.getDate() - 1);
            startDate = toIso(d);
            endDate = toIso(d);
        } else if (preset === 'last7') {
            const s = new Date(today);
            s.setDate(s.getDate() - 6);
            startDate = toIso(s);
            endDate = toIso(today);
        } else if (preset === 'last30') {
            const s = new Date(today);
            s.setDate(s.getDate() - 29);
            startDate = toIso(s);
            endDate = toIso(today);
        } else if (preset === 'today') {
            startDate = toIso(today);
            endDate = toIso(today);
        }
        this.reportFilters = { ...this.reportFilters, preset, startDate, endDate };
    }

    applyReportFilter() {
        if (this.reportFilters.preset === 'custom' && (!this.reportFilters.startDate || !this.reportFilters.endDate)) {
            this.toast('Warning', 'Select both start and end date for custom range.', 'warning');
            return;
        }
        this.runSafely(async () => {
            await this.loadReport();
        });
    }

    refreshStatistics() {
        this.runSafely(async () => {
            await this.loadReport();
        }, 'Statistics refreshed');
    }

    // ── Export ──────────────────────────────
    exportReportCsv() {
        try {
            const data = this.reportData;
            const workbookXml = this.buildExcelWorkbookXml(data);
            const timestamp = new Date().toISOString().slice(0, 10);
            const fileName = `manager-statistics-${timestamp}.xls`;
            createExcelExport({ fileName, fileContent: workbookXml })
                .then((downloadPath) => {
                    const absoluteUrl = downloadPath.startsWith('http')
                        ? downloadPath
                        : `${window.location.origin}${downloadPath}`;
                    window.open(absoluteUrl, '_blank');
                })
                .catch(() => {
                    this.toast('Error', 'Unable to export Excel. Please refresh and retry.', 'error');
                });
        } catch (error) {
            this.toast('Error', 'Unable to export Excel. Please refresh and retry.', 'error');
        }
    }

    csvEscape(value) {
        if (value === null || value === undefined) return '';
        const text = String(value);
        if (text.includes(',') || text.includes('"') || text.includes('\n')) {
            return `"${text.replace(/"/g, '""')}"`;
        }
        return text;
    }

    buildExcelWorkbookXml(data) {
        const xmlEsc = (value) => this.xmlEscape(value);
        const rowsToXml = (rows) =>
            rows.map((row) => `<Row>${row.map((cell) => `<Cell><Data ss:Type="String">${xmlEsc(cell)}</Data></Cell>`).join('')}</Row>`).join('');

        const summaryRows = [
            ['Metric', 'Value'],
            ['Orders', data.summary.orderCount],
            ['Revenue', data.summary.revenue],
            ['Average Order Value', data.summary.avgOrderValue],
            ['Tax', data.summary.taxAmount],
            ['CGST', data.summary.cgstAmount],
            ['SGST', data.summary.sgstAmount],
            ['Revenue Delta %', data.comparison.revenueDeltaPercent],
            ['Orders Delta %', data.comparison.orderDeltaPercent]
        ];
        const ordersRows = [
            ['Order', 'Date Time', 'Table', 'Status', 'Payment Method', 'Payment Status', 'Items', 'Total'],
            ...data.orderDetails.map((row) => [
                row.orderName,
                row.orderDateTimeLabel,
                row.tableName,
                row.status,
                row.paymentMethod,
                row.paymentStatus,
                row.itemCount,
                row.totalAmount
            ])
        ];
        const trendsRows = [
            ['Type', 'Bucket', 'Orders', 'Revenue'],
            ...data.dailyTrend.map((row) => ['Daily', row.dateLabel, row.orderCount, row.revenue]),
            ...data.hourlyTrend.map((row) => ['Hourly', row.label, row.orderCount, row.revenue])
        ];
        const itemsRows = [
            ['List', 'Item', 'Quantity', 'Revenue'],
            ...data.topItems.map((row) => ['Fast Selling', row.itemName, row.quantity, row.revenue]),
            ...data.slowItems.map((row) => ['Slow Moving', row.itemName, row.quantity, row.revenue])
        ];
        const mixRows = [
            ['Type', 'Name', 'Orders', 'Revenue'],
            ...data.categoryMix.map((row) => ['Category', row.categoryName, row.orderCount, row.revenue]),
            ...data.paymentMix.map((row) => ['Payment', row.paymentMethod, row.orderCount, row.revenue])
        ];

        return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Worksheet ss:Name="Summary"><Table>${rowsToXml(summaryRows)}</Table></Worksheet>
  <Worksheet ss:Name="Order Details"><Table>${rowsToXml(ordersRows)}</Table></Worksheet>
  <Worksheet ss:Name="Trends"><Table>${rowsToXml(trendsRows)}</Table></Worksheet>
  <Worksheet ss:Name="Items"><Table>${rowsToXml(itemsRows)}</Table></Worksheet>
  <Worksheet ss:Name="Mix"><Table>${rowsToXml(mixRows)}</Table></Worksheet>
</Workbook>`;
    }

    xmlEscape(value) {
        const text = String(value === null || value === undefined ? '' : value);
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    // ── Order Detail Modal ──────────────────────────────
    openOrderDetailsModal(event) {
        const orderId = event.currentTarget.dataset.id;
        const orderDetail = this.reportData.orderDetails.find((row) => row.orderId === orderId);
        if (!orderDetail) {
            return;
        }
        this.selectedOrderDetail = orderDetail;
        this.showOrderDetailsModal = true;
        this.prepareModalFocus();
        this._attachFocusTrap();
    }

    closeOrderDetailsModal() {
        this.showOrderDetailsModal = false;
        this.selectedOrderDetail = null;
        this._detachFocusTrap();
        this.teardownModalHandlerIfIdle();
    }

    handleOrderDetailsModalKeydown(event) {
        if (event.key === 'Escape') {
            this.closeOrderDetailsModal();
        }
    }

    // ── Order Table Filters ──────────────────────────────
    handleOrderTableFilterChange(event) {
        const key = event.target.name;
        const value = event.target.value || '';
        this.orderTableFilters = { ...this.orderTableFilters, [key]: value };
        this.orderDetailsPage = 1;
    }

    // ── Getters ──────────────────────────────
    get emptyReport() {
        return {
            summary: {
                orderCount: 0,
                revenue: 0,
                discountAmount: 0,
                avgOrderValue: 0,
                discountRate: 0,
                taxAmount: 0,
                cgstAmount: 0,
                sgstAmount: 0
            },
            comparison: {
                previousOrderCount: 0,
                previousRevenue: 0,
                orderDeltaPercent: 0,
                revenueDeltaPercent: 0
            },
            hourlyTrend: [],
            dailyTrend: [],
            categoryMix: [],
            paymentMix: [],
            tableStats: [],
            orderDetails: [],
            exceptions: {
                highDiscountOrderCount: 0,
                cancelledOrderCount: 0,
                unpaidOrderCount: 0,
                soldOutItemCount: 0
            },
            topItems: [],
            slowItems: []
        };
    }

    get reportData() {
        const data = this.report || this.emptyReport;
        const summary = data.summary || this.emptyReport.summary;
        const comparison = data.comparison || this.emptyReport.comparison;
        const exceptions = data.exceptions || this.emptyReport.exceptions;
        const withRank = (rows) => (rows || []).map((item, idx) => ({ ...item, rank: idx + 1 }));
        const formatCurrency = (value) => this.formatCurrency(value);
        const formatDateTime = (value) => this.formatDateTime(value);
        const formatHour12 = (value) => this.formatHour12(value);
        return {
            summary: {
                ...summary,
                revenue: formatCurrency(summary.revenue),
                netSales: formatCurrency((Number(summary.revenue || 0) - Number(summary.taxAmount || 0))),
                discountAmount: formatCurrency(summary.discountAmount),
                avgOrderValue: formatCurrency(summary.avgOrderValue),
                taxAmount: formatCurrency(summary.taxAmount),
                cgstAmount: formatCurrency(summary.cgstAmount),
                sgstAmount: formatCurrency(summary.sgstAmount),
                discountRate: Number(summary.discountRate || 0).toFixed(2)
            },
            comparison: {
                ...comparison,
                revenueDeltaPercent: Number(comparison.revenueDeltaPercent || 0).toFixed(2),
                orderDeltaPercent: Number(comparison.orderDeltaPercent || 0).toFixed(2)
            },
            hourlyTrend: (data.hourlyTrend || []).map((row) => ({
                ...row,
                label: formatHour12(row.label),
                revenue: formatCurrency(row.revenue)
            })),
            dailyTrend: (data.dailyTrend || []).map((row) => ({ ...row, revenue: formatCurrency(row.revenue) })),
            categoryMix: (data.categoryMix || []).map((row) => ({
                ...row,
                revenue: formatCurrency(row.revenue),
                categoryNameClass: row.isDeleted ? 'deleted-category-text' : ''
            })),
            paymentMix: (data.paymentMix || []).map((row) => ({ ...row, revenue: formatCurrency(row.revenue) })),
            tableStats: (data.tableStats || []).map((row) => ({
                ...row,
                revenue: formatCurrency(row.revenue),
                avgOrderValue: formatCurrency(row.avgOrderValue)
            })),
            orderDetails: (data.orderDetails || []).map((row) => ({
                ...row,
                tableName: row.tableName || '-',
                customerName: row.customerName || '-',
                customerPhone: row.customerPhone || '-',
                paymentMethod: this.normalizePaymentMethod(row.paymentMethod),
                paymentStatus: row.paymentStatus || '-',
                itemCount: Number(row.itemCount || 0),
                subtotal: formatCurrency(row.subtotal),
                discountAmount: formatCurrency(row.discountAmount),
                taxAmount: formatCurrency(row.taxAmount),
                totalAmount: formatCurrency(row.totalAmount),
                orderDateTimeLabel: formatDateTime(row.orderDateTime),
                lineItems: (row.lineItems || []).map((line, idx) => ({
                    ...line,
                    rowKey: `${row.orderId}-${idx}`,
                    quantity: Number(line.quantity || 0),
                    unitPrice: formatCurrency(line.unitPrice),
                    lineTotal: formatCurrency(line.lineTotal),
                    notes: line.notes || '-',
                    status: line.status || '-'
                }))
            })),
            exceptions: {
                ...exceptions,
                cancellationRatePercent: Number(summary.orderCount || 0) > 0
                    ? ((Number(exceptions.cancelledOrderCount || 0) / Number(summary.orderCount || 0)) * 100).toFixed(2)
                    : '0.00'
            },
            topItems: withRank((data.topItems || []).slice(0, 5)).map((row) => ({ ...row, revenue: formatCurrency(row.revenue) })),
            slowItems: withRank((data.slowItems || []).slice(0, 5)).map((row) => ({ ...row, revenue: formatCurrency(row.revenue) }))
        };
    }

    get categoryOptions() {
        return this.menuCategories.map((cat) => ({ label: cat.Name, value: cat.Id }));
    }

    get reportCategoryOptions() {
        return [{ label: 'All Categories', value: '' }, ...this.categoryOptions];
    }

    get paymentMethodOptions() {
        return [
            { label: 'All Payment Methods', value: '' },
            { label: 'Cash', value: 'Cash' },
            { label: 'UPI', value: 'UPI' },
            { label: 'Card', value: 'Card' },
            { label: 'Mixed', value: 'Mixed' }
        ];
    }

    get reportPresetOptions() {
        return [
            { label: 'Today', value: 'today' },
            { label: 'Yesterday', value: 'yesterday' },
            { label: 'Last 7 Days', value: 'last7' },
            { label: 'Last 30 Days', value: 'last30' },
            { label: 'Custom', value: 'custom' }
        ];
    }

    get isCustomDatePreset() {
        return this.reportFilters.preset === 'custom';
    }

    get isPresetManagedDates() {
        return this.reportFilters.preset !== 'custom';
    }

    get filteredOrderDetails() {
        const paymentFilter = this.orderTableFilters.paymentMethod;
        const statusFilter = this.orderTableFilters.status;
        return this.reportData.orderDetails.filter((row) => {
            const paymentOk = !paymentFilter || row.paymentMethod === paymentFilter;
            const statusOk = !statusFilter || row.status === statusFilter;
            return paymentOk && statusOk;
        });
    }

    get orderDetailsPaymentFilterOptions() {
        const seen = new Set();
        this.reportData.orderDetails.forEach((row) => {
            if (row.paymentMethod) {
                seen.add(row.paymentMethod);
            }
        });
        return [
            { label: 'All Payments', value: '' },
            ...Array.from(seen).sort().map((value) => ({ label: value, value }))
        ];
    }

    get orderDetailsStatusFilterOptions() {
        const seen = new Set();
        this.reportData.orderDetails.forEach((row) => {
            if (row.status) {
                seen.add(row.status);
            }
        });
        return [
            { label: 'All Statuses', value: '' },
            ...Array.from(seen).sort().map((value) => ({ label: value, value }))
        ];
    }

    get pagedOrderDetails() {
        return this.paginateRows(this.filteredOrderDetails, this.orderDetailsPage);
    }

    get orderDetailsTotalPages() {
        return Math.max(1, Math.ceil((this.filteredOrderDetails.length || 0) / PAGE_SIZE));
    }

    get orderDetailsPageLabel() {
        return `Page ${this.orderDetailsPage} of ${this.orderDetailsTotalPages}`;
    }

    get showOrderPagination() {
        return this.filteredOrderDetails.length > PAGE_SIZE;
    }

    get disableOrderPrev() {
        return this.orderDetailsPage <= 1;
    }

    get disableOrderNext() {
        return this.orderDetailsPage >= this.orderDetailsTotalPages;
    }

    get pagedHourlyTrend() {
        return this.paginateRows(this.reportData.hourlyTrend, this.hourlyTrendPage, 5);
    }

    get pagedDailyTrend() {
        return this.paginateRows(this.reportData.dailyTrend, this.dailyTrendPage, 5);
    }

    get hourlyTrendTotalPages() {
        return Math.max(1, Math.ceil((this.reportData.hourlyTrend.length || 0) / 5));
    }

    get dailyTrendTotalPages() {
        return Math.max(1, Math.ceil((this.reportData.dailyTrend.length || 0) / 5));
    }

    get hourlyTrendPageLabel() {
        return `Page ${this.hourlyTrendPage} of ${this.hourlyTrendTotalPages}`;
    }

    get dailyTrendPageLabel() {
        return `Page ${this.dailyTrendPage} of ${this.dailyTrendTotalPages}`;
    }

    get disableHourlyPrev() {
        return this.hourlyTrendPage <= 1;
    }

    get disableHourlyNext() {
        return this.hourlyTrendPage >= this.hourlyTrendTotalPages;
    }

    get disableDailyPrev() {
        return this.dailyTrendPage <= 1;
    }

    get disableDailyNext() {
        return this.dailyTrendPage >= this.dailyTrendTotalPages;
    }

    get showHourlyPagination() {
        return this.reportData.hourlyTrend.length > 5;
    }

    get showDailyPagination() {
        return this.reportData.dailyTrend.length > 5;
    }

    // ── Pagination Handlers ──────────────────────────────
    handleOrderPrev() {
        this.orderDetailsPage = Math.max(1, this.orderDetailsPage - 1);
    }

    handleOrderNext() {
        this.orderDetailsPage = Math.min(this.orderDetailsTotalPages, this.orderDetailsPage + 1);
    }

    handleHourlyPrev() {
        this.hourlyTrendPage = Math.max(1, this.hourlyTrendPage - 1);
    }

    handleHourlyNext() {
        this.hourlyTrendPage = Math.min(this.hourlyTrendTotalPages, this.hourlyTrendPage + 1);
    }

    handleDailyPrev() {
        this.dailyTrendPage = Math.max(1, this.dailyTrendPage - 1);
    }

    handleDailyNext() {
        this.dailyTrendPage = Math.min(this.dailyTrendTotalPages, this.dailyTrendPage + 1);
    }

    // ── Formatting Utilities ──────────────────────────────
    formatCurrency(value) {
        const amount = Number(value || 0);
        try {
            return new Intl.NumberFormat('en-IN', {
                style: 'currency',
                currency: this.currencyCode || 'INR',
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }).format(amount);
        } catch (e) {
            return `INR ${amount.toFixed(2)}`;
        }
    }

    formatDateTime(value) {
        if (!value) {
            return '-';
        }
        try {
            return new Intl.DateTimeFormat('en-IN', {
                dateStyle: 'medium',
                timeStyle: 'short'
            }).format(new Date(value));
        } catch (e) {
            return value;
        }
    }

    formatHour12(value) {
        const raw = String(value || '').trim();
        if (!raw) {
            return '-';
        }
        const hourPart = raw.split(':')[0];
        const hour = Number(hourPart);
        if (!Number.isFinite(hour) || hour < 0 || hour > 23) {
            return raw;
        }
        const suffix = hour >= 12 ? 'PM' : 'AM';
        const hour12 = hour % 12 || 12;
        return `${hour12}:00 ${suffix}`;
    }

    normalizePaymentMethod(value) {
        const raw = String(value || '').trim();
        if (!raw) {
            return 'Unspecified';
        }
        const lower = raw.toLowerCase();
        if (lower.includes('mix')) {
            return 'Mixed';
        }
        return raw;
    }

    paginateRows(rows, page, pageSize = PAGE_SIZE) {
        const safeRows = rows || [];
        const start = (page - 1) * pageSize;
        return safeRows.slice(start, start + pageSize);
    }

    // ── Utilities ──────────────────────────────
    stopPropagation(event) {
        event.stopPropagation();
    }

    prepareModalFocus() {
        this._modalFocusPending = true;
        if (this._modalKeyHandler) {
            return;
        }
        this._modalKeyHandler = (event) => {
            if (event.key !== 'Escape') {
                return;
            }
            if (this.showOrderDetailsModal) {
                this.closeOrderDetailsModal();
            }
        };
        window.addEventListener('keydown', this._modalKeyHandler);
    }

    teardownModalHandlerIfIdle() {
        if (this.showOrderDetailsModal) {
            return;
        }
        if (this._modalKeyHandler) {
            window.removeEventListener('keydown', this._modalKeyHandler);
            this._modalKeyHandler = null;
        }
    }

    _attachFocusTrap() {
        if (this._focusTrapHandler) return;
        this._focusTrapHandler = createFocusTrap(() => this.template.querySelector('.modal-card'));
        window.addEventListener('keydown', this._focusTrapHandler);
    }

    _detachFocusTrap() {
        if (this._focusTrapHandler) {
            window.removeEventListener('keydown', this._focusTrapHandler);
            this._focusTrapHandler = null;
        }
    }

    renderedCallback() {
        if (!this._modalFocusPending) {
            return;
        }
        const firstInput = this.template.querySelector('.modal-card lightning-input, .modal-card lightning-combobox, .modal-card button');
        if (firstInput && typeof firstInput.focus === 'function') {
            firstInput.focus();
            this._modalFocusPending = false;
        }
    }
}
