import { LightningElement, api, track } from 'lwc';

export default class PosManagerDesktop extends LightningElement {
    @api restaurantId;
    @api currencyCode;

    @track activeTab = 'tables';

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

    get isTablesTab() { return this.activeTab === 'tables'; }
    get isMenuTab() { return this.activeTab === 'menu'; }
    get isReportsTab() { return this.activeTab === 'reports'; }
}
