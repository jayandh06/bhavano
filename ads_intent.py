"""Which side of the marketplace a phrase speaks to.

Shared by ads_retarget_owners.py (which acts on the answer) and ads_verify_targeting.py (which
reports it), so the two cannot drift apart and disagree about the same keyword.

Deliberately crude. This decides whether a whole phrase reads as "I want to list a property" or
"I want to find one" — it is not a quality score on wording. Anything it cannot place comes back
"unknown", and callers are expected to leave those alone rather than guess: a keyword added by
hand in the Ads UI must not be silently paused just because this file has never heard of it.
"""

# Phrases only someone with a property to offer searches for. "put ... on rent", "give ... for
# rent" and "let out" are the ordinary Indian English forms and are not typos.
OWNER_MARKERS = (
    "rent out", "put my", "give my", "give house", "give flat", "let out", "to let my",
    "list my", "list your", "post my", "post free", "post property", "post pg",
    "post rental", "post commercial", "sell my", "sell your", "advertise my", "advertise your",
    "listing site", "without broker", "for owners", "owner property", "where to post",
    "how to list", "classifieds for property", "sell used furniture", "sell furniture",
    "list coworking", "list my office", "no agents", "brokerage", "tenants directly",
    "your ad", "listings for free", "owners",
)

# Phrases only someone looking for a property searches for. "near me" and a budget qualifier are
# the strongest signals of all.
SEEKER_MARKERS = (
    "near me", "nearby", "for rent", "for sale", "rent houses", "rent house", "rent home",
    "rent room", "rent flat", "houses and rent", "apartments rent", "coliving", "co living",
    "for ladies", "for gents", "for bachelors", "find your", "find affordable", "find a",
    "browse", "discover", "buy or rent", "your next home", "perfect home", "in bangalore",
    "in chennai", "in hyderabad", "in mumbai", "in pune", "cheap", "low budget", "below",
    "under ", "pg in", "pg chennai", "pg nearby", "flats for", "houses for", "apartments for",
    # A buyer's phrasing. Safe alongside "sell used furniture online", which owner-matches first.
    "second hand",
    # A bare locality or city next to a category is someone looking, not listing: an owner names
    # what they own ("rent out my flat"), never where they are hunting ("koramangala pg").
    "koramangala", "lease home", "near by", "rent furniture",
)


def classify(text: str) -> str:
    """"owner", "seeker" or "unknown".

    Owner wins a tie on purpose: "list my property for rent" contains "for rent", and reading
    that as a seeker phrase would pause the single most valuable keyword in the account.
    """
    low = text.lower()
    if any(m in low for m in OWNER_MARKERS):
        return "owner"
    if any(m in low for m in SEEKER_MARKERS):
        return "seeker"
    return "unknown"
