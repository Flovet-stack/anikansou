import { Button } from "@/components/ui/button";
import { capture } from "@/lib/analytics/analytics";

import { logOut } from "../actions";

export function LogOutButton() {
  return (
    <form action={logOut} onSubmit={() => capture("log_out")}>
      <Button type="submit" variant="secondary">
        Log out
      </Button>
    </form>
  );
}
