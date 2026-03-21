export function useAppFetch() {
  const requestFetch = useRequestFetch()

  return async <T>(
    request: Parameters<typeof requestFetch>[0],
    options?: Parameters<typeof requestFetch>[1],
  ) => {
    const response = await requestFetch<T>(request, options)
    return response as T
  }
}
