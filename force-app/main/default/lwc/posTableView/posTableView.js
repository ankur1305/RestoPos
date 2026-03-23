import { LightningElement, api, track } from 'lwc';
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
    isLoading = false;

    connectedCallback() {
        this.loadTables();
    }

    async loadTables() {
        try {
            this.isLoading = true;
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
            this.isLoading = false;
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

    handleRefresh() {
        this.loadTables();
    }

    get hasTables() {
        return this.tables && this.tables.length > 0;
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
