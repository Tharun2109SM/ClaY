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
          className="flex min-h-20 items-center justify-between gap-4 rounded-2xl border border-foreground/10 bg-background/45 px-4 py-3 shadow-sm transition duration-300 hover:border-foreground/18 hover:bg-muted/20 dark:bg-black/22"
        >
          <div className="flex min-w-0 flex-1 items-center gap-3.5">
            <Avatar className="size-11 shrink-0 border border-foreground/10 shadow-sm">
              <AvatarFallback className="bg-[#f7efe0] text-sm text-black dark:bg-white/10 dark:text-foreground">
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
            className="h-7 shrink-0 rounded-full border border-foreground/10 bg-muted/60 px-3 text-[0.68rem] uppercase tracking-[0.12em] text-muted-foreground"
          >
            {member.role === "owner" ? <Crown className="size-3" /> : null}
            {member.role}
          </Badge>
        </div>
      ))}
    </div>
  );
}
