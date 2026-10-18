"use client";

import { useRef } from "react";
import { signInWithGoogle } from "@/app/songs/actions";

export function LoginForm({ next, disabled }: { next: string; disabled: boolean }) {
  const originRef = useRef<HTMLInputElement>(null);
  return (
    <form
      action={signInWithGoogle}
      onSubmit={() => {
        if (originRef.current) originRef.current.value = window.location.origin;
      }}
    >
      <input type="hidden" name="next" value={next} />
      <input ref={originRef} type="hidden" name="origin" defaultValue="" />
      <button className="primary" type="submit" disabled={disabled}>
        Google 계정으로 계속
      </button>
    </form>
  );
}
