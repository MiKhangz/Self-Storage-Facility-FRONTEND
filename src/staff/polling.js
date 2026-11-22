export const PAGE_SIZE = 100; // the backend's PagedResult cap
export const POLL_MS = 15_000;

/**
 * refetchInterval for a list fetched page by page. One page costs one request, so it keeps polling and another
 * person's change still appears. A longer list would reload the whole table every time: it refreshes after the
 * user's own changes and when the tab is looked at again.
 */
export const pollIfOnePage = ({ state }) => ((state.data?.length ?? 0) > PAGE_SIZE ? false : POLL_MS);
