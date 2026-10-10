'use client';

import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

// Clerk hides <SignIn>/<SignUp> once a session exists — including a session
// still pending its organization, right after creating the account. Send the
// user on to onboarding (where the store's organization is created) instead
// of leaving an empty card.
export default function SignedInRedirect({to='/onboarding'}:{to?:string}) {
  const {isLoaded,isSignedIn}=useAuth({treatPendingAsSignedOut:false});
  const router=useRouter();
  useEffect(()=>{ if(isLoaded&&isSignedIn) router.replace(to); },[isLoaded,isSignedIn,router,to]);
  return null;
}
