"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ATTR_TARGET_PREFIX = void 0;
exports.attributeTarget = attributeTarget;
exports.postDetailsIssues = postDetailsIssues;
exports.firstDetailsIssue = firstDetailsIssue;
exports.hasBlockingOtherIssue = hasBlockingOtherIssue;
exports.issueMessages = issueMessages;
exports.detailsPartOfTarget = detailsPartOfTarget;
const categoryFields_1 = require("./categoryFields");
exports.ATTR_TARGET_PREFIX = "attr:";
function attributeTarget(fieldKey) {
    return `${exports.ATTR_TARGET_PREFIX}${fieldKey}`;
}
/** Every problem on the Details step, in form order. */
function postDetailsIssues(input) {
    const issues = [];
    const other = (target, text, missing) => issues.push({ target, text, missing, group: "other" });
    // City and area come from the pin, never typed (docs/plans/mandatory-pin-and-owner-location-edit.md).
    if (!input.hasPin)
        other("location", "Drop a pin or search an address to set the location", true);
    else if (input.pinLookingUp)
        other("location", "Finding the location…", true);
    else if (!input.hasCity)
        other("location", "Pick the nearest city", true);
    else if (input.areaText.trim().length === 0)
        other("location", "We couldn't read an area for that spot. Move the pin a little or search the address", true);
    else if (!input.areaIsExisting && input.areaText.trim().length > input.areaMaxLength)
        other("location", `Area / locality must be ${input.areaMaxLength} characters or fewer`, false);
    // Asked with its own friendlier copy before the generic attribute sweep, which would say "... is required".
    if (input.needsPostedBy && !input.postedByAnswered)
        other("posted_by", "Choose Owner or Broker / Agent under Posted by", true);
    if (input.category && input.transactionType) {
        for (const issue of (0, categoryFields_1.listingAttributeIssues)(input.category, input.transactionType, input.attributes)) {
            // The brokerage-against-price check (no field) is made below with the real total; and Posted by was
            // already reported above with its own wording.
            if (!issue.key)
                continue;
            if (issue.key === "fromBroker" && input.needsPostedBy && !input.postedByAnswered)
                continue;
            other(attributeTarget(issue.key), issue.text, issue.text.endsWith(" is required"));
        }
    }
    if (input.priceMissing)
        other("price", "Add a price", true);
    else if (input.priceIssue)
        other("price", input.priceIssue, false);
    if (input.transactionType) {
        const brokerage = (0, categoryFields_1.brokerageFeeIssue)(input.transactionType, input.totalPrice, input.attributes);
        if (brokerage)
            other("brokerage", brokerage, false);
    }
    if (input.photoCount < input.minPhotos)
        other("photos", `Add at least ${input.minPhotos} photos`, true);
    if (input.askSellerType && !input.sellerTypeAnswered)
        other("owner_type", "Choose Owner or Agent / broker", true);
    if (input.assistedProblem)
        other("assisted", input.assistedProblem, false);
    const copy = (target, text, missing) => issues.push({ target, text, missing, group: "copy" });
    const title = input.title.trim();
    if (title.length === 0)
        copy("title", "Add a title", true);
    else if (title.length < input.titleMin)
        copy("title", `Title needs at least ${input.titleMin} characters`, false);
    const description = input.description.trim();
    if (description.length === 0)
        copy("description", "Add a description", true);
    else if (description.length < input.descriptionMin)
        copy("description", `Description needs at least ${input.descriptionMin} characters`, false);
    return issues;
}
/** The first problem, or null. What "To preview: ..." showed before there was a list. */
function firstDetailsIssue(issues) {
    return issues[0] ?? null;
}
/** Problems that stop the AI copy helper from running: everything except the title and description it writes. */
function hasBlockingOtherIssue(issues) {
    return issues.some((issue) => issue.group === "other");
}
/** target to message, for putting a message under each field. */
function issueMessages(issues) {
    const out = {};
    for (const issue of issues)
        if (!(issue.target in out))
            out[issue.target] = issue.text;
    return out;
}
/** The three short screens the mobile app splits Details into: 0 location and photos, 1 the property's details and
 * price, 2 title and description. Web keeps one page; this is how a problem maps to a screen. */
function detailsPartOfTarget(target) {
    if (target === "location" || target === "photos")
        return 0;
    if (target === "owner_type" || target === "assisted" || target === "title" || target === "description")
        return 2;
    return 1;
}
