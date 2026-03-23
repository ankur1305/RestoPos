import { LightningElement, api, track, wire } from 'lwc';
import getMenuCategories from '@salesforce/apex/MenuController.getMenuCategories';
import getMenuItems from '@salesforce/apex/MenuController.getMenuItems';
import searchMenuItems from '@salesforce/apex/MenuController.searchMenuItems';

const ALL_CATEGORY_ID = 'ALL';
const PAGE_SIZE = 10;

export default class PosMenuBrowser extends LightningElement {
    @api restaurantId;
    @api currencyCode;
    @track categories = [];
    @track allItems = [];
    @track selectedCategoryId = ALL_CATEGORY_ID;
    @track searchTerm = '';
    @track visibleCount = PAGE_SIZE;
    isLoading = false;

    @wire(getMenuCategories, { restaurantId: '$restaurantId' })
    wiredCategories({ data }) {
        if (data) {
            this.categories = data;
            this.loadItems();
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
            this.visibleCount = PAGE_SIZE;
        } catch (err) {
            console.error('Load items error:', err);
        } finally {
            this.isLoading = false;
        }
    }

    handleCategoryClick(event) {
        this.selectedCategoryId = event.currentTarget.dataset.id;
        this.searchTerm = '';
        this.loadItems();
    }

    async handleSearch(event) {
        this.searchTerm = event.target.value;
        if (this.searchTerm.length >= 2) {
            try {
                this.allItems = await searchMenuItems({
                    restaurantId: this.restaurantId,
                    searchTerm: this.searchTerm
                });
                this.selectedCategoryId = '';
                this.visibleCount = PAGE_SIZE;
            } catch (err) {
                console.error('Search error:', err);
            }
        } else if (this.searchTerm.length === 0) {
            this.selectedCategoryId = ALL_CATEGORY_ID;
            this.loadItems();
        }
    }

    handleAddItem(event) {
        const menuItemId = event.currentTarget.dataset.id;
        this.dispatchEvent(new CustomEvent('additem', {
            detail: { menuItemId, quantity: 1, notes: '' },
            bubbles: true,
            composed: true
        }));
    }

    handleLoadMore() {
        this.visibleCount += PAGE_SIZE;
    }

    get items() {
        return this.allItems.slice(0, this.visibleCount);
    }

    get hasMoreItems() {
        return this.allItems.length > this.visibleCount;
    }

    get remainingCount() {
        const remaining = this.allItems.length - this.visibleCount;
        return remaining > PAGE_SIZE ? PAGE_SIZE : remaining;
    }

    get loadMoreLabel() {
        return 'Show ' + this.remainingCount + ' more';
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
}
