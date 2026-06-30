import { Crown } from "lucide-react";
import type { RoomMember } from "@/lib/types";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

function isEmailLike(value: string) {
  return /^\S+@\S+\.\S+$/.test(value.trim());
}

function getMemberName(member: RoomMember) {
  const displayName = member.display_name?.trim();

  return displayName && !isEmailLike(displayName) ? displayName : "Room member";
}

export function MemberList({ members }: { members: RoomMember[] }) {
  return (
    <div className="grid gap-3">
      {members.map((member) => (
        <div
          key={member.id}
          className="flex min-h-20 items-center justify-between gap-4 rounded-2xl border bg-background/45 px-4 py-3"
        >
          <div className="flex min-w-0 flex-1 items-center gap-3.5">
            <Avatar className="size-11 shrink-0">
              <AvatarFallback>
                {(getMemberName(member) ?? "?")
                  .slice(0, 2)
                  .toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p
                className="truncate text-sm text-foreground"
                title={getMemberName(member)}
              >
                {getMemberName(member)}
              </p>
              <p
                className="mt-1 truncate text-xs text-muted-foreground"
                title={member.email ?? undefined}
              >
                {member.email}
              </p>
            </div>
          </div>
          <Badge
            variant={member.role === "owner" ? "default" : "secondary"}
            className="shrink-0"
          >
            {member.role === "owner" ? <Crown className="size-3" /> : null}
            {member.role}
          </Badge>
        </div>
      ))}
    </div>
  );
}
