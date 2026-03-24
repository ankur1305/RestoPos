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

const EMPTY_TABLE = { Id: null, Name: '', Capacity__c: 4, Sort_Order__c: 1, Status__c: 'Available' };
const EMPTY_CATEGORY = { Id: null, Name: '', Sort_Order__c: 1, Icon__c: '', Is_Active__c: true };

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
    @track reportFilters = { startDate: null, endDate: null };
    @track transferSourceTableId = '';
    @track transferTargetTableId = '';
    @track categoryDeleteError = '';
    @track transferError = '';
    @track tableFormError = '';
    @track categoryFormError = '';
    @track itemFormError = '';

    // Modal state
    @track showEditTableModal = false;
    @track showEditCategoryModal = false;
    @track showEditItemModal = false;
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
        this.reportFilters = { ...this.reportFilters, [event.target.name]: event.target.value || null };
    }

    applyReportFilter() {
        this.runSafely(async () => {
            await this.loadReport();
        });
    }

    // ── Getters ──────────────────────────────
    get categoryOptions() {
        return this.menuCategories.map((cat) => ({ label: cat.Name, value: cat.Id }));
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

    get isTablesTab() { return this.activeTab === 'tables'; }
    get isMenuTab() { return this.activeTab === 'menu'; }
    get isReportsTab() { return this.activeTab === 'reports'; }

    get emptyReport() {
        return { orderCount: 0, revenue: 0, discountAmount: 0, avgOrderValue: 0, topItems: [] };
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

    get reportData() {
        const data = this.report || this.emptyReport;
        const avgValue = Number(data.avgOrderValue || 0);
        return {
            ...data,
            avgOrderValue: avgValue.toFixed(2),
            topItems: (data.topItems || []).map((item, idx) => ({
                ...item,
                rank: idx + 1
            }))
        };
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
