"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ownerStatusLabel = ownerStatusLabel;
exports.publicStatusLabel = publicStatusLabel;
exports.statusOptionsFor = statusOptionsFor;
exports.leavingActiveNotice = leavingActiveNotice;
const HIDDEN_EFFECTS = (label) => [
    "Hidden from search and browse",
    `The ad's page stays up, labelled ${label}`,
    "People can no longer contact you through it",
    "Frees one of your ad slots",
];
const OPTIONS = {
    active: {
        value: "active",
        title: "Active",
        summary: "Buyers and renters can find and contact you.",
        effects: ["Shown in search and on the site", "Uses one of your ad slots"],
    },
    sold: {
        value: "sold",
        title: "Sold",
        summary: "The deal is done. Mark it Sold so people stop asking.",
        effects: HIDDEN_EFFECTS("Sold"),
    },
    rented: {
        value: "rented",
        title: "Rented",
        summary: "The deal is done. Mark it Rented so people stop asking.",
        effects: HIDDEN_EFFECTS("Rented"),
    },
    deactivated: {
        value: "deactivated",
        title: "Paused",
        summary: "Not available for now, but it may come back.",
        effects: HIDDEN_EFFECTS("Deactivated"),
    },
};
const ORDER = ["active", "sold", "rented", "deactivated"];
/** The name of a status as the owner sees it ("Paused" for deactivated). */
function ownerStatusLabel(status) {
    return OPTIONS[status].title;
}
/** The label shown on the ad's own page (unchanged wording: "Deactivated", not "Paused"). */
function publicStatusLabel(status) {
    return status === "active" ? "Active" : status === "sold" ? "Sold" : status === "rented" ? "Rented" : "Deactivated";
}
/**
 * The options to offer for an ad. A sale ad is closed as Sold and a rent or lease ad as Rented; the
 * other one is offered only if it is already the ad's current value, so an old choice is never
 * hidden from the person who made it. Active and Paused are always offered.
 */
function statusOptionsFor(transactionType, current) {
    const closed = transactionType === "rent" || transactionType === "lease" ? "rented" : "sold";
    return ORDER.filter((s) => s === "active" || s === "deactivated" || s === closed || s === current).map((s) => OPTIONS[s]);
}
/**
 * What will happen if the owner saves `next`, shown under the cards before they save. Null when
 * nothing changes or the ad goes (back) to Active. `featured` adds the one cost that is easy to
 * miss: nothing pauses a running Featured period, so paid days keep running while the ad is hidden.
 */
function leavingActiveNotice(next, current, opts = {}) {
    if (next === "active" || next === current)
        return null;
    const base = `Your ad will be hidden from search and people can no longer contact you through it. Its page will show as ${publicStatusLabel(next)}. You can switch it back to Active later.`;
    return opts.featured ? `${base} Your Featured days keep running while it is hidden.` : base;
}
