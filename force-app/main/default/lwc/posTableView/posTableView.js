import { LightningElement, api, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getTables from '@salesforce/apex/TableController.getTables';
import occupyTable from '@salesforce/apex/TableController.occupyTable';
import updateTableStatus from '@salesforce/apex/TableController.updateTableStatus';
import createOrder from '@salesforce/apex/OrderController.createOrder';

export default class PosTableView extends LightningElement {
    @api restaurantId;
    @track tables = [];
    @track selectedTable = null;
    @track showActions = false;
    @track actionError = '';
    @track autoRefreshPeriod = 0; // in milliseconds, 0 = off
    @track isDesktop = false;
    @track nextRefreshIn = 0; // countdown seconds

    isLoading = false;
    autoRefreshTimerId;
    countDownTimerId;

    connectedCallback() {
        this.isDesktop = window.matchMedia('(min-width: 1024px)').matches;
        this.resizeHandler = this.handleWindowResize.bind(this);
        window.addEventListener('resize', this.resizeHandler);

        this._keyHandler = (e) => {
            if (e.key === 'Escape' && this.showActions) {
                this.handleCloseActions();
            }
        };
        window.addEventListener('keydown', this._keyHandler);

        if (this.isDesktop) {
            const savedPeriod = parseInt(localStorage.getItem('posTableAutoRefresh'), 10);
            if (!Number.isNaN(savedPeriod)) {
                this.autoRefreshPeriod = savedPeriod;
            } else {
                this.autoRefreshPeriod = 15000; // default 15 seconds on desktop
            }
            this.startAutoRefresh();
        } else {
            this.autoRefreshPeriod = 0;
        }

        this.loadTables(false);
    }

    /**
     * @param {boolean} silent When true (e.g. auto-refresh), skip isLoading to avoid UI churn.
     */
    async loadTables(silent = false) {
        try {
            if (!silent) {
                this.isLoading = true;
            }
            const data = await getTables({ restaurantId: this.restaurantId });
            this.tables = data.map(t => ({
                ...t,
                cssClass: 'table-card status-' + (t.Status__c || 'Available').toLowerCase().replace(/\s+/g, '-'),
                statusLabel: t.Status__c,
                hasOrder: !!t.Current_Order__c,
                orderName: t.Current_Order__r ? t.Current_Order__r.Name : '',
                orderTotal: t.Current_Order__r ? t.Current_Order__r.Total_Amount__c : 0,
                itemCount: t.Current_Order__r ? t.Current_Order__r.Item_Count__c : 0
            }));
        } catch (err) {
            console.error('Load tables error:', err);
        } finally {
            if (!silent) {
                this.isLoading = false;
            }
        }
    }

    handleTableClick(event) {
        const tableId = event.currentTarget.dataset.id;
        const table = this.tables.find(t => t.Id === tableId);
        if (!table) return;

        if (table.Status__c === 'Occupied' && table.hasOrder) {
            this.dispatchEvent(new CustomEvent('tableselect', {
                detail: { tableId: table.Id, orderId: table.Current_Order__c }
            }));
            return;
        }

        this.selectedTable = table;
        this.showActions = true;
        this.actionError = '';
    }

    handleCloseActions() {
        this.showActions = false;
        this.selectedTable = null;
        this.actionError = '';
    }

    stopPropagation(event) {
        event.stopPropagation();
    }

    async handleOccupyOnly() {
        try {
            this.isLoading = true;
            await occupyTable({ tableId: this.selectedTable.Id });
            this.handleCloseActions();
            await this.loadTables();
        } catch (err) {
            this.actionError = err.body?.message || 'Failed to occupy table';
        } finally {
            this.isLoading = false;
        }
    }

    async handleOccupyAndOrder() {
        try {
            this.isLoading = true;
            if (this.selectedTable.Status__c === 'Available') {
                await occupyTable({ tableId: this.selectedTable.Id });
            }
            const order = await createOrder({
                restaurantId: this.restaurantId,
                tableId: this.selectedTable.Id,
                customerId: null
            });
            this.showActions = false;
            this.dispatchEvent(new CustomEvent('tableselect', {
                detail: { tableId: this.selectedTable.Id, orderId: order.Id }
            }));
        } catch (err) {
            this.actionError = err.body?.message || 'Failed to start order';
        } finally {
            this.isLoading = false;
        }
    }

    async handleStartOrder() {
        try {
            this.isLoading = true;
            const order = await createOrder({
                restaurantId: this.restaurantId,
                tableId: this.selectedTable.Id,
                customerId: null
            });
            this.showActions = false;
            this.dispatchEvent(new CustomEvent('tableselect', {
                detail: { tableId: this.selectedTable.Id, orderId: order.Id }
            }));
        } catch (err) {
            this.actionError = err.body?.message || 'Failed to start order';
        } finally {
            this.isLoading = false;
        }
    }

    async handleReserveTable() {
        try {
            this.isLoading = true;
            await updateTableStatus({ tableId: this.selectedTable.Id, status: 'Reserved' });
            this.handleCloseActions();
            await this.loadTables();
        } catch (err) {
            this.actionError = err.body?.message || 'Failed to reserve table';
        } finally {
            this.isLoading = false;
        }
    }

    async handleFreeTable() {
        try {
            this.isLoading = true;
            await updateTableStatus({ tableId: this.selectedTable.Id, status: 'Available' });
            this.handleCloseActions();
            await this.loadTables();
        } catch (err) {
            this.actionError = err.body?.message || 'Cannot free this table';
        } finally {
            this.isLoading = false;
        }
    }

    handleWindowResize() {
        const isDesktop = window.matchMedia('(min-width: 1024px)').matches;
        if (this.isDesktop !== isDesktop) {
            this.isDesktop = isDesktop;
            if (!isDesktop) {
                this.autoRefreshPeriod = 0;
                this.stopAutoRefresh();
            } else {
                this.autoRefreshPeriod = 15000;
                this.startAutoRefresh();
            }
        }
    }

    startAutoRefresh() {
        this.stopAutoRefresh();
        if (this.autoRefreshPeriod > 0 && this.isDesktop) {
            this.nextRefreshIn = Math.floor(this.autoRefreshPeriod / 1000);
            this.autoRefreshTimerId = window.setInterval(() => {
                this.loadTables(true);
                this.nextRefreshIn = Math.floor(this.autoRefreshPeriod / 1000);
            }, this.autoRefreshPeriod);

            this.countDownTimerId = window.setInterval(() => {
                if (this.nextRefreshIn > 0) {
                    this.nextRefreshIn -= 1;
                }
            }, 1000);
        }
    }

    stopAutoRefresh() {
        if (this.autoRefreshTimerId) {
            window.clearInterval(this.autoRefreshTimerId);
            this.autoRefreshTimerId = undefined;
        }
        if (this.countDownTimerId) {
            window.clearInterval(this.countDownTimerId);
            this.countDownTimerId = undefined;
        }
        this.nextRefreshIn = 0;
    }

    handleAutoRefreshChange(event) {
        const period = parseInt(event.target.value, 10);
        if (Number.isNaN(period)) {
            this.autoRefreshPeriod = 0;
        } else {
            this.autoRefreshPeriod = period;
        }

        if (this.isDesktop) {
            localStorage.setItem('posTableAutoRefresh', this.autoRefreshPeriod);
        }

        this.startAutoRefresh();

        const message = this.autoRefreshPeriod > 0
            ? `Auto-refresh set to ${this.autoRefreshPeriod / 1000}s`
            : 'Auto-refresh disabled';
        this.dispatchEvent(new ShowToastEvent({
            title: 'Table refresh',
            message,
            variant: 'success'
        }));
    }

    handleRefresh() {
        this.loadTables(false);
    }

    disconnectedCallback() {
        if (this.resizeHandler) {
            window.removeEventListener('resize', this.resizeHandler);
        }
        if (this._keyHandler) {
            window.removeEventListener('keydown', this._keyHandler);
        }
        this.stopAutoRefresh();
    }

    get hasTables() {
        return this.tables && this.tables.length > 0;
    }

    get isAutoRefreshOff() {
        return this.autoRefreshPeriod === 0;
    }

    get isAutoRefresh10() {
        return this.autoRefreshPeriod === 10000;
    }

    get isAutoRefresh15() {
        return this.autoRefreshPeriod === 15000;
    }

    get isAutoRefresh30() {
        return this.autoRefreshPeriod === 30000;
    }

    get isAutoRefresh60() {
        return this.autoRefreshPeriod === 60000;
    }

    get isSelectedAvailable() {
        return this.selectedTable?.Status__c === 'Available';
    }

    get isSelectedOccupiedNoOrder() {
        return this.selectedTable?.Status__c === 'Occupied' && !this.selectedTable?.Current_Order__c;
    }

    get isSelectedReserved() {
        return this.selectedTable?.Status__c === 'Reserved';
    }

    get selectedTableName() {
        return this.selectedTable?.Name || '';
    }

    get selectedTableStatus() {
        return this.selectedTable?.Status__c || '';
    }

    get hasActionError() {
        return !!this.actionError;
    }
}
