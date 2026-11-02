"use strict";
/** Shared contract for the post-ad experience feedback — see docs/plans/post-ad-experience-feedback.md.
 * The web form, the BFF DTO and the admin screen all read these, so a difficulty chip cannot drift between them. */
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST_FEEDBACK_MAX_SUGGESTION = exports.POST_FEEDBACK_SOURCE_LABELS = exports.POST_FEEDBACK_SOURCES = exports.POST_FEEDBACK_DIFFICULTY_LABELS = exports.POST_FEEDBACK_DIFFICULTIES = void 0;
/** What was hard. Named after the steps of the post-ad flow, in the order a poster meets them. */
exports.POST_FEEDBACK_DIFFICULTIES = [
    "category",
    "photos",
    "details",
    "price",
    "location",
    "preview",
    "payment",
    "login",
    "other",
];
exports.POST_FEEDBACK_DIFFICULTY_LABELS = {
    category: "Choosing the category",
    photos: "Photos and videos",
    details: "Description and details",
    price: "Price",
    location: "Location or area",
    preview: "The preview",
    payment: "Payment or the Featured offer",
    login: "Logging in",
    other: "Something else",
};
/** How the request reached the poster, kept so response rates can be compared per surface. */
exports.POST_FEEDBACK_SOURCES = ["success_screen", "in_app_message", "push", "web_link"];
exports.POST_FEEDBACK_SOURCE_LABELS = {
    success_screen: "Success screen",
    in_app_message: "In-app message",
    push: "Push notification",
    web_link: "Web link",
};
exports.POST_FEEDBACK_MAX_SUGGESTION = 500;
