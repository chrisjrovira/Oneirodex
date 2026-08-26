/**
 * Regression harness for the preferences theme picker's binding timing.
 *
 * base.html loads preferences_modal.js in <head> and only fetches the modal
 * markup when the user opens Preferences, so the picker's elements appear long
 * after DOMContentLoaded. This harness reproduces exactly that order — run the
 * script, fire DOMContentLoaded against an empty page, and only then inject the
 * modal — and asserts the swatches still work.
 *
 * It runs on a hand-rolled micro-DOM (no jsdom dependency) that implements only
 * what the script touches: bubbling events, closest/querySelectorAll for simple
 * and one-level descendant selectors, classList, dataset, inline custom
 * properties and MutationObserver.
 *
 * Run with: node tests/js/preferences_modal_delegation.test.mjs
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import vm from 'node:vm';

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
// Overridable so the harness can be pointed at an older revision of the file
// to confirm it really does catch the bug it is guarding against.
const SCRIPT = process.env.PREFERENCES_MODAL_JS || path.resolve(
    HERE, '..', '..', 'gametheca', 'setup', 'default_theme', 'js', 'preferences_modal.js'
);

// Stand-in for the .theme-swatch-<slug> rules in css/form-components.css.
const CHIP_COLOURS = {
    'theme-swatch-default': 'rgb(47, 214, 123)',
    'theme-swatch-ember': 'rgb(244, 114, 182)',
};

// --------------------------------------------------------------------------
// Micro-DOM
// --------------------------------------------------------------------------

const mutationObservers = [];

class StyleDeclaration {
    constructor() { this._props = {}; }
    setProperty(name, value) { this._props[name] = value; }
    getPropertyValue(name) { return this._props[name] || ''; }
    removeProperty(name) { delete this._props[name]; }
}

class Element {
    constructor(tagName) {
        this.tagName = tagName.toUpperCase();
        this.id = '';
        this.title = '';
        this.disabled = false;
        this.value = undefined;
        this.children = [];
        this.parentNode = null;
        this.dataset = {};
        this.style = new StyleDeclaration();
        this._attributes = {};
        this._classes = new Set();
        this._listeners = {};
    }

    get classList() {
        const classes = this._classes;
        return {
            add: (name) => classes.add(name),
            remove: (name) => classes.delete(name),
            contains: (name) => classes.has(name),
            toggle: (name, force) => {
                const on = force === undefined ? !classes.has(name) : !!force;
                if (on) { classes.add(name); } else { classes.delete(name); }
                return on;
            },
        };
    }

    appendChild(child) {
        child.parentNode = this;
        this.children.push(child);
        mutationObservers
            .filter((entry) => entry.target === this)
            .forEach((entry) => entry.callback([], entry.observer));
        return child;
    }

    setAttribute(name, value) { this._attributes[name] = String(value); }
    getAttribute(name) { return name in this._attributes ? this._attributes[name] : null; }
    removeAttribute(name) { delete this._attributes[name]; }

    /** Simple selectors only: '#id', '.class' or a tag name. */
    matches(selector) {
        const sel = selector.trim();
        if (sel.startsWith('#')) { return this.id === sel.slice(1); }
        if (sel.startsWith('.')) { return this._classes.has(sel.slice(1)); }
        return this.tagName === sel.toUpperCase();
    }

    closest(selector) {
        let node = this;
        while (node) {
            if (node.matches && node.matches(selector)) { return node; }
            node = node.parentNode;
        }
        return null;
    }

    descendants() {
        return this.children.flatMap((child) => [child, ...child.descendants()]);
    }

    querySelectorAll(selector) {
        let scope = [this];
        for (const part of selector.trim().split(/\s+/)) {
            scope = scope.flatMap((node) => node.descendants().filter((d) => d.matches(part)));
        }
        return scope;
    }

    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }

    addEventListener(type, handler) {
        (this._listeners[type] = this._listeners[type] || []).push(handler);
    }

    dispatchEvent(event) {
        event.target = event.target || this;
        let node = this;
        while (node) {
            (node._listeners[event.type] || []).slice().forEach((fn) => fn.call(node, event));
            node = node.parentNode;
        }
        (document._listeners[event.type] || []).slice().forEach((fn) => fn.call(document, event));
        return true;
    }
}

class DomEvent {
    constructor(type, options = {}) {
        this.type = type;
        this.bubbles = !!options.bubbles;
        this.target = null;
    }
    preventDefault() { this.defaultPrevented = true; }
}

const documentElement = new Element('html');
const body = new Element('body');
documentElement.appendChild(body);

const document = {
    readyState: 'loading',
    documentElement,
    body,
    _listeners: {},
    addEventListener(type, handler) {
        (this._listeners[type] = this._listeners[type] || []).push(handler);
    },
    dispatchEvent(event) {
        event.target = event.target || document;
        (this._listeners[event.type] || []).slice().forEach((fn) => fn.call(document, event));
        return true;
    },
    createElement(tagName) { return new Element(tagName); },
    getElementById(id) { return documentElement.querySelectorAll('#' + id)[0] || null; },
    querySelector(selector) { return documentElement.querySelector(selector); },
    querySelectorAll(selector) { return documentElement.querySelectorAll(selector); },
};

class FakeMutationObserver {
    constructor(callback) { this.callback = callback; }
    observe(target) {
        mutationObservers.push({ target, callback: this.callback, observer: this });
    }
    disconnect() {}
}

