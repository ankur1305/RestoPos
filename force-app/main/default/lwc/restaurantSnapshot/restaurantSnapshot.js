import { LightningElement, api, track } from 'lwc';
import getSnapshot from '@salesforce/apex/RestaurantSnapshotController.getSnapshot';

export default class RestaurantSnapshot extends LightningElement {
    @api recordId;
    @track data;
    isLoading = true;
    hasError = false;

    connectedCallback() {
        this.loadSnapshot();
    }

    async loadSnapshot() {
        try {
            this.isLoading = true;
            this.data = await getSnapshot({ restaurantId: this.recordId });
            this.hasError = false;
        } catch (err) {
            this.hasError = true;
        } finally {
            this.isLoading = false;
        }
    }

    handleRefresh() {
        this.loadSnapshot();
    }

    get totalTables() { return this.data?.totalTables || 0; }
    get availableTables() { return this.data?.availableTables || 0; }
    get occupiedTables() { return this.data?.occupiedTables || 0; }
    get reservedTables() { return this.data?.reservedTables || 0; }
    get totalCategories() { return this.data?.totalCategories || 0; }
    get totalMenuItems() { return this.data?.totalMenuItems || 0; }
    get activeOrders() { return this.data?.activeOrders || 0; }
    get activeOrdersTotal() { return '₹' + (this.data?.activeOrdersTotal || 0); }
    get todayOrders() { return this.data?.todayOrders || 0; }
    get todayRevenue() { return '₹' + (this.data?.todayRevenue || 0); }
    get totalOrders() { return this.data?.totalOrders || 0; }
    get hasActiveOrders() { return this.activeOrders > 0; }
}
