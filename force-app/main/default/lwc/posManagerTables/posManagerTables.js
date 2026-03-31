import { LightningElement, api, track } from 'lwc';
import { notify, extractErrorMessage, createFocusTrap } from 'c/posUtils';
import getManagerTables from '@salesforce/apex/TableController.getManagerTables';
import upsertTable from '@salesforce/apex/TableController.upsertTable';
import updateTableStatus from '@salesforce/apex/TableController.updateTableStatus';
import transferCurrentOrder from '@salesforce/apex/TableController.transferCurrentOrder';

const EMPTY_TABLE = { Id: null, Name: '', Capacity__c: 4, Status__c: 'Available' };
const PAGE_SIZE = 10;

export default class PosManagerTables extends LightningElement {
    @api restaurantId;

    @track isLoading = false;
    @track tables = [];
    @track tableForm = { ...EMPTY_TABLE };
    @track transferSourceTableId = '';
    @track transferTargetTableId = '';
    @track transferError = '';
    @track tableFormError = '';
    @track tableActionError = '';
    @track tablesPage = 1;
    @track showEditTableModal = false;
    @track editModalTitle = '';

    _modalKeyHandler;
    _modalFocusPending = false;

    connectedCallback() {
        this.loadTables();
    }

    disconnectedCallback() {
        if (this._modalKeyHandler) {
            window.removeEventListener('keydown', this._modalKeyHandler);
            this._modalKeyHandler = null;
        }
    }

    async loadTables() {
        this.tables = await getManagerTables({ restaurantId: this.restaurantId });
        this.tablesPage = 1;
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

    handleTableInput(event) {
        this.tableForm = { ...this.tableForm, [event.target.name]: event.target.value };
    }

    openNewTable() {
        this.tableForm = { ...EMPTY_TABLE };
        this.tableFormError = '';
        this.tableActionError = '';
        this.editModalTitle = 'Add Table';
        this.showEditTableModal = true;
        this.prepareModalFocus();
        this._attachFocusTrap();
    }

    editTable(event) {
        const id = event.currentTarget.dataset.id;
        const table = this.tables.find((row) => row.Id === id);
        if (table) {
            this.tableForm = { ...table };
            this.tableFormError = '';
            this.tableActionError = '';
            this.editModalTitle = 'Edit Table';
            this.showEditTableModal = true;
            this.prepareModalFocus();
            this._attachFocusTrap();
        }
    }

    closeTableModal() {
        this.showEditTableModal = false;
        this.tableForm = { ...EMPTY_TABLE };
        this.tableFormError = '';
        this._detachFocusTrap();
        this.teardownModalHandlerIfIdle();
    }

    handleTableModalKeydown(event) {
        if (event.key === 'Escape') {
            this.closeTableModal();
        }
    }

    saveTable() {
        this.tableFormError = '';
        this.tableActionError = '';
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
                sortOrder: null,
                status: this.tableForm.Status__c
            });
            this.closeTableModal();
            await this.loadTables();
        }, 'Table saved', (message) => {
            this.tableFormError = message;
        });
    }

    updateTableStatus(event) {
        this.tableActionError = '';
        const tableId = event.currentTarget.dataset.id;
        const status = event.currentTarget.dataset.status;
        this.runSafely(async () => {
            await updateTableStatus({ tableId, status });
            await this.loadTables();
        }, 'Table status updated', (message) => {
            this.tableActionError = message;
        });
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

    get tablesDisplay() {
        return this.tables.map((table, idx) => ({
            ...table,
            tableNumber: idx + 1
        }));
    }

    get pagedTablesDisplay() {
        return this.paginateRows(this.tablesDisplay, this.tablesPage);
    }

    get tablesTotalPages() {
        return Math.max(1, Math.ceil((this.tablesDisplay.length || 0) / PAGE_SIZE));
    }

    get tablesPageLabel() {
        return `Page ${this.tablesPage} of ${this.tablesTotalPages}`;
    }

    get disableTablesPrev() {
        return this.tablesPage <= 1;
    }

    get disableTablesNext() {
        return this.tablesPage >= this.tablesTotalPages;
    }

    get showTablesPagination() {
        return this.tablesDisplay.length > PAGE_SIZE;
    }

    get tableStatusOptions() {
        return [
            { label: 'Available', value: 'Available' },
            { label: 'Reserved', value: 'Reserved' },
            { label: 'Occupied', value: 'Occupied' },
            { label: 'Out of Service', value: 'Out of Service' }
        ];
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

    handleTablesPrev() {
        this.tablesPage = Math.max(1, this.tablesPage - 1);
    }

    handleTablesNext() {
        this.tablesPage = Math.min(this.tablesTotalPages, this.tablesPage + 1);
    }

    paginateRows(rows, page, pageSize = PAGE_SIZE) {
        const safeRows = rows || [];
        const start = (page - 1) * pageSize;
        return safeRows.slice(start, start + pageSize);
    }

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
            if (this.showEditTableModal) {
                this.closeTableModal();
            }
        };
        window.addEventListener('keydown', this._modalKeyHandler);
    }

    teardownModalHandlerIfIdle() {
        if (this.showEditTableModal) {
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
