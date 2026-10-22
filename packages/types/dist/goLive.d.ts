/** When a held-back (`scheduled`) ad goes live, as people read it: "3:40 pm" for today, otherwise
 * "23 Oct, 3:40 pm". Always India time: the audience is in India and this also runs on a server
 * (web My listings) whose own clock zone is not theirs. */
export declare function goLiveTimeText(publishAt: string | Date, now?: Date): string;
