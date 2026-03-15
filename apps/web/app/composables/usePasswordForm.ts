/**
 * Composable encapsulating password-change form state and logic.
 * Extracted from settings.vue to keep page thin.
 */
export function usePasswordForm() {
  const authApi = useAuthApi()

  const currentPassword = ref('')
  const newPassword = ref('')
  const confirmPassword = ref('')
  const loading = ref(false)
  const error = ref('')
  const success = ref(false)

  async function submit() {
    error.value = ''
    success.value = false

    if (newPassword.value.length < 8) {
      error.value = 'New password must be at least 8 characters'
      return
    }
    if (newPassword.value !== confirmPassword.value) {
      error.value = 'New passwords do not match'
      return
    }

    loading.value = true
    try {
      await authApi.changePassword({
        currentPassword: currentPassword.value,
        newPassword: newPassword.value,
      })
      success.value = true
      currentPassword.value = ''
      newPassword.value = ''
      confirmPassword.value = ''
    } catch (e: unknown) {
      const err = e as { data?: { message?: string }; statusMessage?: string }
      error.value = err.data?.message || err.statusMessage || 'Failed to change password'
    } finally {
      loading.value = false
    }
  }

  return { currentPassword, newPassword, confirmPassword, loading, error, success, submit }
}
