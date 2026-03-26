import { LightningElement } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

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

export function extractErrorMessage(error, fallback = 'Action failed') {
    if (!error) {
        return fallback;
    }
    if (error.body) {
        if (typeof error.body.message === 'string' && error.body.message) {
            return error.body.message;
        }
        if (Array.isArray(error.body.pageErrors) && error.body.pageErrors.length) {
            return error.body.pageErrors[0].message || fallback;
        }
        if (error.body.output) {
            const outputErrors = error.body.output.errors;
            if (Array.isArray(outputErrors) && outputErrors.length) {
                return outputErrors[0].message || fallback;
            }
            const fieldErrors = error.body.output.fieldErrors || {};
            const firstField = Object.keys(fieldErrors)[0];
            if (firstField && Array.isArray(fieldErrors[firstField]) && fieldErrors[firstField].length) {
                return fieldErrors[firstField][0].message || fallback;
            }
        }
    }
    if (typeof error.message === 'string' && error.message) {
        return error.message;
    }
    return fallback;
}

export function notify(component, title, message, variant = 'info') {
    component.dispatchEvent(new ShowToastEvent({ title, message, variant }));
}
