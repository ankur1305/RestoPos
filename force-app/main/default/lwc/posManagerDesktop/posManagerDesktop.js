import { LightningElement, api, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getManagerTables from '@salesforce/apex/TableController.getManagerTables';
import upsertTable from '@salesforce/apex/TableController.upsertTable';
import updateTableStatus from '@salesforce/apex/TableController.updateTableStatus';
import transferCurrentOrder from '@salesforce/apex/TableController.transferCurrentOrder';
import getManagerMenuData from '@salesforce/apex/MenuController.getManagerMenuData';
import upsertMenuCategory from '@salesforce/apex/MenuController.upsertMenuCategory';
import upsertMenuItem from '@salesforce/apex/MenuController.upsertMenuItem';
import deleteMenuItem from '@salesforce/apex/MenuController.deleteMenuItem';
import bulkUpdateAvailability from '@salesforce/apex/MenuController.bulkUpdateAvailability';
import setCategoryAvailability from '@salesforce/apex/MenuController.setCategoryAvailability';
import getManagerReport from '@salesforce/apex/ManagerReportController.getManagerReport';

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
    @track tableForm = { Id: null, Name: '', Capacity__c: 4, Sort_Order__c: 1, Status__c: 'Available' };
    @track categoryForm = { Id: null, Name: '', Sort_Order__c: 1, Icon__c: '', Is_Active__c: true };
    @track itemForm = {
        Id: null, Name: '', Menu_Category__c: '', Price__c: 0, Description__c: '',
        Is_Available__c: true, Is_Vegetarian__c: false, Sort_Order__c: 1, Image_URL__c: ''
    };
    @track reportFilters = { startDate: null, endDate: null };
    @track transferSourceTableId = '';
    @track transferTargetTableId = '';

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
    }

    async loadMenu() {
        const data = await getManagerMenuData({ restaurantId: this.restaurantId });
        this.menuCategories = data.categories || [];
        this.menuItems = data.items || [];
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
            endDate: this.reportFilters.endDate
        });
        if (!this.report) {
            this.report = this.emptyReport;
        }
    }

    async runSafely(action, successMessage) {
        try {
            this.isLoading = true;
            await action();
            if (successMessage) {
                this.toast('Success', successMessage, 'success');
            }
        } catch (error) {
            this.toast('Error', error?.body?.message || 'Action failed', 'error');
        } finally {
            this.isLoading = false;
        }
    }

    toast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }

    handleTabChange(event) {
        this.activeTab = event.target.value;
    }

    // Tables
    handleTableInput(event) {
        this.tableForm = { ...this.tableForm, [event.target.name]: event.target.value };
    }

    editTable(event) {
        const table = this.tables.find((row) => row.Id === event.target.dataset.id);
        if (table) {
            this.tableForm = { ...table };
        }
    }

    resetTableForm() {
        this.tableForm = { Id: null, Name: '', Capacity__c: 4, Sort_Order__c: 1, Status__c: 'Available' };
    }

    saveTable() {
        this.runSafely(async () => {
            await upsertTable({
                restaurantId: this.restaurantId,
                tableId: this.tableForm.Id,
                name: this.tableForm.Name,
                capacity: Number(this.tableForm.Capacity__c),
                sortOrder: Number(this.tableForm.Sort_Order__c),
                status: this.tableForm.Status__c
            });
            await this.loadTables();
            this.resetTableForm();
        }, 'Table saved');
    }

    updateTableStatus(event) {
        const tableId = event.target.dataset.id;
        const status = event.target.dataset.status;
        this.runSafely(async () => {
            await updateTableStatus({ tableId, status });
            await this.loadTables();
        }, 'Table status updated');
    }

    transferOrder(event) {
        const sourceTableId = event.target.dataset.source;
        const targetTableId = event.target.dataset.target;
        this.runSafely(async () => {
            await transferCurrentOrder({ sourceTableId, targetTableId });
            await this.loadTables();
        }, 'Order transferred');
    }

    transferOrderFromSelectors() {
        if (!this.transferSourceTableId || !this.transferTargetTableId) {
            this.toast('Error', 'Select source and target tables first.', 'error');
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
        }, 'Order transferred');
    }

    handleTransferSourceChange(event) {
        this.transferSourceTableId = event.target.value;
    }

    handleTransferTargetChange(event) {
        this.transferTargetTableId = event.target.value;
    }

    // Menu / category
    handleCategoryInput(event) {
        const key = event.target.name;
        const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
        this.categoryForm = { ...this.categoryForm, [key]: value };
    }

    saveCategory() {
        this.runSafely(async () => {
            await upsertMenuCategory({
                restaurantId: this.restaurantId,
                categoryId: this.categoryForm.Id,
                name: this.categoryForm.Name,
                sortOrder: Number(this.categoryForm.Sort_Order__c),
                icon: this.categoryForm.Icon__c,
                isActive: this.categoryForm.Is_Active__c
            });
            this.categoryForm = { Id: null, Name: '', Sort_Order__c: 1, Icon__c: '', Is_Active__c: true };
            await this.loadMenu();
        }, 'Category saved');
    }

    editCategory(event) {
        const category = this.menuCategories.find((row) => row.Id === event.target.dataset.id);
        if (category) {
            this.categoryForm = { ...category };
        }
    }

    handleItemInput(event) {
        const key = event.target.name;
        const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
        this.itemForm = { ...this.itemForm, [key]: value };
    }

    editItem(event) {
        const item = this.menuItems.find((row) => row.Id === event.target.dataset.id);
        if (item) {
            this.itemForm = { ...item };
        }
    }

    saveItem() {
        this.runSafely(async () => {
            await upsertMenuItem({
                restaurantId: this.restaurantId,
                itemId: this.itemForm.Id,
                name: this.itemForm.Name,
                categoryId: this.itemForm.Menu_Category__c,
                price: Number(this.itemForm.Price__c),
                description: this.itemForm.Description__c,
                isAvailable: this.itemForm.Is_Available__c,
                isVegetarian: this.itemForm.Is_Vegetarian__c,
                sortOrder: Number(this.itemForm.Sort_Order__c),
                imageUrl: this.itemForm.Image_URL__c
            });
            this.itemForm = {
                Id: null, Name: '', Menu_Category__c: this.menuCategories[0]?.Id || '', Price__c: 0, Description__c: '',
                Is_Available__c: true, Is_Vegetarian__c: false, Sort_Order__c: 1, Image_URL__c: ''
            };
            await this.loadMenu();
        }, 'Menu item saved');
    }

    removeItem(event) {
        this.runSafely(async () => {
            await deleteMenuItem({ menuItemId: event.target.dataset.id });
            await this.loadMenu();
        }, 'Menu item deleted');
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

    // Reports
    handleFilterChange(event) {
        this.reportFilters = { ...this.reportFilters, [event.target.name]: event.target.value || null };
    }

    applyReportFilter() {
        this.runSafely(async () => {
            await this.loadReport();
        });
    }

    get categoryOptions() {
        return this.menuCategories.map((cat) => ({ label: cat.Name, value: cat.Id }));
    }

    get filteredItems() {
        if (!this.selectedCategoryId) {
            return this.menuItems;
        }
        return this.menuItems.filter((item) => item.Menu_Category__c === this.selectedCategoryId);
    }

    get tabOptions() {
        return [
            { label: 'Tables', value: 'tables' },
            { label: 'Menu', value: 'menu' },
            { label: 'Reports', value: 'reports' }
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

    get isTablesTab() {
        return this.activeTab === 'tables';
    }

    get isMenuTab() {
        return this.activeTab === 'menu';
    }

    get isReportsTab() {
        return this.activeTab === 'reports';
    }

    get emptyReport() {
        return {
            orderCount: 0,
            revenue: 0,
            discountAmount: 0,
            avgOrderValue: 0,
            topItems: []
        };
    }

    get reportData() {
        return this.report || this.emptyReport;
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
}
