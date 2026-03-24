import { LightningElement, api } from 'lwc';

export default class PosHeader extends LightningElement {
    @api restaurantName;
    @api restaurantLogoUrl;
    @api currentView;

    get showBackButton() {
        return this.currentView !== 'tables' && this.currentView !== 'login';
    }

    handleBack() {
        this.dispatchEvent(new CustomEvent('backtotables'));
    }

    handleNavTables() {
        this.dispatchEvent(new CustomEvent('navigate', { detail: { view: 'tables' } }));
    }

    handleNavManager() {
        this.dispatchEvent(new CustomEvent('navigate', { detail: { view: 'manager' } }));
    }

    get tablesBtnClass() {
        return 'nav-btn' + (this.currentView === 'tables' ? ' active' : '');
    }

    get managerBtnClass() {
        return 'nav-btn manager-btn' + (this.currentView === 'manager' ? ' active' : '');
    }
}
