import { LightningElement, track } from 'lwc';

const PHONE = '+919460650122';
const PHONE_DISPLAY = '+91 94606 50122';

export default class PosHelpFab extends LightningElement {
    @track showPopover = false;

    phoneHref = `tel:${PHONE}`;
    phoneDisplay = PHONE_DISPLAY;

    togglePopover() {
        this.showPopover = !this.showPopover;
    }

    get popoverClass() {
        return 'popover' + (this.showPopover ? '' : ' hidden');
    }
}
