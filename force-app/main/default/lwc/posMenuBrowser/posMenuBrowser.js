import { LightningElement, api, track } from 'lwc';
import getMenuCategories from '@salesforce/apex/MenuController.getMenuCategories';
import getMenuItems from '@salesforce/apex/MenuController.getMenuItems';
import searchMenuItems from '@salesforce/apex/MenuController.searchMenuItems';

const ALL_CATEGORY_ID = 'ALL';
const SEARCH_DEBOUNCE_MS = 280;

export default class PosMenuBrowser extends LightningElement {
    @api restaurantId;
    @api currencyCode;

    _cartItemQuantities = {};

    @api
    get cartItemQuantities() {
        return this._cartItemQuantities;
    }
    set cartItemQuantities(value) {
        this._cartItemQuantities = value || {};
        if (this.allItems && this.allItems.length > 0) {
            this.decoratedItems = this.decorateItems(this.allItems);
        }
    }

    @track categories = [];
    @track allItems = [];
    @track decoratedItems = [];
    @track selectedCategoryId = ALL_CATEGORY_ID;
    @track searchTerm = '';
    isLoading = false;
    searchDebounceId;

    connectedCallback() {
        this.loadMenuData();
    }

    @api
    async refreshMenu() {
        await this.loadMenuData();
    }

    async loadMenuData() {
        if (!this.restaurantId) {
            return;
        }
        this.isLoading = true;
        try {
            this.categories = await getMenuCategories({ restaurantId: this.restaurantId });
            if (
                this.selectedCategoryId !== ALL_CATEGORY_ID
                && this.selectedCategoryId
                && !this.categories.some((category) => category.Id === this.selectedCategoryId)
            ) {
                this.selectedCategoryId = ALL_CATEGORY_ID;
            }
            await this.loadItems();
        } catch (err) {
            // eslint-disable-next-line no-console
            console.error('Load menu data error:', err);
        } finally {
            this.isLoading = false;
        }
    }

    async loadItems() {
        try {
            this.isLoading = true;
            const categoryId = this.selectedCategoryId === ALL_CATEGORY_ID ? null : this.selectedCategoryId;
            this.allItems = await getMenuItems({
                restaurantId: this.restaurantId,
                categoryId: categoryId
            });
            this.decoratedItems = this.decorateItems(this.allItems);
        } catch (err) {
            console.error('Load items error:', err);
        } finally {
            this.isLoading = false;
        }
    }

    handleCategoryClick(event) {
        if (this.searchDebounceId) {
            window.clearTimeout(this.searchDebounceId);
            this.searchDebounceId = undefined;
        }
        this.selectedCategoryId = event.currentTarget.dataset.id;
        this.searchTerm = '';
        this.loadItems();
    }

    handleSearch(event) {
        this.searchTerm = event.target.value;
        if (this.searchDebounceId) {
            window.clearTimeout(this.searchDebounceId);
            this.searchDebounceId = undefined;
        }
        if (this.searchTerm.length === 0) {
            this.selectedCategoryId = ALL_CATEGORY_ID;
            this.loadItems();
            return;
        }
        if (this.searchTerm.length < 2) {
            return;
        }
        this.searchDebounceId = window.setTimeout(() => {
            this.searchDebounceId = undefined;
            this.runSearch();
        }, SEARCH_DEBOUNCE_MS);
    }

    async runSearch() {
        if (this.searchTerm.length < 2) {
            return;
        }
        try {
            this.allItems = await searchMenuItems({
                restaurantId: this.restaurantId,
                searchTerm: this.searchTerm
            });
            this.decoratedItems = this.decorateItems(this.allItems);
            this.selectedCategoryId = '';
        } catch (err) {
            console.error('Search error:', err);
        }
    }

    disconnectedCallback() {
        if (this.searchDebounceId) {
            window.clearTimeout(this.searchDebounceId);
        }
    }

    handleAddItem(event) {
        if (event.currentTarget.dataset.available === 'false') {
            return;
        }
        const menuItemId = event.currentTarget.dataset.id;
        this.dispatchEvent(new CustomEvent('additem', {
            detail: { menuItemId, quantity: 1, notes: '' },
            bubbles: true,
            composed: true
        }));
    }

    handleIncrementItem(event) {
        event.stopPropagation();
        const menuItemId = event.currentTarget.dataset.id;
        this.dispatchEvent(new CustomEvent('adjustitemqty', {
            detail: { menuItemId, delta: 1 },
            bubbles: true,
            composed: true
        }));
    }

    handleDecrementItem(event) {
        event.stopPropagation();
        const menuItemId = event.currentTarget.dataset.id;
        this.dispatchEvent(new CustomEvent('adjustitemqty', {
            detail: { menuItemId, delta: -1 },
            bubbles: true,
            composed: true
        }));
    }

    get items() {
        return this.decoratedItems;
    }

    get categoriesWithClass() {
        const allTab = {
            Id: ALL_CATEGORY_ID,
            Name: 'All',
            tabClass: 'category-tab' + (this.selectedCategoryId === ALL_CATEGORY_ID ? ' active' : '')
        };
        const catTabs = this.categories.map(c => ({
            ...c,
            tabClass: 'category-tab' + (c.Id === this.selectedCategoryId ? ' active' : '')
        }));
        return [allTab, ...catTabs];
    }

    get hasItems() {
        return this.items && this.items.length > 0;
    }

    decorateItems(rawItems) {
        return (rawItems || []).map((item) => ({
            ...item,
            itemClass: 'menu-item-row' + (item.Is_Available__c ? '' : ' sold-out'),
            isDisabled: !item.Is_Available__c,
            inCartQty: Number(this.cartItemQuantities?.[item.Id] || 0)
        }));
    }

}
