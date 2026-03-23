import { LightningElement, api } from 'lwc';

export default class PosHeader extends LightningElement {
    @api restaurantName;
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
}
