import { AuthCard } from "@/components/auth/auth-card";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; next?: string }>;
}) {
  const { message, next } = await searchParams;
  return <AuthCard mode="sign-up" message={message} next={next} />;
}
