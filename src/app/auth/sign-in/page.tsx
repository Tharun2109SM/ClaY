import { AuthCard } from "@/components/auth/auth-card";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; next?: string }>;
}) {
  const { message, next } = await searchParams;
  return <AuthCard mode="sign-in" message={message} next={next} />;
}
