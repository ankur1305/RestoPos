import { LightningElement, api, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getManagerTables from '@salesforce/apex/TableController.getManagerTables';
import upsertTable from '@salesforce/apex/TableController.upsertTable';
import updateTableStatus from '@salesforce/apex/TableController.updateTableStatus';
import transferCurrentOrder from '@salesforce/apex/TableController.transferCurrentOrder';
import getManagerMenuData from '@salesforce/apex/MenuController.getManagerMenuData';
import upsertMenuCategory from '@salesforce/apex/MenuController.upsertMenuCategory';
import deleteMenuCategory from '@salesforce/apex/MenuController.deleteMenuCategory';
import upsertMenuItem from '@salesforce/apex/MenuController.upsertMenuItem';
import deleteMenuItem from '@salesforce/apex/MenuController.deleteMenuItem';
import bulkUpdateAvailability from '@salesforce/apex/MenuController.bulkUpdateAvailability';
import setCategoryAvailability from '@salesforce/apex/MenuController.setCategoryAvailability';
import getManagerReport from '@salesforce/apex/ManagerReportController.getManagerReport';
import createExcelExport from '@salesforce/apex/ManagerReportController.createExcelExport';

const EMPTY_TABLE = { Id: null, Name: '', Capacity__c: 4, Sort_Order__c: 1, Status__c: 'Available' };
const EMPTY_CATEGORY = { Id: null, Name: '', Sort_Order__c: 1, Icon__c: '', Is_Active__c: true };
const PAGE_SIZE = 10;

export default class PosManagerDesktop extends LightningElement {
    @api restaurantId;
    @api currencyCode;

    @track activeTab = 'tables';
    @track isDesktop = true;
    @track isLoading = false;
    @track tables = [];
    @track menuCategories = [];
    @track menuItems = [];
    @track report;
    @track selectedCategoryId = '';
    @track tableForm = { ...EMPTY_TABLE };
    @track categoryForm = { ...EMPTY_CATEGORY };
    @track itemForm = {
        Id: null, Name: '', Menu_Category__c: '', Price__c: 0, Description__c: '',
        Is_Available__c: true, Is_Vegetarian__c: false, Sort_Order__c: 1, Image_URL__c: ''
    };
    @track reportFilters = {
        preset: 'today',
        startDate: null,
        endDate: null,
        categoryId: '',
        paymentMethod: ''
    };
    @track transferSourceTableId = '';
    @track transferTargetTableId = '';
    @track categoryDeleteError = '';
    @track transferError = '';
    @track tableFormError = '';
    @track categoryFormError = '';
    @track itemFormError = '';
    @track tablesPage = 1;
    @track menuItemsPage = 1;
    @track orderDetailsPage = 1;
    @track hourlyTrendPage = 1;
    @track dailyTrendPage = 1;
    @track orderTableFilters = {
        paymentMethod: '',
        status: ''
    };

    // Modal state
    @track showEditTableModal = false;
    @track showEditCategoryModal = false;
    @track showEditItemModal = false;
    @track showOrderDetailsModal = false;
    @track selectedOrderDetail = null;
    @track editModalTitle = '';

    connectedCallback() {
        this.isDesktop = window.matchMedia('(min-width: 1024px)').matches;
        this.resizeHandler = () => {
            this.isDesktop = window.matchMedia('(min-width: 1024px)').matches;
        };
        window.addEventListener('resize', this.resizeHandler);
        this.initialize();
    }

    disconnectedCallback() {
        if (this.resizeHandler) {
            window.removeEventListener('resize', this.resizeHandler);
        }
    }

    async initialize() {
        await Promise.all([this.loadTables(), this.loadMenu(), this.loadReport()]);
    }

    async loadTables() {
        this.tables = await getManagerTables({ restaurantId: this.restaurantId });
        this.tablesPage = 1;
    }

    async loadMenu() {
        const data = await getManagerMenuData({ restaurantId: this.restaurantId });
        this.menuCategories = data.categories || [];
        this.menuItems = data.items || [];
        this.menuItemsPage = 1;
        if (!this.selectedCategoryId && this.menuCategories.length) {
            this.selectedCategoryId = this.menuCategories[0].Id;
        }
        if (!this.itemForm.Menu_Category__c && this.menuCategories.length) {
            this.itemForm = { ...this.itemForm, Menu_Category__c: this.menuCategories[0].Id };
        }
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
            const message = this.getErrorMessage(error);
            this.toast('Error', message, 'error');
            if (typeof onError === 'function') {
                onError(message);
            }
        } finally {
            this.isLoading = false;
        }
    }

    getErrorMessage(error) {
        if (!error) {
            return 'Action failed';
        }

        if (error.body) {
            if (typeof error.body.message === 'string' && error.body.message) {
                return error.body.message;
            }
            if (Array.isArray(error.body.pageErrors) && error.body.pageErrors.length) {
                return error.body.pageErrors[0].message || 'Action failed';
            }
            if (error.body.output) {
                const outputErrors = error.body.output.errors;
                if (Array.isArray(outputErrors) && outputErrors.length) {
                    return outputErrors[0].message || 'Action failed';
                }
                const fieldErrors = error.body.output.fieldErrors || {};
                const firstField = Object.keys(fieldErrors)[0];
                if (firstField && Array.isArray(fieldErrors[firstField]) && fieldErrors[firstField].length) {
                    return fieldErrors[firstField][0].message || 'Action failed';
                }
            }
        }

        if (typeof error.message === 'string' && error.message) {
            return error.message;
        }
        return 'Action failed';
    }

    toast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }

    handleCustomTabChange(event) {
        this.activeTab = event.currentTarget.dataset.tab;
    }

    get tablesTabClass() {
        return 'tab-btn' + (this.activeTab === 'tables' ? ' active' : '');
    }

    get menuTabBtnClass() {
        return 'tab-btn' + (this.activeTab === 'menu' ? ' active' : '');
    }

    get reportsTabClass() {
        return 'tab-btn' + (this.activeTab === 'reports' ? ' active' : '');
    }

    // ── Tables ──────────────────────────────
    handleTableInput(event) {
        this.tableForm = { ...this.tableForm, [event.target.name]: event.target.value };
    }

    openNewTable() {
        this.tableForm = { ...EMPTY_TABLE };
        this.tableFormError = '';
        this.editModalTitle = 'Add Table';
        this.showEditTableModal = true;
    }

    editTable(event) {
        const id = event.currentTarget.dataset.id;
        const table = this.tables.find((row) => row.Id === id);
        if (table) {
            this.tableForm = { ...table };
            this.tableFormError = '';
            this.editModalTitle = 'Edit Table';
            this.showEditTableModal = true;
        }
    }

    closeTableModal() {
        this.showEditTableModal = false;
        this.tableForm = { ...EMPTY_TABLE };
        this.tableFormError = '';
    }

    handleTableModalKeydown(event) {
        if (event.key === 'Escape') {
            this.closeTableModal();
        }
    }

    saveTable() {
        this.tableFormError = '';
        const name = (this.tableForm.Name || '').trim();
        if (!name) {
            this.tableFormError = 'Table name is required.';
            return;
        }
        this.runSafely(async () => {
            await upsertTable({
                restaurantId: this.restaurantId,
                tableId: this.tableForm.Id,
                name,
                capacity: Number(this.tableForm.Capacity__c || 1),
                sortOrder: Number(this.tableForm.Sort_Order__c || 1),
                status: this.tableForm.Status__c
            });
            this.closeTableModal();
            await this.loadTables();
        }, 'Table saved', (message) => {
            this.tableFormError = message;
        });
    }

    updateTableStatus(event) {
        const tableId = event.currentTarget.dataset.id;
        const status = event.currentTarget.dataset.status;
        this.runSafely(async () => {
            await updateTableStatus({ tableId, status });
            await this.loadTables();
        }, 'Table status updated');
    }

    transferOrderFromSelectors() {
        this.transferError = '';
        if (!this.transferSourceTableId || !this.transferTargetTableId) {
            const message = 'Select source and target tables first.';
            this.transferError = message;
            this.toast('Error', message, 'error');
            return;
        }
        if (this.transferSourceTableId === this.transferTargetTableId) {
            const message = 'Source and target tables must be different.';
            this.transferError = message;
            this.toast('Error', message, 'error');
            return;
        }
        this.runSafely(async () => {
            await transferCurrentOrder({
                sourceTableId: this.transferSourceTableId,
                targetTableId: this.transferTargetTableId
            });
            this.transferSourceTableId = '';
            this.transferTargetTableId = '';
            await this.loadTables();
        }, 'Order transferred', (message) => {
            this.transferError = message;
        });
    }

    handleTransferSourceChange(event) {
        this.transferSourceTableId = event.target.value;
        this.transferError = '';
    }

    handleTransferTargetChange(event) {
        this.transferTargetTableId = event.target.value;
        this.transferError = '';
    }

    // ── Category ──────────────────────────────
    handleCategoryInput(event) {
        const key = event.target.name;
        const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
        this.categoryForm = { ...this.categoryForm, [key]: value };
    }

    openNewCategory() {
        this.categoryForm = { ...EMPTY_CATEGORY };
        this.categoryFormError = '';
        this.editModalTitle = 'Add Category';
        this.showEditCategoryModal = true;
    }

    editCategory(event) {
        const id = event.currentTarget.dataset.id;
        const category = this.menuCategories.find((row) => row.Id === id);
        if (category) {
            this.categoryForm = { ...category };
            this.categoryFormError = '';
            this.editModalTitle = 'Edit Category';
            this.showEditCategoryModal = true;
        }
    }

    closeCategoryModal() {
        this.showEditCategoryModal = false;
        this.categoryForm = { ...EMPTY_CATEGORY };
        this.categoryFormError = '';
    }

    handleCategoryModalKeydown(event) {
        if (event.key === 'Escape') {
            this.closeCategoryModal();
        }
    }

    saveCategory() {
        this.categoryFormError = '';
        const name = (this.categoryForm.Name || '').trim();
        if (!name) {
            this.categoryFormError = 'Category name is required.';
            return;
        }
        this.runSafely(async () => {
            await upsertMenuCategory({
                restaurantId: this.restaurantId,
                categoryId: this.categoryForm.Id,
                name,
                sortOrder: Number(this.categoryForm.Sort_Order__c || 1),
                icon: this.categoryForm.Icon__c,
                isActive: this.categoryForm.Is_Active__c
            });
            this.closeCategoryModal();
            await this.loadMenu();
        }, 'Category saved', (message) => {
            this.categoryFormError = message;
        });
    }

    removeCategory(event) {
        const id = event.currentTarget.dataset.id;
        this.categoryDeleteError = '';
        const hasItemsInCategory = this.menuItems.some((item) => item.Menu_Category__c === id);
        if (hasItemsInCategory) {
            this.categoryDeleteError = 'Cannot delete category: it still has menu items. Move items to another category or delete those items first.';
            this.toast('Cannot Delete', 'This category has menu items. Move or delete those items first.', 'error');
            return;
        }
        this.runSafely(async () => {
            await deleteMenuCategory({
                restaurantId: this.restaurantId,
                categoryId: id
            });
            if (this.selectedCategoryId === id) {
                this.selectedCategoryId = '';
            }
            this.categoryDeleteError = '';
            await this.loadMenu();
        }, 'Category deleted');
    }

    // ── Menu Item ──────────────────────────────
    handleItemInput(event) {
        const key = event.target.name;
        const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
        this.itemForm = { ...this.itemForm, [key]: value };
    }

    openNewItem() {
        this.itemForm = {
            Id: null, Name: '', Menu_Category__c: this.menuCategories[0]?.Id || '', Price__c: 0, Description__c: '',
            Is_Available__c: true, Is_Vegetarian__c: false, Sort_Order__c: 1, Image_URL__c: ''
        };
        this.itemFormError = '';
        this.editModalTitle = 'Add Menu Item';
        this.showEditItemModal = true;
    }

    editItem(event) {
        const id = event.currentTarget.dataset.id;
        const item = this.menuItems.find((row) => row.Id === id);
        if (item) {
            this.itemForm = { ...item };
            this.itemFormError = '';
            this.editModalTitle = 'Edit Menu Item';
            this.showEditItemModal = true;
        }
    }

    closeItemModal() {
        this.showEditItemModal = false;
        this.itemFormError = '';
    }

    handleItemModalKeydown(event) {
        if (event.key === 'Escape') {
            this.closeItemModal();
        }
    }

    saveItem() {
        this.itemFormError = '';
        const name = (this.itemForm.Name || '').trim();
        if (!name) {
            this.itemFormError = 'Item name is required.';
            return;
        }
        if (!this.itemForm.Menu_Category__c) {
            this.itemFormError = 'Please select a category.';
            return;
        }
        this.runSafely(async () => {
            await upsertMenuItem({
                restaurantId: this.restaurantId,
                itemId: this.itemForm.Id,
                name,
                categoryId: this.itemForm.Menu_Category__c,
                price: Number(this.itemForm.Price__c || 0),
                description: this.itemForm.Description__c,
                isAvailable: this.itemForm.Is_Available__c,
                isVegetarian: this.itemForm.Is_Vegetarian__c,
                sortOrder: Number(this.itemForm.Sort_Order__c || 1),
                imageUrl: this.itemForm.Image_URL__c
            });
            this.closeItemModal();
            await this.loadMenu();
        }, 'Menu item saved', (message) => {
            this.itemFormError = message;
        });
    }

    removeItem(event) {
        const id = event.currentTarget.dataset.id;
        this.runSafely(async () => {
            await deleteMenuItem({ menuItemId: id });
            await this.loadMenu();
        }, 'Menu item deleted');
    }

    handleInlineItemChange(event) {
        const id = event.currentTarget.dataset.id;
        const fieldName = event.target.name;
        const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
        this.menuItems = this.menuItems.map((item) =>
            item.Id === id ? { ...item, [fieldName]: value } : item
        );
    }

    saveInlineItem(event) {
        const id = event.currentTarget.dataset.id;
        const item = this.menuItems.find((row) => row.Id === id);
        if (!item) {
            return;
        }
        this.runSafely(async () => {
            await upsertMenuItem({
                restaurantId: this.restaurantId,
                itemId: id,
                name: item.Name,
                categoryId: item.Menu_Category__c,
                price: Number(item.Price__c),
                description: item.Description__c || '',
                isAvailable: item.Is_Available__c,
                isVegetarian: item.Is_Vegetarian__c,
                sortOrder: Number(item.Sort_Order__c || 1),
                imageUrl: item.Image_URL__c || ''
            });
            await this.loadMenu();
        }, 'Menu item updated');
    }

    toggleItemAvailability(event) {
        const id = event.currentTarget.dataset.id;
        const item = this.menuItems.find((row) => row.Id === id);
        if (!item) return;
        const newAvailability = !item.Is_Available__c;
        this.runSafely(async () => {
            await upsertMenuItem({
                restaurantId: this.restaurantId,
                itemId: id,
                name: item.Name,
                categoryId: item.Menu_Category__c,
                price: Number(item.Price__c),
                description: item.Description__c || '',
                isAvailable: newAvailability,
                isVegetarian: item.Is_Vegetarian__c,
                sortOrder: Number(item.Sort_Order__c || 1),
                imageUrl: item.Image_URL__c || ''
            });
            await this.loadMenu();
        }, newAvailability ? 'Item marked available' : 'Item marked sold out');
    }

    markAllSoldOut() {
        this.runSafely(async () => {
            await bulkUpdateAvailability({
                restaurantId: this.restaurantId,
                itemIds: [],
                isAvailable: false
            });
            await this.loadMenu();
        }, 'All items marked sold out');
    }

    markAllAvailable() {
        this.runSafely(async () => {
            await bulkUpdateAvailability({
                restaurantId: this.restaurantId,
                itemIds: [],
                isAvailable: true
            });
            await this.loadMenu();
        }, 'All items marked available');
    }

    markCategorySoldOut() {
        if (!this.selectedCategoryId) {
            this.toast('Warning', 'Select a category first.', 'warning');
            return;
        }
        this.runSafely(async () => {
            await setCategoryAvailability({
                restaurantId: this.restaurantId,
                categoryId: this.selectedCategoryId,
                isAvailable: false
            });
            await this.loadMenu();
        }, 'Category marked sold out');
    }

    handleCategoryFilter(event) {
        this.selectedCategoryId = event.target.value;
    }

    // ── Reports ──────────────────────────────
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

    // ── Getters ──────────────────────────────
    get categoryOptions() {
        return this.menuCategories.map((cat) => ({ label: cat.Name, value: cat.Id }));
    }

    get tabOptions() {
        return [
            { label: 'Tables', value: 'tables' },
            { label: 'Menu', value: 'menu' },
            { label: 'Statistics', value: 'reports' }
        ];
    }

    get tableStatusOptions() {
        return [
            { label: 'Available', value: 'Available' },
            { label: 'Reserved', value: 'Reserved' },
            { label: 'Occupied', value: 'Occupied' },
            { label: 'Out of Service', value: 'Out of Service' }
        ];
    }

    get isTablesTab() { return this.activeTab === 'tables'; }
    get isMenuTab() { return this.activeTab === 'menu'; }
    get isReportsTab() { return this.activeTab === 'reports'; }

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

    get menuItemsDisplay() {
        return this.menuItems.map((item, idx) => ({
            ...item,
            itemNumber: idx + 1,
            categoryName: this.menuCategories.find((cat) => cat.Id === item.Menu_Category__c)?.Name || '-',
            availabilityLabel: item.Is_Available__c ? 'Available' : 'Sold Out',
            availabilityClass: item.Is_Available__c ? 'availability-pill available' : 'availability-pill sold-out',
            toggleClass: item.Is_Available__c ? 'toggle-track toggle-on' : 'toggle-track toggle-off'
        }));
    }

    get tablesDisplay() {
        return this.tables.map((table, idx) => ({
            ...table,
            tableNumber: idx + 1
        }));
    }

    get pagedTablesDisplay() {
        return this.paginateRows(this.tablesDisplay, this.tablesPage);
    }

    get pagedMenuItemsDisplay() {
        return this.paginateRows(this.menuItemsDisplay, this.menuItemsPage);
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

    paginateRows(rows, page, pageSize = PAGE_SIZE) {
        const safeRows = rows || [];
        const start = (page - 1) * pageSize;
        return safeRows.slice(start, start + pageSize);
    }

    get tablesTotalPages() {
        return Math.max(1, Math.ceil((this.tablesDisplay.length || 0) / PAGE_SIZE));
    }

    get menuItemsTotalPages() {
        return Math.max(1, Math.ceil((this.menuItemsDisplay.length || 0) / PAGE_SIZE));
    }

    get tablesPageLabel() {
        return `Page ${this.tablesPage} of ${this.tablesTotalPages}`;
    }

    get menuItemsPageLabel() {
        return `Page ${this.menuItemsPage} of ${this.menuItemsTotalPages}`;
    }

    get orderDetailsPageLabel() {
        return `Page ${this.orderDetailsPage} of ${this.orderDetailsTotalPages}`;
    }

    get disableTablesPrev() {
        return this.tablesPage <= 1;
    }

    get disableTablesNext() {
        return this.tablesPage >= this.tablesTotalPages;
    }

    get disableMenuPrev() {
        return this.menuItemsPage <= 1;
    }

    get disableMenuNext() {
        return this.menuItemsPage >= this.menuItemsTotalPages;
    }

    get disableOrderPrev() {
        return this.orderDetailsPage <= 1;
    }

    get disableOrderNext() {
        return this.orderDetailsPage >= this.orderDetailsTotalPages;
    }

    get showTablesPagination() {
        return this.tablesDisplay.length > PAGE_SIZE;
    }

    get showMenuPagination() {
        return this.menuItemsDisplay.length > PAGE_SIZE;
    }

    handleTablesPrev() {
        this.tablesPage = Math.max(1, this.tablesPage - 1);
    }

    handleTablesNext() {
        this.tablesPage = Math.min(this.tablesTotalPages, this.tablesPage + 1);
    }

    handleMenuPrev() {
        this.menuItemsPage = Math.max(1, this.menuItemsPage - 1);
    }

    handleMenuNext() {
        this.menuItemsPage = Math.min(this.menuItemsTotalPages, this.menuItemsPage + 1);
    }

    handleOrderPrev() {
        this.orderDetailsPage = Math.max(1, this.orderDetailsPage - 1);
    }

    handleOrderNext() {
        this.orderDetailsPage = Math.min(this.orderDetailsTotalPages, this.orderDetailsPage + 1);
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

    handleOrderTableFilterChange(event) {
        const key = event.target.name;
        const value = event.target.value || '';
        this.orderTableFilters = { ...this.orderTableFilters, [key]: value };
        this.orderDetailsPage = 1;
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

    get showOrderPagination() {
        return this.filteredOrderDetails.length > PAGE_SIZE;
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

    openOrderDetailsModal(event) {
        const orderId = event.currentTarget.dataset.id;
        const orderDetail = this.reportData.orderDetails.find((row) => row.orderId === orderId);
        if (!orderDetail) {
            return;
        }
        this.selectedOrderDetail = orderDetail;
        this.showOrderDetailsModal = true;
    }

    closeOrderDetailsModal() {
        this.showOrderDetailsModal = false;
        this.selectedOrderDetail = null;
    }

    handleOrderDetailsModalKeydown(event) {
        if (event.key === 'Escape') {
            this.closeOrderDetailsModal();
        }
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

    get isCustomDatePreset() {
        return this.reportFilters.preset === 'custom';
    }

    get isPresetManagedDates() {
        return this.reportFilters.preset !== 'custom';
    }

    get occupiedTableOptions() {
        return this.tables
            .filter((t) => t.Current_Order__c)
            .map((t) => ({ label: `${t.Name} (${t.Status__c})`, value: t.Id }));
    }

    get availableTableOptions() {
        return this.tables
            .filter((t) => !t.Current_Order__c && t.Status__c === 'Available')
            .map((t) => ({ label: `${t.Name} (${t.Status__c})`, value: t.Id }));
    }

    get isEditingTable() {
        return this.tableForm.Id !== null;
    }

    get isEditingCategory() {
        return this.categoryForm.Id !== null;
    }

    get isEditingItem() {
        return this.itemForm.Id !== null;
    }

    stopPropagation(event) {
        event.stopPropagation();
    }
}
