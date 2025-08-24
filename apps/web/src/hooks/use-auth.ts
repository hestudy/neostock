import { authClient } from '@/lib/auth-client';
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';

export function useAuth() {
  const navigate = useNavigate();
  const { data: session, isPending, error } = authClient.useSession();

  const signOut = async () => {
    try {
      await authClient.signOut({
        fetchOptions: {
          onSuccess: () => {
            navigate({ to: '/' });
            toast.success('Signed out successfully');
          },
          onError: (error: unknown) => {
            toast.error('Failed to sign out');
            console.error('Sign out error:', error);
          },
        },
      });
    } catch (error) {
      toast.error('Failed to sign out');
      console.error('Sign out error:', error);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      await authClient.signIn.email(
        { email, password },
        {
          onSuccess: () => {
            navigate({ to: '/dashboard' });
            toast.success('Signed in successfully');
          },
          onError: (error: { error?: { message?: string; statusText?: string } }) => {
            const message = error.error?.message || error.error?.statusText || 'Failed to sign in';
            toast.error(message);
          },
        }
      );
    } catch (error) {
      toast.error('Failed to sign in');
      console.error('Sign in error:', error);
    }
  };

  const signUp = async (email: string, password: string, name: string) => {
    try {
      await authClient.signUp.email(
        { email, password, name },
        {
          onSuccess: () => {
            navigate({ to: '/dashboard' });
            toast.success('Account created successfully');
          },
          onError: (error: { error?: { message?: string; statusText?: string } }) => {
            const message = error.error?.message || error.error?.statusText || 'Failed to create account';
            toast.error(message);
          },
        }
      );
    } catch (error) {
      toast.error('Failed to create account');
      console.error('Sign up error:', error);
    }
  };

  return {
    session,
    user: session?.user,
    isAuthenticated: !!session?.user,
    isPending,
    error,
    signIn,
    signUp,
    signOut,
  };
}