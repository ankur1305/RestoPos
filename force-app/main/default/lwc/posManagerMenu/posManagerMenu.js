import { LightningElement, api, track } from 'lwc';
import { notify, extractErrorMessage, createFocusTrap } from 'c/posUtils';
import getManagerMenuData from '@salesforce/apex/MenuController.getManagerMenuData';
import upsertMenuCategory from '@salesforce/apex/MenuController.upsertMenuCategory';
import deleteMenuCategory from '@salesforce/apex/MenuController.deleteMenuCategory';
import upsertMenuItem from '@salesforce/apex/MenuController.upsertMenuItem';
import deleteMenuItem from '@salesforce/apex/MenuController.deleteMenuItem';
import bulkUpdateAvailability from '@salesforce/apex/MenuController.bulkUpdateAvailability';
import setCategoryAvailability from '@salesforce/apex/MenuController.setCategoryAvailability';

const EMPTY_CATEGORY = { Id: null, Name: '', Icon__c: '', Is_Active__c: true };
const PAGE_SIZE = 10;

export default class PosManagerMenu extends LightningElement {
    @api restaurantId;

    @track isLoading = false;
    @track menuSubTab = 'categories';
    @track menuCategories = [];
    @track menuItems = [];
    @track selectedCategoryId = '';
    @track categoryForm = { ...EMPTY_CATEGORY };
    @track itemForm = {
        Id: null, Name: '', Menu_Category__c: '', Price__c: 0, Description__c: '',
        Is_Available__c: true, Is_Vegetarian__c: false, Image_URL__c: ''
    };
    @track categoryDeleteError = '';
    @track categoryFormError = '';
    @track itemFormError = '';
    @track menuItemsPage = 1;
    @track showEditCategoryModal = false;
    @track showEditItemModal = false;
    @track editModalTitle = '';

    _modalKeyHandler;
    _modalFocusPending = false;

    connectedCallback() {
        this.loadMenu();
    }

    disconnectedCallback() {
        if (this._modalKeyHandler) {
            window.removeEventListener('keydown', this._modalKeyHandler);
            this._modalKeyHandler = null;
        }
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

    handleMenuSubTabChange(event) {
        this.menuSubTab = event.currentTarget.dataset.subtab;
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
        this.prepareModalFocus();
        this._attachFocusTrap();
    }

    editCategory(event) {
        const id = event.currentTarget.dataset.id;
        const category = this.menuCategories.find((row) => row.Id === id);
        if (category) {
            this.categoryForm = { ...category };
            this.categoryFormError = '';
            this.editModalTitle = 'Edit Category';
            this.showEditCategoryModal = true;
            this.prepareModalFocus();
            this._attachFocusTrap();
        }
    }

    closeCategoryModal() {
        this.showEditCategoryModal = false;
        this.categoryForm = { ...EMPTY_CATEGORY };
        this.categoryFormError = '';
        this._detachFocusTrap();
        this.teardownModalHandlerIfIdle();
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
                sortOrder: null,
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
            Is_Available__c: true, Is_Vegetarian__c: false, Image_URL__c: ''
        };
        this.itemFormError = '';
        this.editModalTitle = 'Add Menu Item';
        this.showEditItemModal = true;
        this.prepareModalFocus();
        this._attachFocusTrap();
    }

    editItem(event) {
        const id = event.currentTarget.dataset.id;
        const item = this.menuItems.find((row) => row.Id === id);
        if (item) {
            this.itemForm = { ...item };
            this.itemFormError = '';
            this.editModalTitle = 'Edit Menu Item';
            this.showEditItemModal = true;
            this.prepareModalFocus();
            this._attachFocusTrap();
        }
    }

    closeItemModal() {
        this.showEditItemModal = false;
        this.itemFormError = '';
        this._detachFocusTrap();
        this.teardownModalHandlerIfIdle();
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
                sortOrder: null,
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
                sortOrder: null,
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
                sortOrder: null,
                imageUrl: item.Image_URL__c || ''
            });
            await this.loadMenu();
        }, newAvailability ? 'Item marked available' : 'Item marked sold out');
    }

    // ── Bulk ──────────────────────────────
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

    // ── Getters ──────────────────────────────
    get menuCategoriesTabClass() {
        return 'subtab-btn' + (this.menuSubTab === 'categories' ? ' active' : '');
    }

    get menuBulkTabClass() {
        return 'subtab-btn' + (this.menuSubTab === 'bulk' ? ' active' : '');
    }

    get menuItemsTabClass() {
        return 'subtab-btn' + (this.menuSubTab === 'items' ? ' active' : '');
    }

    get isMenuCategoriesSubTab() {
        return this.menuSubTab === 'categories';
    }

    get isMenuBulkSubTab() {
        return this.menuSubTab === 'bulk';
    }

    get isMenuItemsSubTab() {
        return this.menuSubTab === 'items';
    }

    get categoryOptions() {
        return this.menuCategories.map((cat) => ({ label: cat.Name, value: cat.Id }));
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

    get pagedMenuItemsDisplay() {
        return this.paginateRows(this.menuItemsDisplay, this.menuItemsPage);
    }

    get menuItemsTotalPages() {
        return Math.max(1, Math.ceil((this.menuItemsDisplay.length || 0) / PAGE_SIZE));
    }

    get menuItemsPageLabel() {
        return `Page ${this.menuItemsPage} of ${this.menuItemsTotalPages}`;
    }

    get disableMenuPrev() {
        return this.menuItemsPage <= 1;
    }

    get disableMenuNext() {
        return this.menuItemsPage >= this.menuItemsTotalPages;
    }

    get showMenuPagination() {
        return this.menuItemsDisplay.length > PAGE_SIZE;
    }

    get isEditingCategory() {
        return this.categoryForm.Id !== null;
    }

    get isEditingItem() {
        return this.itemForm.Id !== null;
    }

    // ── Pagination ──────────────────────────────
    handleMenuPrev() {
        this.menuItemsPage = Math.max(1, this.menuItemsPage - 1);
    }

    handleMenuNext() {
        this.menuItemsPage = Math.min(this.menuItemsTotalPages, this.menuItemsPage + 1);
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

    clearInlineMessage(event) {
        const target = event.currentTarget?.dataset?.target;
        if (!target) {
            return;
        }
        this[target] = '';
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
            if (this.showEditItemModal) {
                this.closeItemModal();
            } else if (this.showEditCategoryModal) {
                this.closeCategoryModal();
            }
        };
        window.addEventListener('keydown', this._modalKeyHandler);
    }

    teardownModalHandlerIfIdle() {
        if (this.showEditItemModal || this.showEditCategoryModal) {
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