function getComputedStyle(element) {
    const painted = [...element._classes].find((name) => name in CHIP_COLOURS);
    return { backgroundColor: painted ? CHIP_COLOURS[painted] : 'rgba(0, 0, 0, 0)' };
}

const sandbox = {
    document,
    Event: DomEvent,
    MutationObserver: FakeMutationObserver,
    getComputedStyle,
    console,
    setTimeout,
    fetch: () => Promise.reject(new Error('network disabled in this harness')),
    FormData: class { constructor() {} },
    // Older revisions bound the submit handler through jQuery.
    $: () => ({ on: () => {} }),
    CSRFUtils: { getToken: () => 'token', getHeaders: () => ({ 'X-CSRFToken': 'token' }) },
};
sandbox.window = sandbox;
vm.createContext(sandbox);

// --------------------------------------------------------------------------
// The scenario
// --------------------------------------------------------------------------

function buildElement(tag, { id, classes = [], data = {}, value } = {}) {
    const element = new Element(tag);
    if (id) { element.id = id; }
    classes.forEach((name) => element._classes.add(name));
    Object.assign(element.dataset, data);
    if (value !== undefined) { element.value = value; }
    return element;
}

function injectPreferencesModal(container, themes, selected) {
    const modal = buildElement('div', { id: 'preferencesModal' });
    const select = buildElement('select', { id: 'themeSelect', value: selected });
    const grid = buildElement('div', { id: 'themeSwatchGrid' });
    const eras = { default: 'wood_den_80s', ember: 'arcade_cabinet' };

    themes.forEach((slug) => {
        const swatch = buildElement('button', {
            classes: ['theme-swatch'],
            data: { theme: slug, era: eras[slug] || 'wood_den_80s' },
        });
        swatch.appendChild(buildElement('span', {
            classes: ['theme-swatch-chip', 'theme-swatch-' + slug],
        }));
        grid.appendChild(swatch);
    });

    modal.appendChild(select);
    modal.appendChild(grid);
    container.appendChild(modal);
    return { modal, select, grid };
}

function swatchFor(slug) {
    return document.querySelectorAll('#themeSwatchGrid .theme-swatch')
        .find((element) => element.dataset.theme === slug);
}

// 1. The page as it exists when the script runs: the container is empty.
const container = buildElement('div', { id: 'preferencesModalContainer' });
body.appendChild(container);

vm.runInContext(fs.readFileSync(SCRIPT, 'utf8'), sandbox, { filename: SCRIPT });

// 2. The document finishes loading with no modal anywhere in the DOM.
document.readyState = 'complete';
document.dispatchEvent(new DomEvent('DOMContentLoaded'));
assert.equal(document.getElementById('themeSelect'), null, 'modal must not exist yet');

// 3. The user opens Preferences and base.html injects the fetched markup.
const { modal, select } = injectPreferencesModal(container, ['default', 'ember'], 'default');

// The saved theme is marked selected as soon as the markup lands.
assert.ok(swatchFor('default').classList.contains('is-selected'), 'saved theme should be selected');
assert.equal(swatchFor('default').getAttribute('aria-pressed'), 'true');
assert.equal(swatchFor('ember').getAttribute('aria-pressed'), 'false');

// 4. Clicking a swatch that did not exist at bind time still works.
const ember = swatchFor('ember');
ember.dispatchEvent(new DomEvent('click', { bubbles: true }));

assert.equal(select.value, 'ember', 'clicking a swatch must drive the native select');
assert.ok(ember.classList.contains('is-selected'), 'clicked swatch should become selected');
assert.ok(!swatchFor('default').classList.contains('is-selected'), 'previous swatch should clear');
assert.equal(
    documentElement.style.getPropertyValue('--gt-accent'),
    CHIP_COLOURS['theme-swatch-ember'],
    'live preview should repaint the accent token'
);
assert.equal(
    documentElement.getAttribute('data-era'),
    'arcade_cabinet',
    'live preview should switch the decade room'
);

// 5. Changing the native <select> keeps the swatches in step.
select.value = 'default';
select.dispatchEvent(new DomEvent('change', { bubbles: true }));
assert.ok(swatchFor('default').classList.contains('is-selected'), 'select change should sync swatches');
assert.equal(
    documentElement.style.getPropertyValue('--gt-accent'),
    CHIP_COLOURS['theme-swatch-default']
);

// 6. Dismissing without saving must not leave the preview behind.
modal.dispatchEvent(new DomEvent('hidden.bs.modal', { bubbles: true }));
assert.equal(
    documentElement.style.getPropertyValue('--gt-accent'),
    '',
    'closing the modal should revert an unsaved preview'
);
assert.equal(
    documentElement.getAttribute('data-era'),
    null,
    'closing the modal should restore the previous decade room'
);

// 7. Re-opening (base.html refetches and replaces the markup) rebinds nothing
//    and still works.
container.children.length = 0;
const reopened = injectPreferencesModal(container, ['default', 'ember'], 'ember');
assert.ok(swatchFor('ember').classList.contains('is-selected'), 'reopened modal should sync');
swatchFor('default').dispatchEvent(new DomEvent('click', { bubbles: true }));
assert.equal(reopened.select.value, 'default', 'handlers survive repeated injection');

console.log('preferences_modal delegation: all assertions passed');
