import { LightningElement } from 'lwc';

/**
 * Shared helpers for POS LWCs. Not rendered — import named exports from c/posUtils.
 */
export default class PosUtils extends LightningElement {}

/**
 * 10-digit India-style local number (strips +91 / leading 0).
 */
export function normalizeIndianPhone(value) {
    let d = String(value ?? '').replace(/\D/g, '');
    if (d.length === 12 && d.startsWith('91')) {
        d = d.slice(2);
    } else if (d.length === 11 && d.startsWith('0')) {
        d = d.slice(1);
    }
    return d.slice(0, 10);
}
