import { useEffect, useMemo, useState } from "react";
import type { AccountSummary } from "../bridge/types";

type AccountAvatarProps = {
  account?: Pick<AccountSummary, "username" | "uuid" | "avatarUrl" | "kind"> | null;
  username?: string;
  size?: "sm" | "md" | "lg";
};

function avatarSource(account: AccountAvatarProps["account"]) {
  return account?.avatarUrl || "/avatars/default.png";
}

export function AccountAvatar({ account, size = "md" }: AccountAvatarProps) {
  const resolved = useMemo(() => avatarSource(account), [account]);
  const [source, setSource] = useState(resolved);

  useEffect(() => {
    setSource(resolved);
  }, [resolved]);

  return (
    <span className={`account-avatar account-avatar--${size}`} aria-hidden="true">
      <img
        src={source}
        alt=""
        draggable={false}
        onError={() => setSource("/avatars/default.png")}
      />
    </span>
  );
}
