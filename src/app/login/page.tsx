import { Suspense } from 'react';
import LoginClient from './LoginClient';

export default function SiteLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <LoginClient />
    </Suspense>
  );
}
