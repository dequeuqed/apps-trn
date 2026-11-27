import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import {
  createCampaign,
  listCampaigns,
  type CampaignFilters,
} from '../api/campaigns.ts';

export const campaignKeys = {
  all: ['campaigns'] as const,
  list: (filters: CampaignFilters) =>
    [...campaignKeys.all, 'list', filters] as const,
};

export function useCampaigns(filters: CampaignFilters) {
  return useInfiniteQuery({
    queryKey: campaignKeys.list(filters),
    queryFn: ({ pageParam, signal }) =>
      listCampaigns(filters, pageParam, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    // Keep showing the old results while a new filter loads.
    placeholderData: keepPreviousData,
  });
}

export function useCreateCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createCampaign,
    // Returning the promise keeps the mutation pending until lists refetch.
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: campaignKeys.all }),
  });
}
