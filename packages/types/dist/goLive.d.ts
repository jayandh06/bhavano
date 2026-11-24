import { type MarketId } from "./market";
/** When a held-back (`scheduled`) ad goes live, as people read it: "3:40 pm" for today, otherwise
 * "23 Oct, 3:40 pm". In the market's time zone (India unless another market is named): the audience is
 * there and this also runs on a server (web My listings) whose own clock zone is not theirs. */
export declare function goLiveTimeText(publishAt: string | Date, now?: Date, marketId?: MarketId): string;
