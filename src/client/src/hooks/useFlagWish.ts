export default function useFlagWish(onSuccess: (id: string) => void) {
  return async (id: string) => {
    if (!window.confirm('Are you sure you want to flag this wish as inappropriate?')) {
      return;
    }
    try {
      const response = await fetch(`/api/wishes/${id}/flag`, { method: 'POST' });
      if (!response.ok) {
        throw new Error('Failed to flag the wish.');
      }
      onSuccess(id);
    } catch (err) {
      window.alert((err as Error).message);
    }
  };
}
